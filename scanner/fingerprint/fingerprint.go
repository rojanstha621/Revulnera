package fingerprint

import (
	"regexp"
	"strconv"
	"strings"
)

type Result struct {
	Tags     []string          `json:"tags"`
	Evidence map[string]string `json:"evidence"`
}

type DomainResult struct {
	Tags     []string
	Evidence map[string]string
}

func newResult() Result {
	return Result{
		Tags:     make([]string, 0, 8),
		Evidence: make(map[string]string),
	}
}

func addTag(tags *[]string, evidence map[string]string, tag, key, value string) {
	for _, t := range *tags {
		if t == tag {
			return
		}
	}
	*tags = append(*tags, tag)
	evidence[tag] = key + "=" + value
}

/*
DOMAIN‑LEVEL FINGERPRINTING
Runs ONCE per host
*/
func FingerprintDomain(headers map[string]string, body string) DomainResult {
	res := DomainResult{
		Tags:     []string{},
		Evidence: map[string]string{},
	}

	l := strings.ToLower
	server := l(headers["Server"])
	xpb := l(headers["X-Powered-By"])
	cookies := l(headers["Set-Cookie"])
	html := l(body)

	// Infra
	if strings.Contains(server, "nginx") {
		addTag(&res.Tags, res.Evidence, "nginx", "Server", headers["Server"])
	}
	if strings.Contains(server, "apache") {
		addTag(&res.Tags, res.Evidence, "apache", "Server", headers["Server"])
	}
	if headers["CF-RAY"] != "" {
		addTag(&res.Tags, res.Evidence, "cloudflare", "Header", "CF-RAY")
	}

	// Runtime
	if strings.Contains(xpb, "php") || strings.Contains(cookies, "phpsessid") {
		addTag(&res.Tags, res.Evidence, "php", "runtime", "php")
	}
	if strings.Contains(xpb, "express") {
		addTag(&res.Tags, res.Evidence, "nodejs", "runtime", "express")
	}

	// CMS / Framework
	if strings.Contains(html, "wp-content") {
		addTag(&res.Tags, res.Evidence, "wordpress", "html", "wp-content")
	}
	if strings.Contains(cookies, "laravel_session") {
		addTag(&res.Tags, res.Evidence, "laravel", "cookie", "laravel_session")
	}
	if strings.Contains(cookies, "csrftoken") {
		addTag(&res.Tags, res.Evidence, "django", "cookie", "csrftoken")
	}

	// Frontend
	if strings.Contains(html, "__next") {
		addTag(&res.Tags, res.Evidence, "nextjs", "html", "__next")
	}
	if strings.Contains(html, "data-reactroot") {
		addTag(&res.Tags, res.Evidence, "react", "html", "data-reactroot")
	}
	if strings.Contains(html, "ng-version") {
		addTag(&res.Tags, res.Evidence, "angular", "html", "ng-version")
	}

	return res
}

/*
ENDPOINT‑LEVEL FINGERPRINTING
Runs for EVERY endpoint
*/
func FingerprintEndpoint(
	status int,
	title string,
	headers map[string]string,
) Result {

	res := newResult()

	ct := strings.ToLower(headers["Content-Type"])
	tl := strings.ToLower(title)

	if strings.Contains(ct, "application/json") {
		addTag(&res.Tags, res.Evidence, "json-api", "Content-Type", headers["Content-Type"])
	}
	if strings.Contains(ct, "text/html") {
		addTag(&res.Tags, res.Evidence, "html", "Content-Type", headers["Content-Type"])
	}

	// Admin panels
	if strings.Contains(tl, "grafana") {
		addTag(&res.Tags, res.Evidence, "grafana", "title", title)
	}
	if strings.Contains(tl, "jenkins") {
		addTag(&res.Tags, res.Evidence, "jenkins", "title", title)
	}
	if strings.Contains(tl, "admin") {
		addTag(&res.Tags, res.Evidence, "admin-panel", "title", title)
	}

	// Status
	switch {
	case status >= 200 && status < 300:
		addTag(&res.Tags, res.Evidence, "2xx", "status", strconv.Itoa(status))
	case status >= 300 && status < 400:
		addTag(&res.Tags, res.Evidence, "3xx", "status", strconv.Itoa(status))
	case status >= 400 && status < 500:
		addTag(&res.Tags, res.Evidence, "4xx", "status", strconv.Itoa(status))
	case status >= 500:
		addTag(&res.Tags, res.Evidence, "5xx", "status", strconv.Itoa(status))
	}

	return res
}

var TitleRegex = regexp.MustCompile(`(?is)<\s*title[^>]*>(.*?)<\s*/\s*title\s*>`)
