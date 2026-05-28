package endpoints

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"

	stdhtml "html"

	xhtml "golang.org/x/net/html"
)

type crawlScope struct {
	host       string
	pathPrefix string
}

func crawlApplicationEndpoints(ctx context.Context, target string, opts *DiscoveryOptions, auth *DiscoveryAuthConfig) []string {
	// Recursive BFS crawler for application-style targets.
	if opts == nil {
		opts = DefaultDiscoveryOptions()
	}

	startURLs, scope, err := buildCrawlSeedsAndScope(target)
	if err != nil || len(startURLs) == 0 {
		return []string{}
	}

	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Timeout: opts.Timeout,
		Jar:     jar,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
	if err := applyDiscoveryAuth(ctx, client, auth); err != nil {
		if discoveryLogCallback != nil {
			discoveryLogCallback(fmt.Sprintf("⚠️ Auto-login failed for %s: %v", target, err), "warning")
		}
	}

	maxDepth := opts.RecursiveDepth
	if maxDepth <= 0 {
		maxDepth = 5
	}
	maxPages := opts.RecursiveMaxPages
	if maxPages <= 0 {
		maxPages = 150
	}

	type crawlNode struct {
		URL   string
		Depth int
	}

	queue := make([]crawlNode, 0, len(startURLs))
	for _, seed := range startURLs {
		queue = append(queue, crawlNode{URL: seed, Depth: 0})
	}

	seen := make(map[string]struct{})
	results := make([]string, 0, maxPages)

	for len(queue) > 0 && len(seen) < maxPages {
		select {
		case <-ctx.Done():
			return results
		default:
		}

		node := queue[0]
		queue = queue[1:]

		parsed, err := url.Parse(node.URL)
		if err != nil || !scope.contains(parsed) {
			continue
		}

		normalized := normalizeCrawledURL(parsed)
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		results = append(results, normalized)

		if node.Depth >= maxDepth {
			continue
		}

		body, contentType, discovered, err := fetchAndExtractCrawlLinks(ctx, client, parsed, scope, auth)
		if err != nil {
			_ = body
			continue
		}

		if isJavaScriptContent(contentType, body) {
			discovered = append(discovered, extractEndpointsFromJS(string(body))...)
		}

		for _, raw := range discovered {
			resolved, ok := resolveScopedCrawlURL(parsed, raw, scope)
			if !ok {
				continue
			}
			if _, ok := seen[resolved]; ok {
				continue
			}
			queue = append(queue, crawlNode{URL: resolved, Depth: node.Depth + 1})
		}
	}

	return dedupePreserveOrder(results)
}

func buildCrawlSeedsAndScope(target string) ([]string, crawlScope, error) {
	parsed, err := parseApplicationTarget(target)
	if err != nil {
		return nil, crawlScope{}, err
	}

	scope := crawlScope{
		host:       strings.ToLower(parsed.Hostname()),
		pathPrefix: crawlPathPrefix(parsed.Path),
	}

	return []string{parsed.String()}, scope, nil
}

func parseApplicationTarget(target string) (*url.URL, error) {
	trimmed := strings.TrimSpace(target)
	if trimmed == "" {
		return nil, fmt.Errorf("empty target")
	}

	if strings.Contains(trimmed, "://") {
		parsed, err := url.Parse(trimmed)
		if err != nil {
			return nil, err
		}
		return parsed, nil
	}

	parsed, err := url.Parse("http://" + trimmed)
	if err != nil {
		return nil, err
	}
	if parsed.Scheme == "" {
		parsed.Scheme = "http"
	}
	return parsed, nil
}

func crawlPathPrefix(path string) string {
	path = strings.TrimSpace(path)
	if path == "" || path == "/" {
		return "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if !strings.HasSuffix(path, "/") {
		path += "/"
	}
	return path
}

func (s crawlScope) contains(u *url.URL) bool {
	if u == nil {
		return false
	}
	if strings.ToLower(u.Hostname()) != s.host {
		return false
	}
	if s.pathPrefix == "/" {
		return true
	}
	path := u.Path
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, s.pathPrefix) {
		return false
	}
	return true
}

func normalizeCrawledURL(u *url.URL) string {
	normalized := *u
	normalized.Fragment = ""
	return normalizeURL(&normalized)
}

func resolveScopedCrawlURL(base *url.URL, raw string, scope crawlScope) (string, bool) {
	raw = strings.TrimSpace(stdhtml.UnescapeString(raw))
	if raw == "" {
		return "", false
	}
	lower := strings.ToLower(raw)
	if strings.HasPrefix(lower, "javascript:") || strings.HasPrefix(lower, "mailto:") || strings.HasPrefix(lower, "tel:") {
		return "", false
	}
	if strings.HasPrefix(raw, "#") {
		return "", false
	}

	if shouldTreatAsScopeRootRelative(raw, scope) && !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return "", false
	}
	resolved := base.ResolveReference(parsed)
	if scope.contains(resolved) {
		return normalizeCrawledURL(resolved), true
	}

	if !parsed.IsAbs() && shouldTreatAsScopeRootRelative(raw, scope) {
		candidate := *resolved
		if !strings.HasPrefix(candidate.Path, "/") {
			candidate.Path = "/" + candidate.Path
		}
		if scope.contains(&candidate) {
			return normalizeCrawledURL(&candidate), true
		}
	}
	return "", false
}

