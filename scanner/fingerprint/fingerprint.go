package fingerprint

import (
	"regexp"
	"strconv"
	"strings"
)

// Result represents fingerprinting output.
type Result struct {
	Tags     []string          `json:"tags"`
	Evidence map[string]string `json:"evidence"`
}

// Analyze performs lightweight, heuristic fingerprinting.
func Analyze(
	statusCode int,
	title string,
	snippet string,
	headers map[string]string,
) Result {

	tags := make([]string, 0, 8)
	evidence := make(map[string]string)

	add := func(tag, key, value string) {
		for _, t := range tags {
			if t == tag {
				return
			}
		}
		tags = append(tags, tag)
		evidence[tag] = key + "=" + value
	}

	lower := strings.ToLower
	server := lower(headers["Server"])
	xpb := lower(headers["X-Powered-By"])
	ct := lower(headers["Content-Type"])
	cookies := lower(headers["Set-Cookie"])
	sn := lower(snippet)
	tl := lower(title)

	// ---------- Infra ----------
	if strings.Contains(server, "nginx") {
		add("nginx", "Server", headers["Server"])
	}
	if strings.Contains(server, "apache") {
		add("apache", "Server", headers["Server"])
	}
	if strings.Contains(server, "cloudflare") || headers["CF-RAY"] != "" {
		add("cloudflare", "Header", "CF-RAY/Server")
	}
	if strings.Contains(server, "iis") {
		add("iis", "Server", headers["Server"])
	}

	// ---------- Language / runtime ----------
	if strings.Contains(xpb, "php") || strings.Contains(cookies, "phpsessid") {
		add("php", "X-Powered-By/Set-Cookie", headers["X-Powered-By"])
	}
	if strings.Contains(xpb, "express") {
		add("node-express", "X-Powered-By", headers["X-Powered-By"])
	}
	if strings.Contains(cookies, "asp.net") {
		add("asp.net", "Set-Cookie", headers["Set-Cookie"])
	}

	// ---------- Frameworks ----------
	if strings.Contains(cookies, "csrftoken") || strings.Contains(cookies, "sessionid") {
		add("django-likely", "Set-Cookie", headers["Set-Cookie"])
	}
	if strings.Contains(cookies, "laravel_session") {
		add("laravel", "Set-Cookie", headers["Set-Cookie"])
	}
	if strings.Contains(sn, "wp-content") || strings.Contains(sn, "wp-includes") {
		add("wordpress", "html", "wp-content/wp-includes")
	}

	// ---------- Frontend ----------
	if strings.Contains(sn, "react") || strings.Contains(sn, "data-reactroot") {
		add("react", "html", "react markers")
	}
	if strings.Contains(sn, "__next") {
		add("nextjs", "html", "__next")
	}
	if strings.Contains(sn, "angular") || strings.Contains(sn, "ng-version") {
		add("angular-likely", "html", "angular markers")
	}

	// ---------- Content ----------
	if strings.Contains(ct, "application/json") {
		add("json-api", "Content-Type", headers["Content-Type"])
	}
	if strings.Contains(ct, "text/html") {
		add("html", "Content-Type", headers["Content-Type"])
	}

	// ---------- Admin tools ----------
	if strings.Contains(tl, "grafana") {
		add("grafana-likely", "title", title)
	}
	if strings.Contains(tl, "jenkins") {
		add("jenkins-likely", "title", title)
	}

	// ---------- Status class ----------
	switch {
	case statusCode >= 200 && statusCode < 300:
		add("2xx", "status", strconv.Itoa(statusCode))
	case statusCode >= 300 && statusCode < 400:
		add("3xx", "status", strconv.Itoa(statusCode))
	case statusCode >= 400 && statusCode < 500:
		add("4xx", "status", strconv.Itoa(statusCode))
	case statusCode >= 500:
		add("5xx", "status", strconv.Itoa(statusCode))
	}

	return Result{
		Tags:     tags,
		Evidence: evidence,
	}
}

// Small reusable regex helpers (future expansion)
var (
	TitleRegex = regexp.MustCompile(`(?is)<\s*title[^>]*>(.*?)<\s*/\s*title\s*>`)
)
