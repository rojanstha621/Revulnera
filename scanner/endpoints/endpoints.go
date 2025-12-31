package endpoints

import (
	"bufio"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"recon/fingerprint"
	"recon/recon"
)

const (
	defaultWordlistPath = "wordlists/common.txt"
	defaultWorkerCount  = 20
	defaultRPS          = 10
)

// ---------------- TYPES ----------------

type EndpointResult struct {
	URL           string            `json:"url"`
	StatusCode    int               `json:"status_code"`
	ContentLength int64             `json:"content_length"`
	Title         string            `json:"title"`
	Headers       map[string]string `json:"headers"`

	Fingerprints []string          `json:"fingerprints"`
	Evidence     map[string]string `json:"evidence"`
}

// ---------------- MAIN ENTRY ----------------

// DiscoverEndpointsFromScan:
// 1) load alive subdomains
// 2) brute-force paths
// 3) probe endpoints
// 4) domain + endpoint fingerprinting
// 5) save results
func DiscoverEndpointsFromScan(scanID int64, target string) ([]EndpointResult, error) {
	subdomains, scanFile, err := recon.LoadSubdomainsForScan(scanID, target)
	if err != nil {
		return nil, fmt.Errorf("load subdomains: %w", err)
	}
	log.Printf("[endpoints] loaded %d subdomains from %s", len(subdomains), scanFile)

	wordlistPath := getEnvOrDefault("ENDPOINT_WORDLIST", defaultWordlistPath)
	paths, err := loadWordlist(wordlistPath)
	if err != nil {
		return nil, err
	}

	schemes := []string{"http", "https"}

	urls := make([]string, 0)
	for _, s := range subdomains {
		if !s.Alive {
			continue
		}
		for _, scheme := range schemes {
			for _, p := range paths {
				urls = append(urls, fmt.Sprintf("%s://%s%s", scheme, s.Name, p))
			}
		}
	}

	workers := getEnvIntOrDefault("ENDPOINT_WORKERS", defaultWorkerCount)
	rps := getEnvIntOrDefault("ENDPOINT_RPS", defaultRPS)

	results := probeURLsConcurrently(urls, workers, rps)

	if _, err := saveEndpointsToFile(scanID, target, results); err != nil {
		log.Printf("[endpoints] save error: %v", err)
	}

	return results, nil
}

// ---------------- WORDLIST ----------------

func loadWordlist(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var paths []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		l := strings.TrimSpace(sc.Text())
		if l == "" || strings.HasPrefix(l, "#") {
			continue
		}
		if !strings.HasPrefix(l, "/") {
			l = "/" + l
		}
		paths = append(paths, l)
	}
	return paths, sc.Err()
}

// ---------------- RATE LIMITER ----------------

type RateLimiter struct {
	tokens chan struct{}
}

func NewRateLimiter(rps int) *RateLimiter {
	if rps <= 0 {
		rps = defaultRPS
	}
	rl := &RateLimiter{tokens: make(chan struct{}, rps)}

	for i := 0; i < rps; i++ {
		rl.tokens <- struct{}{}
	}

	go func() {
		ticker := time.NewTicker(time.Second / time.Duration(rps))
		defer ticker.Stop()
		for range ticker.C {
			select {
			case rl.tokens <- struct{}{}:
			default:
			}
		}
	}()

	return rl
}

func (r *RateLimiter) Acquire() { <-r.tokens }

// ---------------- CONCURRENCY ----------------

func probeURLsConcurrently(urls []string, workers int, rps int) []EndpointResult {
	jobs := make(chan string, workers*2)
	results := make(chan EndpointResult, workers*2)

	client := &http.Client{Timeout: 7 * time.Second}
	limiter := NewRateLimiter(rps)

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for url := range jobs {
				if res, err := probeURL(client, limiter, url); err == nil {
					results <- *res
				}
			}
		}()
	}

	go func() {
		for _, u := range urls {
			jobs <- u
		}
		close(jobs)
	}()

	go func() {
		wg.Wait()
		close(results)
	}()

	out := make([]EndpointResult, 0)
	for r := range results {
		out = append(out, r)
	}
	return out
}

// ---------------- DOMAIN FINGERPRINT CACHE ----------------

var domainFP sync.Map // map[string]fingerprint.DomainResult

