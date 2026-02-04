package vuln

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	networkpkg "recon/network"
)

// Finding represents a vulnerability finding for ingestion.
type Finding struct {
	Host          string                 `json:"host"`
	URL           string                 `json:"url"`
	OWASPCategory string                 `json:"owasp_category"`
	Title         string                 `json:"title"`
	Severity      string                 `json:"severity"`
	Confidence    string                 `json:"confidence"`
	Evidence      map[string]any         `json:"evidence"`
}

var a01Paths = []string{
	"/admin",
	"/dashboard",
	"/profile",
	"/settings",
	"/api/users",
	"/api/admin",
}

// DetectHostFindings runs A01 and A02 detection for a host.
func DetectHostFindings(host string, tlsResult networkpkg.TLSResult) []Finding {
	findings := make([]Finding, 0)

	findings = append(findings, detectA01(host, tlsResult)...)
	findings = append(findings, detectA02(host, tlsResult)...)

	return findings
}

func detectA01(host string, tlsResult networkpkg.TLSResult) []Finding {
	findings := make([]Finding, 0)

	schemes := []string{"http"}
	if tlsResult.HasHTTPS {
		schemes = []string{"https", "http"}
	}

	clientHTTP := newNoRedirectClient(7*time.Second, false)
	clientHTTPS := newNoRedirectClient(7*time.Second, true)

	for _, scheme := range schemes {
		client := clientHTTP
		if scheme == "https" {
			client = clientHTTPS
		}
		for _, path := range a01Paths {
			url := fmt.Sprintf("%s://%s%s", scheme, host, path)
			status, err := fetchStatus(client, url)
			if err != nil {
				continue
			}

			if status == http.StatusOK {
				findings = append(findings, Finding{
					Host:          host,
					URL:           url,
					OWASPCategory: "A01",
					Title:         fmt.Sprintf("Unauthenticated access to %s", path),
					Severity:      "High",
					Confidence:    "Medium",
					Evidence: map[string]any{
						"status_code":   status,
						"method":        "GET",
						"unauthenticated": true,
					},
				})
			}
		}
	}

	return findings
}

func detectA02(host string, tlsResult networkpkg.TLSResult) []Finding {
	findings := make([]Finding, 0)

	// 1) HTTP accessible without redirect to HTTPS
	httpURL := fmt.Sprintf("http://%s/", host)
	clientHTTP := newNoRedirectClient(7*time.Second, false)
	status, location, err := fetchStatusAndLocation(clientHTTP, httpURL)
	if err == nil {
		if status >= 200 && status < 400 {
			if !(isRedirect(status) && isHTTPSRedirect(location)) {
				findings = append(findings, Finding{
					Host:          host,
					URL:           httpURL,
					OWASPCategory: "A02",
					Title:         "HTTP accessible without HTTPS redirect",
					Severity:      "Medium",
					Confidence:    "Medium",
					Evidence: map[string]any{
						"protocol":     "http",
						"status_code":  status,
						"location":     location,
					},
				})
			}
		}
	}

	// 2) Weak TLS versions supported
	if tlsResult.HasHTTPS && len(tlsResult.WeakVersions) > 0 {
		findings = append(findings, Finding{
			Host:          host,
			URL:           fmt.Sprintf("https://%s/", host),
			OWASPCategory: "A02",
			Title:         "Weak TLS versions supported",
			Severity:      "Medium",
			Confidence:    "High",
			Evidence: map[string]any{
				"supported_versions": tlsResult.SupportedVersions,
				"weak_versions":      tlsResult.WeakVersions,
			},
		})
	}

	// 3) Cookies missing Secure flag over HTTPS
	if tlsResult.HasHTTPS {
		httpsURL := fmt.Sprintf("https://%s/", host)
		clientHTTPS := newNoRedirectClient(7*time.Second, true)
		missingSecure := checkCookiesMissingSecure(clientHTTPS, httpsURL)
		if len(missingSecure) > 0 {
			findings = append(findings, Finding{
				Host:          host,
				URL:           httpsURL,
				OWASPCategory: "A02",
				Title:         "Cookies without Secure flag over HTTPS",
				Severity:      "Medium",
				Confidence:    "Medium",
				Evidence: map[string]any{
					"missing_secure_cookies": missingSecure,
				},
			})
		}
	}

	return findings
}

func newNoRedirectClient(timeout time.Duration, insecureTLS bool) *http.Client {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout: 5 * time.Second,
		}).DialContext,
		TLSClientConfig: &tls.Config{InsecureSkipVerify: insecureTLS},
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 5 * time.Second,
	}

	return &http.Client{
		Timeout: timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func fetchStatus(client *http.Client, url string) (int, error) {
	resp, err := doGET(client, url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	return resp.StatusCode, nil
}

func fetchStatusAndLocation(client *http.Client, url string) (int, string, error) {
	resp, err := doGET(client, url)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	return resp.StatusCode, resp.Header.Get("Location"), nil
}

func doGET(client *http.Client, url string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "RevulneraRecon/1.0")
	req.Header.Set("Accept", "text/html,application/json;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func isRedirect(status int) bool {
	switch status {
	case http.StatusMovedPermanently, http.StatusFound, http.StatusTemporaryRedirect, http.StatusPermanentRedirect:
		return true
	default:
		return false
	}
}

func isHTTPSRedirect(location string) bool {
	location = strings.TrimSpace(strings.ToLower(location))
	return strings.HasPrefix(location, "https://")
}

func checkCookiesMissingSecure(client *http.Client, url string) []string {
	resp, err := doGET(client, url)
	if err != nil {
		log.Printf("[vuln] cookie check failed for %s: %v", url, err)
		return nil
	}
	defer resp.Body.Close()

	cookies := resp.Cookies()
	missing := make([]string, 0)
	for _, c := range cookies {
		if !c.Secure {
			missing = append(missing, c.Name)
		}
	}
	return missing
}
