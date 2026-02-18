package fingerprint

import (
	"encoding/json"
	"io"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

type Result struct {
	Tags     []string          `json:"tags"`
	Evidence map[string]string `json:"evidence"`
}

type DomainResult struct {
	Tags     []string
	Evidence map[string]string
}

// ============================================================
// WAPPALYZER-STYLE TECH FINGERPRINTING
// ============================================================

// TechSignature defines a technology signature pattern
type TechSignature struct {
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	HeaderRegex []string `json:"header_regex"`
	CookieRegex []string `json:"cookie_regex"`
	BodyRegex   []string `json:"body_regex"`
	ScriptRegex []string `json:"script_regex"`
	MetaRegex   []string `json:"meta_regex"`
}

// TechResult represents a detected technology
type TechResult struct {
	Name       string   `json:"name"`
	Category   string   `json:"category"`
	Confidence int      `json:"confidence"`
	Evidence   []string `json:"evidence"`
}

// CompiledSignature contains pre-compiled regex patterns
type CompiledSignature struct {
	Name        string
	Category    string
	HeaderRegex []*regexp.Regexp
	CookieRegex []*regexp.Regexp
	BodyRegex   []*regexp.Regexp
	ScriptRegex []*regexp.Regexp
	MetaRegex   []*regexp.Regexp
}

// FingerprintEngine manages technology detection
type FingerprintEngine struct {
	signatures []CompiledSignature
	mu         sync.RWMutex
}

// Global engine instance
var (
	engine     *FingerprintEngine
	engineOnce sync.Once
)

// GetEngine returns the singleton fingerprint engine
func GetEngine() *FingerprintEngine {
	engineOnce.Do(func() {
		engine = &FingerprintEngine{
			signatures: []CompiledSignature{},
		}
	})
	return engine
}

// LoadSignatures loads technology signatures from a JSON file
func (e *FingerprintEngine) LoadSignatures(filepath string) error {
	log.Printf("[Fingerprint] Loading signatures from: %s", filepath)

	file, err := os.Open(filepath)
	if err != nil {
		// If file doesn't exist, use built-in signatures
		log.Printf("[Fingerprint] Warning: Could not open signatures file: %v", err)
		log.Printf("[Fingerprint] Using built-in signatures instead")
		e.loadBuiltInSignatures()
		return nil
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		log.Printf("[Fingerprint] Error reading signatures file: %v", err)
		e.loadBuiltInSignatures()
		return nil
	}

	var signatures []TechSignature
	if err := json.Unmarshal(data, &signatures); err != nil {
		log.Printf("[Fingerprint] Error parsing signatures JSON: %v", err)
		e.loadBuiltInSignatures()
		return nil
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	log.Printf("[Fingerprint] Compiling %d technology signatures...", len(signatures))

	for _, sig := range signatures {
		compiled := CompiledSignature{
			Name:     sig.Name,
			Category: sig.Category,
		}

		// Compile header regex patterns
		for _, pattern := range sig.HeaderRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.HeaderRegex = append(compiled.HeaderRegex, re)
			} else {
				log.Printf("[Fingerprint] Warning: Invalid header regex for %s: %v", sig.Name, err)
			}
		}

		// Compile cookie regex patterns
		for _, pattern := range sig.CookieRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.CookieRegex = append(compiled.CookieRegex, re)
			} else {
				log.Printf("[Fingerprint] Warning: Invalid cookie regex for %s: %v", sig.Name, err)
			}
		}

		// Compile body regex patterns
		for _, pattern := range sig.BodyRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.BodyRegex = append(compiled.BodyRegex, re)
			} else {
				log.Printf("[Fingerprint] Warning: Invalid body regex for %s: %v", sig.Name, err)
			}
		}

		// Compile script regex patterns
		for _, pattern := range sig.ScriptRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.ScriptRegex = append(compiled.ScriptRegex, re)
			} else {
				log.Printf("[Fingerprint] Warning: Invalid script regex for %s: %v", sig.Name, err)
			}
		}

		// Compile meta regex patterns
		for _, pattern := range sig.MetaRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.MetaRegex = append(compiled.MetaRegex, re)
			} else {
				log.Printf("[Fingerprint] Warning: Invalid meta regex for %s: %v", sig.Name, err)
			}
		}

		e.signatures = append(e.signatures, compiled)
	}

	log.Printf("[Fingerprint] Successfully compiled %d signatures", len(e.signatures))
	return nil
}