func getDomainFingerprint(client *http.Client, url string) fingerprint.DomainResult {
	host := extractHost(url)

	if v, ok := domainFP.Load(host); ok {
		return v.(fingerprint.DomainResult)
	}

	req, _ := http.NewRequest("GET", "https://"+host, nil)
	req.Header.Set("User-Agent", "RevulneraRecon/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return fingerprint.DomainResult{}
	}
	defer resp.Body.Close()

	buf := make([]byte, 4096)
	n, _ := resp.Body.Read(buf)

	headers := snapshotHeaders(resp) // ✅ FIX
	fp := fingerprint.FingerprintDomain(headers, string(buf[:n]))

	domainFP.Store(host, fp)
	return fp
}

func extractHost(url string) string {
	u := strings.Split(url, "://")
	if len(u) > 1 {
		return strings.Split(u[1], "/")[0]
	}
	return url
}

// ---------------- PROBE ----------------

func shouldKeepStatus(code int) bool {
	if code >= 200 && code < 400 {
		return true
	}
	switch code {
	case 401, 403, 405:
		return true
	default:
		return false
	}
}

func probeURL(client *http.Client, limiter *RateLimiter, url string) (*EndpointResult, error) {
	limiter.Acquire()

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "RevulneraRecon/1.0")
	req.Header.Set("Accept", "text/html,application/json;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if !shouldKeepStatus(resp.StatusCode) {
		return nil, fmt.Errorf("ignored %d", resp.StatusCode)
	}

	buf := make([]byte, 4096)
	n, _ := resp.Body.Read(buf)
	snippet := string(buf[:n])

	title := extractTitle(snippet)
	headers := snapshotHeaders(resp)

	// DOMAIN + ENDPOINT FINGERPRINTING
	dfp := getDomainFingerprint(client, url)
	efp := fingerprint.FingerprintEndpoint(resp.StatusCode, title, headers)

	tags := append(dfp.Tags, efp.Tags...)
	evidence := dfp.Evidence
	if evidence == nil {
		evidence = map[string]string{}
	}
	for k, v := range efp.Evidence {
		evidence[k] = v
	}

	return &EndpointResult{
		URL:           url,
		StatusCode:    resp.StatusCode,
		ContentLength: resp.ContentLength,
		Title:         title,
		Headers:       headers,
		Fingerprints:  tags,
		Evidence:      evidence,
	}, nil
}

// ---------------- HELPERS ----------------

func extractTitle(snippet string) string {
	m := fingerprint.TitleRegex.FindStringSubmatch(snippet)
	if len(m) < 2 {
		return ""
	}
	t := strings.TrimSpace(html.UnescapeString(m[1]))
	return strings.Join(strings.Fields(t), " ")
}

func snapshotHeaders(resp *http.Response) map[string]string {
	keep := []string{
		"Server",
		"X-Powered-By",
		"Content-Type",
		"Set-Cookie",
		"CF-RAY",
	}

	out := make(map[string]string)
	for _, k := range keep {
		if v := resp.Header.Get(k); v != "" {
			if len(v) > 180 {
				v = v[:180]
			}
			out[k] = v
		}
	}
	return out
}

// ---------------- STORAGE ----------------

func EndpointsFilePath(scanID int64, target string) string {
	safe := strings.NewReplacer("/", "_", ":", "_").Replace(target)
	return filepath.Join("data", fmt.Sprintf("endpoints_%d_%s.json", scanID, safe))
}

func saveEndpointsToFile(scanID int64, target string, eps []EndpointResult) (string, error) {
	if err := os.MkdirAll("data", 0755); err != nil {
		return "", err
	}

	path := EndpointsFilePath(scanID, target)

	payload := struct {
		ScanID    int64            `json:"scan_id"`
		Target    string           `json:"target"`
		Endpoints []EndpointResult `json:"endpoints"`
		SavedAt   time.Time        `json:"saved_at"`
	}{
		ScanID:    scanID,
		Target:    target,
		Endpoints: eps,
		SavedAt:   time.Now().UTC(),
	}

	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return path, enc.Encode(payload)
}

// ---------------- ENV ----------------

func getEnvOrDefault(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func getEnvIntOrDefault(k string, d int) int {
	v := os.Getenv(k)
	i, err := strconv.Atoi(v)
	if err != nil || i <= 0 {
		return d
	}
	return i
}
