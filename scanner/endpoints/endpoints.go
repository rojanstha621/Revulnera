package endpoints

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"recon/fingerprint"
	"recon/recon"
)

const (
	defaultWorkerCount = 20
	defaultRPS         = 10
)

// Global log callback for progress messages
var globalLogCallback func(message, level string)

// SetLogCallback sets the callback for sending progress log messages
func SetLogCallback(callback func(message, level string)) {
	globalLogCallback = callback
}

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
// 2) dynamically discover endpoints using gau, katana, and JS analysis
// 3) normalize and deduplicate URLs
// 4) probe discovered endpoints
// 5) domain + endpoint fingerprinting
// 6) save results
func DiscoverEndpointsFromScan(ctx context.Context, userID int64, scanID int64, target string) ([]EndpointResult, error) {
	return DiscoverEndpointsFromScanWithCallback(ctx, userID, scanID, target, nil)
}

// DiscoverEndpointsFromScanWithCallback allows streaming results via callback
// Use SetLogCallback to enable progress log messages during discovery
func DiscoverEndpointsFromScanWithCallback(ctx context.Context, userID int64, scanID int64, target string, callback func(EndpointResult)) ([]EndpointResult, error) {
	subdomains, scanFile, err := recon.LoadSubdomainsForScan(userID, scanID, target)
	if err != nil {
		return nil, fmt.Errorf("load subdomains: %w", err)
	}
	log.Printf("[endpoints] loaded %d subdomains from %s", len(subdomains), scanFile)

	// Extract alive hosts for dynamic discovery
	aliveHosts := make([]string, 0)
	for _, s := range subdomains {
		if s.Alive {
			aliveHosts = append(aliveHosts, s.Name)
		}
	}

	if len(aliveHosts) == 0 {
		log.Printf("[endpoints] no alive hosts found, skipping endpoint discovery")
		return []EndpointResult{}, nil
	}

	log.Printf("[endpoints] starting dynamic discovery for %d alive hosts", len(aliveHosts))

	// Check for cancellation before starting discovery
	select {
	case <-ctx.Done():
		log.Printf("[endpoints] discovery cancelled before starting")
		return []EndpointResult{}, ctx.Err()
	default:
	}

	// Dynamic endpoint discovery using gau, katana, and JS analysis
	discoveryOpts := DefaultDiscoveryOptions()
	discoveryOpts.Workers = getEnvIntOrDefault("ENDPOINT_DISCOVERY_WORKERS", 5)
	discoveryOpts.KatanaDepth = getEnvIntOrDefault("KATANA_DEPTH", 2)
	discoveryOpts.MaxURLsPerHost = getEnvIntOrDefault("MAX_URLS_PER_HOST", 500)

	urls := DiscoverURLsFromHosts(ctx, aliveHosts, discoveryOpts)

	if len(urls) == 0 {
		log.Printf("[endpoints] no URLs discovered, falling back to basic paths")
		if globalLogCallback != nil {
			globalLogCallback("⚠️ No URLs discovered from gau/katana, using basic paths", "warning")
		}
		// Fallback: add basic root URLs
		for _, host := range aliveHosts {
			urls = append(urls, "https://"+host+"/", "http://"+host+"/")
		}
	} else {
		if globalLogCallback != nil {
			globalLogCallback(fmt.Sprintf("📊 Discovered %d unique URLs from gau/katana", len(urls)), "info")
		}
	}

	log.Printf("[endpoints] discovered %d unique URLs, starting probing", len(urls))
	if globalLogCallback != nil {
		globalLogCallback(fmt.Sprintf("🔍 Starting probing of %d URLs...", len(urls)), "info")
	}

	// Probe discovered URLs with streaming callback
	workers := getEnvIntOrDefault("ENDPOINT_WORKERS", defaultWorkerCount)
	rps := getEnvIntOrDefault("ENDPOINT_RPS", defaultRPS)

	results := probeURLsConcurrentlyWithCallback(urls, workers, rps, callback)

	log.Printf("[endpoints] probing complete: %d endpoints responding", len(results))
	if globalLogCallback != nil {
		globalLogCallback(fmt.Sprintf("✅ Probing complete: %d/%d endpoints responding", len(results), len(urls)), "success")
	}

	if _, err := saveEndpointsToFile(scanID, target, results); err != nil {
		log.Printf("[endpoints] save error: %v", err)
	}

	return results, nil
}

// ---------------- HTTPX INTEGRATION ----------------

// HttpxResponse matches httpx JSON output structure
type HttpxResponse struct {
	URL           string   `json:"url"`
	StatusCode    int      `json:"status_code"`
	ContentLength int      `json:"content_length"`
	Title         string   `json:"title"`
	Tech          []string `json:"tech"`
	Server        string   `json:"webserver"`
	ContentType   string   `json:"content_type"`
	ResponseTime  string   `json:"response_time"`
}