// loadBuiltInSignatures loads a default set of technology signatures
func (e *FingerprintEngine) loadBuiltInSignatures() {
	log.Printf("[Fingerprint] Loading built-in signatures")

	builtIn := []TechSignature{
		{Name: "WordPress", Category: "CMS", BodyRegex: []string{`wp-content`, `wp-includes`}, MetaRegex: []string{`WordPress`}},
		{Name: "Drupal", Category: "CMS", BodyRegex: []string{`Drupal\.settings`}, HeaderRegex: []string{`X-Drupal-Cache`}, CookieRegex: []string{`SESS[a-z0-9]{32}`}},
		{Name: "Joomla", Category: "CMS", BodyRegex: []string{`/components/com_`}, MetaRegex: []string{`Joomla`}},
		{Name: "Nginx", Category: "Web Server", HeaderRegex: []string{`nginx`}},
		{Name: "Apache", Category: "Web Server", HeaderRegex: []string{`Apache`}},
		{Name: "Cloudflare", Category: "CDN", HeaderRegex: []string{`CF-RAY`, `__cfduid`}, CookieRegex: []string{`__cfduid`}},
		{Name: "PHP", Category: "Programming Language", HeaderRegex: []string{`X-Powered-By.*PHP`, `PHP/`}, CookieRegex: []string{`PHPSESSID`}},
		{Name: "Node.js", Category: "Programming Language", HeaderRegex: []string{`X-Powered-By.*Express`}},
		{Name: "React", Category: "JavaScript Framework", BodyRegex: []string{`data-reactroot`, `_react`, `__REACT`}, ScriptRegex: []string{`react\.js`, `react\.min\.js`}},
		{Name: "Vue.js", Category: "JavaScript Framework", BodyRegex: []string{`data-v-`, `__vue__`}, ScriptRegex: []string{`vue\.js`, `vue\.min\.js`}},
		{Name: "Angular", Category: "JavaScript Framework", BodyRegex: []string{`ng-version`, `ng-app`}, ScriptRegex: []string{`angular\.js`}},
		{Name: "Next.js", Category: "JavaScript Framework", BodyRegex: []string{`__NEXT_DATA__`, `_next/static`}, ScriptRegex: []string{`_next/static`}},
		{Name: "jQuery", Category: "JavaScript Library", ScriptRegex: []string{`jquery\.js`, `jquery\.min\.js`}},
		{Name: "Bootstrap", Category: "UI Framework", BodyRegex: []string{`bootstrap\.css`, `bootstrap\.min\.css`}, ScriptRegex: []string{`bootstrap\.js`}},
		{Name: "Laravel", Category: "Web Framework", CookieRegex: []string{`laravel_session`}, BodyRegex: []string{`laravel`}},
		{Name: "Django", Category: "Web Framework", CookieRegex: []string{`csrftoken`, `sessionid`}, HeaderRegex: []string{`X-Frame-Options.*SAMEORIGIN`}},
		{Name: "Ruby on Rails", Category: "Web Framework", HeaderRegex: []string{`X-Powered-By.*Phusion Passenger`}, CookieRegex: []string{`_.*_session`}},
		{Name: "Express", Category: "Web Framework", HeaderRegex: []string{`X-Powered-By.*Express`}},
		{Name: "Jenkins", Category: "CI/CD", BodyRegex: []string{`Jenkins`}, HeaderRegex: []string{`X-Jenkins`}},
		{Name: "Grafana", Category: "Monitoring", BodyRegex: []string{`grafana`}, CookieRegex: []string{`grafana_session`}},
		{Name: "Fastly", Category: "CDN", HeaderRegex: []string{`X-Served-By.*cache`, `Fastly`}},
		{Name: "Amazon CloudFront", Category: "CDN", HeaderRegex: []string{`X-Amz-Cf-Id`, `CloudFront`}},
		{Name: "Google Analytics", Category: "Analytics", ScriptRegex: []string{`google-analytics\.com/analytics\.js`, `googletagmanager\.com/gtag`}},
		{Name: "Stripe", Category: "Payment", ScriptRegex: []string{`js\.stripe\.com`}},
		{Name: "PayPal", Category: "Payment", ScriptRegex: []string{`paypal\.com/sdk`}},
	}

	// Convert built-in signatures to JSON and load them
	jsonData, _ := json.Marshal(builtIn)
	var signatures []TechSignature
	json.Unmarshal(jsonData, &signatures)

	// Compile patterns
	for _, sig := range signatures {
		compiled := CompiledSignature{
			Name:     sig.Name,
			Category: sig.Category,
		}

		for _, pattern := range sig.HeaderRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.HeaderRegex = append(compiled.HeaderRegex, re)
			}
		}
		for _, pattern := range sig.CookieRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.CookieRegex = append(compiled.CookieRegex, re)
			}
		}
		for _, pattern := range sig.BodyRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.BodyRegex = append(compiled.BodyRegex, re)
			}
		}
		for _, pattern := range sig.ScriptRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.ScriptRegex = append(compiled.ScriptRegex, re)
			}
		}
		for _, pattern := range sig.MetaRegex {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				compiled.MetaRegex = append(compiled.MetaRegex, re)
			}
		}

		e.signatures = append(e.signatures, compiled)
	}

	log.Printf("[Fingerprint] Loaded %d built-in signatures", len(e.signatures))
}