func shouldTreatAsScopeRootRelative(raw string, scope crawlScope) bool {
	if scope.pathPrefix == "" || scope.pathPrefix == "/" {
		return false
	}
	trimmed := strings.Trim(scope.pathPrefix, "/")
	if trimmed == "" {
		return false
	}
	return raw == trimmed || strings.HasPrefix(raw, trimmed+"/") || strings.HasPrefix(raw, trimmed+"?")
}

func fetchAndExtractCrawlLinks(ctx context.Context, client *http.Client, pageURL *url.URL, scope crawlScope, auth *DiscoveryAuthConfig) ([]byte, string, []string, error) {
	if client == nil || pageURL == nil {
		return nil, "", nil, fmt.Errorf("invalid crawl input")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pageURL.String(), nil)
	if err != nil {
		return nil, "", nil, err
	}
	req.Header.Set("User-Agent", "RevulneraCrawler/1.0")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	if auth != nil {
		for key, value := range auth.Headers {
			if strings.TrimSpace(key) != "" {
				req.Header.Set(key, value)
			}
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", nil, err
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, contentType, nil, err
	}

	if !looksLikeHTML(contentType, body) && !isJavaScriptContent(contentType, body) {
		return body, contentType, nil, nil
	}

	if !looksLikeHTML(contentType, body) {
		return body, contentType, nil, nil
	}

	links := extractLinksFromHTML(pageURL, body, scope)
	return body, contentType, links, nil
}

func looksLikeHTML(contentType string, body []byte) bool {
	lower := strings.ToLower(contentType)
	if strings.Contains(lower, "text/html") || strings.Contains(lower, "application/xhtml+xml") {
		return true
	}
	snippet := strings.ToLower(string(body))
	return strings.Contains(snippet, "<html") || strings.Contains(snippet, "<body") || strings.Contains(snippet, "<form")
}

func isJavaScriptContent(contentType string, body []byte) bool {
	lower := strings.ToLower(contentType)
	if strings.Contains(lower, "javascript") || strings.Contains(lower, "ecmascript") {
		return true
	}
	snippet := strings.ToLower(string(body))
	return strings.Contains(snippet, "fetch(") || strings.Contains(snippet, "xmlhttprequest") || strings.Contains(snippet, "axios.")
}

func extractLinksFromHTML(pageURL *url.URL, body []byte, scope crawlScope) []string {
	root, err := xhtml.Parse(bytes.NewReader(body))
	if err != nil {
		return []string{}
	}

	seen := make(map[string]struct{})
	out := make([]string, 0)
	var walk func(*xhtml.Node)
	walk = func(n *xhtml.Node) {
		if n == nil {
			return
		}
		if n.Type == xhtml.ElementNode {
			tag := strings.ToLower(n.Data)
			switch tag {
			case "a", "link", "script", "iframe", "img", "source":
				for _, attr := range n.Attr {
					if isURLAttr(tag, attr.Key) {
						if resolved, ok := resolveScopedCrawlURL(pageURL, attr.Val, scope); ok {
							if _, exists := seen[resolved]; !exists {
								seen[resolved] = struct{}{}
								out = append(out, resolved)
							}
						}
					}
				}
			case "form":
				if formURLs := extractFormURLs(pageURL, n, scope); len(formURLs) > 0 {
					for _, u := range formURLs {
						if _, exists := seen[u]; !exists {
							seen[u] = struct{}{}
							out = append(out, u)
						}
					}
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(root)
	return out
}

func isURLAttr(tag, attr string) bool {
	attr = strings.ToLower(attr)
	switch tag {
	case "a", "link":
		return attr == "href"
	case "script", "iframe", "img", "source":
		return attr == "src" || attr == "href"
	default:
		return false
	}
}

func extractFormURLs(pageURL *url.URL, form *xhtml.Node, scope crawlScope) []string {
	if form == nil {
		return []string{}
	}

	action := ""
	method := "get"
	inputs := make([]string, 0)

	var walk func(*xhtml.Node)
	walk = func(n *xhtml.Node) {
		if n == nil {
			return
		}
		if n.Type == xhtml.ElementNode {
			tag := strings.ToLower(n.Data)
			switch tag {
			case "form":
				for _, attr := range n.Attr {
					switch strings.ToLower(attr.Key) {
					case "action":
						action = attr.Val
					case "method":
						method = strings.ToLower(strings.TrimSpace(attr.Val))
					}
				}
			case "input", "textarea", "select", "button":
				for _, attr := range n.Attr {
					if strings.ToLower(attr.Key) == "name" && strings.TrimSpace(attr.Val) != "" {
						inputs = append(inputs, strings.TrimSpace(attr.Val))
					}
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(form)

	if action == "" {
		action = pageURL.String()
	}

	resolved, ok := resolveScopedCrawlURL(pageURL, action, scope)
	if !ok {
		return []string{}
	}

	if strings.ToUpper(method) == "POST" || len(inputs) == 0 {
		return []string{resolved}
	}

	actionURL, err := url.Parse(resolved)
	if err != nil {
		return []string{resolved}
	}
	query := actionURL.Query()
	for _, name := range inputs {
		if query.Get(name) == "" {
			query.Set(name, "")
		}
	}
	actionURL.RawQuery = query.Encode()
	return []string{normalizeCrawledURL(actionURL)}
}

func dedupePreserveOrder(values []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, len(values))
	for _, value := range values {
		key := strings.ToLower(strings.TrimSpace(value))
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, value)
	}
	return out
}