// probeURLsConcurrently uses httpx for efficient bulk probing
func probeURLsConcurrently(urls []string, workers int, rps int) []EndpointResult {
	return probeURLsConcurrentlyWithCallback(urls, workers, rps, nil)
}

// probeURLsConcurrentlyWithCallback allows streaming results via callback
func probeURLsConcurrentlyWithCallback(urls []string, workers int, rps int, callback func(EndpointResult)) []EndpointResult {
	// Try httpx first (much faster and more reliable)
	if results, err := probeWithHttpxCallback(urls, workers, rps, callback); err == nil && len(results) > 0 {
		log.Printf("[endpoints] httpx found %d results", len(results))
		return results
	}

	// Fallback to native Go implementation
	log.Printf("[endpoints] httpx failed, using native Go client")
	return probeWithNativeHTTPCallback(urls, workers, rps, callback)
}

// probeWithHttpx uses httpx tool for efficient probing
func probeWithHttpx(urls []string, workers int, rps int) ([]EndpointResult, error) {
	return probeWithHttpxCallback(urls, workers, rps, nil)
}

// probeWithHttpxCallback allows streaming results via callback
func probeWithHttpxCallback(urls []string, workers int, rps int, callback func(EndpointResult)) ([]EndpointResult, error) {
	// Create temp file for input URLs
	tmpfile, err := os.CreateTemp("", "httpx-input-*.txt")
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}
	defer os.Remove(tmpfile.Name())

	// Write URLs to temp file
	for _, url := range urls {
		fmt.Fprintln(tmpfile, url)
	}
	tmpfile.Close()

	// Run httpx with optimal flags
	args := []string{
		"-silent",
		"-json",
		"-l", tmpfile.Name(),
		"-threads", fmt.Sprintf("%d", workers),
		"-rate-limit", fmt.Sprintf("%d", rps),
		"-timeout", "7",
		"-retries", "1",
		"-status-code",
		"-content-length",
		"-title",
		"-tech-detect",
		"-web-server",
		"-content-type",
		"-response-time",
		"-match-code", "200,201,202,204,301,302,307,308,401,403,405",
		"-no-color",
	}

	cmd := exec.Command("httpx", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if strings.Contains(err.Error(), "executable file not found") {
			return nil, fmt.Errorf("httpx not installed")
		}
		return nil, fmt.Errorf("httpx error: %w (stderr: %s)", err, stderr.String())
	}

	// Parse JSON output
	results := make([]EndpointResult, 0)
	scanner := bufio.NewScanner(strings.NewReader(stdout.String()))

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var httpxResp HttpxResponse
		if err := json.Unmarshal([]byte(line), &httpxResp); err != nil {
			log.Printf("[endpoints] parse error: %v", err)
			continue
		}

		// Convert httpx response to our format
		result := EndpointResult{
			URL:           httpxResp.URL,
			StatusCode:    httpxResp.StatusCode,
			ContentLength: int64(httpxResp.ContentLength),
			Title:         httpxResp.Title,
			Headers:       make(map[string]string),
			Fingerprints:  httpxResp.Tech,
			Evidence:      make(map[string]string),
		}

		// Populate headers map
		if httpxResp.Server != "" {
			result.Headers["Server"] = httpxResp.Server
		}
		if httpxResp.ContentType != "" {
			result.Headers["Content-Type"] = httpxResp.ContentType
		}

		// Add evidence
		if httpxResp.ResponseTime != "" {
			result.Evidence["response_time"] = httpxResp.ResponseTime
		}

		results = append(results, result)

		// Immediately call callback if provided
		if callback != nil {
			callback(result)
		}
	}

	return results, nil
}

// probeWithNativeHTTP is the fallback implementation
func probeWithNativeHTTP(urls []string, workers int, rps int) []EndpointResult {
	return probeWithNativeHTTPCallback(urls, workers, rps, nil)
}

// probeWithNativeHTTPCallback allows streaming results via callback
func probeWithNativeHTTPCallback(urls []string, workers int, rps int, callback func(EndpointResult)) []EndpointResult {
	jobs := make(chan string, workers*2)
	results := make(chan EndpointResult, workers*2)

	client := &http.Client{
		Timeout: 7 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for url := range jobs {
				if res, err := probeURLNative(client, url); err == nil {
					results <- *res
				}
				time.Sleep(time.Second / time.Duration(rps)) // Simple rate limiting
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

		// Immediately call callback if provided
		if callback != nil {
			callback(r)
		}
	}
	return out
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

// probeURLNative is the native Go fallback implementation
func probeURLNative(client *http.Client, url string) (*EndpointResult, error) {
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

	// ENDPOINT FINGERPRINTING
	efp := fingerprint.FingerprintEndpoint(resp.StatusCode, title, headers)

	return &EndpointResult{
		URL:           url,
		StatusCode:    resp.StatusCode,
		ContentLength: resp.ContentLength,
		Title:         title,
		Headers:       headers,
		Fingerprints:  efp.Tags,
		Evidence:      efp.Evidence,
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