// ExtractedData contains all data extracted from HTTP response
type ExtractedData struct {
	Headers    map[string]string
	Cookies    []string
	Body       string
	ScriptSrcs []string
	MetaTags   map[string]string
}

// ExtractResponseData extracts fingerprinting data from HTTP response (max 20KB body)
func ExtractResponseData(headers map[string]string, bodyReader io.Reader) (*ExtractedData, error) {
	data := &ExtractedData{
		Headers:    headers,
		Cookies:    []string{},
		ScriptSrcs: []string{},
		MetaTags:   make(map[string]string),
	}

	// Extract cookies from Set-Cookie header
	if setCookie, ok := headers["Set-Cookie"]; ok {
		// Split multiple cookies if present
		cookies := strings.Split(setCookie, ",")
		for _, cookie := range cookies {
			cookie = strings.TrimSpace(cookie)
			if cookie != "" {
				data.Cookies = append(data.Cookies, cookie)
			}
		}
	}

	// Read body (limit to 20KB)
	const maxBodySize = 20 * 1024 // 20KB
	limitedReader := io.LimitReader(bodyReader, maxBodySize)
	bodyBytes, err := io.ReadAll(limitedReader)
	if err != nil {
		log.Printf("[Fingerprint] Warning: Error reading body: %v", err)
		return data, nil
	}

	data.Body = string(bodyBytes)

	// Extract script src URLs
	scriptRegex := regexp.MustCompile(`(?i)<script[^>]+src=["']([^"']+)["']`)
	scriptMatches := scriptRegex.FindAllStringSubmatch(data.Body, -1)
	for _, match := range scriptMatches {
		if len(match) > 1 {
			data.ScriptSrcs = append(data.ScriptSrcs, match[1])
		}
	}

	// Extract meta generator tags
	metaRegex := regexp.MustCompile(`(?i)<meta[^>]+name=["']([^"']+)["'][^>]+content=["']([^"']+)["']`)
	metaMatches := metaRegex.FindAllStringSubmatch(data.Body, -1)
	for _, match := range metaMatches {
		if len(match) > 2 {
			data.MetaTags[strings.ToLower(match[1])] = match[2]
		}
	}

	// Also check reversed order (content before name)
	metaRegex2 := regexp.MustCompile(`(?i)<meta[^>]+content=["']([^"']+)["'][^>]+name=["']([^"']+)["']`)
	metaMatches2 := metaRegex2.FindAllStringSubmatch(data.Body, -1)
	for _, match := range metaMatches2 {
		if len(match) > 2 {
			data.MetaTags[strings.ToLower(match[2])] = match[1]
		}
	}

	log.Printf("[Fingerprint] Extracted: %d headers, %d cookies, %d scripts, %d meta tags, body size: %d bytes",
		len(data.Headers), len(data.Cookies), len(data.ScriptSrcs), len(data.MetaTags), len(data.Body))

	return data, nil
}

