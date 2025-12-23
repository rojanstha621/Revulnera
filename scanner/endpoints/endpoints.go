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

type EndpointResult struct {
	URL           string            `json:"url"`
	StatusCode    int               `json:"status_code"`
	ContentLength int64             `json:"content_length"`
	Title         string            `json:"title"`
	Headers       map[string]string `json:"headers"`

	Fingerprints []string          `json:"fingerprints"`
	Evidence     map[string]string `json:"evidence"`
}

// DiscoverEndpointsFromScan:
//  1) loads subdomains (from data/scan_<id>_<target>.json)
//  2) filters only Alive == true
//  3) builds URLs from schemes + wordlist file
//  4) probes them with a worker pool + global RPS limiter
//  5) keeps only meaningful statuses (2xx/3xx/401/403/405)
//  6) fingerprints only kept endpoints
//  7) saves results to data/endpoints_<id>_<target>.json
func DiscoverEndpointsFromScan(scanID int64, target string) ([]EndpointResult, error) {
	subdomains, scanFile, err := recon.LoadSubdomainsForScan(scanID, target)
	if err != nil {
		return nil, fmt.Errorf("load subdomains: %w", err)
	}
	log.Printf("[endpoints] loaded %d subdomains from %s", len(subdomains), scanFile)

	wordlistPath := getEnvOrDefault("ENDPOINT_WORDLIST", defaultWordlistPath)
	paths, err := loadWordlist(wordlistPath)
	if err != nil {
		return nil, fmt.Errorf("load wordlist: %w", err)
	}
	log.Printf("[endpoints] loaded %d paths from %s", len(paths), wordlistPath)

	schemes := []string{"http", "https"}

	// Build all URLs to probe (alive subdomains only)
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
	log.Printf("[endpoints] built %d URLs to probe", len(urls))

	workerCount := getEnvIntOrDefault("ENDPOINT_WORKERS", defaultWorkerCount)
	rps := getEnvIntOrDefault("ENDPOINT_RPS", defaultRPS)
	if rps <= 0 {
		rps = defaultRPS
	}
	log.Printf("[endpoints] using %d workers, global rate limit %d req/s", workerCount, rps)

	results := probeURLsConcurrently(urls, workerCount, rps)

	// Save endpoints to file in data/
	if _, err := saveEndpointsToFile(scanID, target, results); err != nil {
		log.Printf("[endpoints] failed to save endpoints for scan_id=%d: %v", scanID, err)
	}

	log.Printf("[endpoints] kept %d endpoints (filtered) for scan_id=%d target=%s",
		len(results), scanID, target)

	return results, nil
}

// ---------------- WORDLIST ----------------

func loadWordlist(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open wordlist: %w", err)
	}
	defer f.Close()

	var paths []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if !strings.HasPrefix(line, "/") {
			line = "/" + line
		}
		paths = append(paths, line)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read wordlist: %w", err)
	}
	return paths, nil
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

	// initial burst
	for i := 0; i < rps; i++ {
		rl.tokens <- struct{}{}
	}

	// refill evenly
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

func (rl *RateLimiter) Acquire() { <-rl.tokens }

// ---------------- CONCURRENT PROBING ----------------

func probeURLsConcurrently(urls []string, workerCount int, rps int) []EndpointResult {
	if workerCount <= 0 {
		workerCount = 10
	}

	jobs := make(chan string, workerCount*2)
	resultsCh := make(chan EndpointResult, workerCount*2)

	client := &http.Client{Timeout: 7 * time.Second}
	limiter := NewRateLimiter(rps)

	var wg sync.WaitGroup
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for url := range jobs {
				if res, err := probeURL(client, limiter, url); err == nil {
					resultsCh <- *res
				}
			}
		}()
	}

	// feed jobs
	go func() {
		for _, url := range urls {
			jobs <- url
		}
		close(jobs)
	}()

	// close results when done
	go func() {
		wg.Wait()
		close(resultsCh)
	}()

	results := make([]EndpointResult, 0)
	for res := range resultsCh {
		results = append(results, res)
	}
	return results
}

// ---------------- PROBE + FILTER + FINGERPRINT ----------------

// Only keep endpoints that likely represent real routes/content.
// We intentionally drop 404/410 and most 4xx noise.
func shouldKeepStatus(code int) bool {
	// Keep all 2xx and 3xx
	if code >= 200 && code < 400 {
		return true
	}
	// Keep common "real but protected" or "real but method-restricted"
	switch code {
	case 401, 403, 405:
		return true
	default:
		return false
	}
}

func probeURL(client *http.Client, limiter *RateLimiter, url string) (*EndpointResult, error) {
	limiter.Acquire()

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "RevulneraRecon/1.0")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Filter early: do NOT fingerprint/store endpoints that are noise (404 etc.)
	if !shouldKeepStatus(resp.StatusCode) {
		return nil, fmt.Errorf("ignored status %d", resp.StatusCode)
	}

	// Read only first 4KB for title + fingerprinting
	const maxBytes = 4096
	buf := make([]byte, maxBytes)
	n, _ := resp.Body.Read(buf)
	snippet := ""
	if n > 0 {
		snippet = string(buf[:n])
	}

	title := extractTitleFromSnippet(snippet)
	headers := snapshotHeaders(resp)

	fp := fingerprint.Analyze(
		resp.StatusCode,
		title,
		snippet,
		headers,
	)

	return &EndpointResult{
		URL:           url,
		StatusCode:    resp.StatusCode,
		ContentLength: resp.ContentLength,
		Title:         title,
		Headers:       headers,
		Fingerprints:  fp.Tags,
		Evidence:      fp.Evidence,
	}, nil
}

func extractTitleFromSnippet(snippet string) string {
	m := fingerprint.TitleRegex.FindStringSubmatch(snippet)
	if len(m) < 2 {
		return ""
	}
	t := strings.TrimSpace(html.UnescapeString(m[1]))
	t = strings.Join(strings.Fields(t), " ")
	if len(t) > 200 {
		t = t[:200]
	}
	return t
}

func snapshotHeaders(resp *http.Response) map[string]string {
	keep := []string{
		"Server",
		"X-Powered-By",
		"Content-Type",
		"Set-Cookie",
		"Via",
		"CF-RAY",
		"X-Frame-Options",
	}

	out := make(map[string]string)
	for _, k := range keep {
		v := resp.Header.Get(k)
		if v == "" {
			continue
		}
		if len(v) > 180 {
			v = v[:180]
		}
		out[k] = v
	}
	return out
}

// ---------------- FILE STORAGE ----------------

func EndpointsFilePath(scanID int64, target string) string {
	dataDir := "data"
	safeTarget := strings.ReplaceAll(target, "/", "_")
	safeTarget = strings.ReplaceAll(safeTarget, ":", "_")
	filename := fmt.Sprintf("endpoints_%d_%s.json", scanID, safeTarget)
	return filepath.Join(dataDir, filename)
}

func saveEndpointsToFile(scanID int64, target string, eps []EndpointResult) (string, error) {
	dataDir := "data"
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return "", fmt.Errorf("creating data dir: %w", err)
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
		return "", fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(&payload); err != nil {
		return "", fmt.Errorf("encode json: %w", err)
	}

	log.Printf("[endpoints] saved %d endpoints to %s", len(eps), path)
	return path, nil
}

// ---------------- HELPERS ----------------

func getEnvOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvIntOrDefault(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	i, err := strconv.Atoi(v)
	if err != nil || i <= 0 {
		return def
	}
	return i
}