// DetectTechnologies analyzes extracted data and returns detected technologies
func (e *FingerprintEngine) DetectTechnologies(data *ExtractedData) []TechResult {
	e.mu.RLock()
	defer e.mu.RUnlock()

	results := make(map[string]*TechResult)

	log.Printf("[Fingerprint] Analyzing against %d signatures...", len(e.signatures))

	for _, sig := range e.signatures {
		confidence := 0
		evidence := []string{}

		// Check headers
		for headerKey, headerValue := range data.Headers {
			for _, re := range sig.HeaderRegex {
				if re.MatchString(headerKey + ": " + headerValue) {
					confidence += 25
					evidence = append(evidence, "Header: "+headerKey)
					break
				}
			}
		}

		// Check cookies
		for _, cookie := range data.Cookies {
			for _, re := range sig.CookieRegex {
				if re.MatchString(cookie) {
					confidence += 25
					evidence = append(evidence, "Cookie: "+extractCookieName(cookie))
					break
				}
			}
		}

		// Check body
		for _, re := range sig.BodyRegex {
			if re.MatchString(data.Body) {
				confidence += 20
				match := re.FindString(data.Body)
				if len(match) > 50 {
					match = match[:50] + "..."
				}
				evidence = append(evidence, "Body: "+match)
				break
			}
		}

		// Check script sources
		for _, src := range data.ScriptSrcs {
			for _, re := range sig.ScriptRegex {
				if re.MatchString(src) {
					confidence += 30
					evidence = append(evidence, "Script: "+src)
					break
				}
			}
		}

		// Check meta tags
		for metaName, metaContent := range data.MetaTags {
			for _, re := range sig.MetaRegex {
				if re.MatchString(metaName + " " + metaContent) {
					confidence += 30
					evidence = append(evidence, "Meta: "+metaName)
					break
				}
			}
		}

		// If we found any evidence, add to results
		if confidence > 0 {
			// Cap confidence at 100
			if confidence > 100 {
				confidence = 100
			}

			results[sig.Name] = &TechResult{
				Name:       sig.Name,
				Category:   sig.Category,
				Confidence: confidence,
				Evidence:   evidence,
			}

			log.Printf("[Fingerprint] Detected: %s (Category: %s, Confidence: %d%%)",
				sig.Name, sig.Category, confidence)
		}
	}

	// Convert map to slice
	resultSlice := make([]TechResult, 0, len(results))
	for _, result := range results {
		resultSlice = append(resultSlice, *result)
	}

	log.Printf("[Fingerprint] Total technologies detected: %d", len(resultSlice))
	return resultSlice
}

// extractCookieName extracts the cookie name from a Set-Cookie header value
func extractCookieName(cookie string) string {
	parts := strings.Split(cookie, "=")
	if len(parts) > 0 {
		return strings.TrimSpace(parts[0])
	}
	return cookie
}

// ============================================================
// ORIGINAL FINGERPRINTING FUNCTIONS (PRESERVED)
// ============================================================

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
