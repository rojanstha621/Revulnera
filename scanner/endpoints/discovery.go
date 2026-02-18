package endpoints

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Global log callback for discovery progress messages
var discoveryLogCallback func(message, level string)

// SetDiscoveryLogCallback sets the callback for sending discovery progress logs
func SetDiscoveryLogCallback(callback func(message, level string)) {
	discoveryLogCallback = callback
}

// DiscoveryOptions configures dynamic endpoint discovery behavior
type DiscoveryOptions struct {
	UseGau            bool          // Enable gau for historical URLs (default: true)
	UseKatana         bool          // Enable katana for crawling (default: true)
	UseJSAnalysis     bool          // Enable JS file analysis (default: true)
	KatanaDepth       int           // Crawling depth for katana (default: 2)
	KatanaMaxPages    int           // Max pages to crawl per subdomain (default: 50)
	Timeout           time.Duration // Timeout per tool per host (default: 60s)
	Workers           int           // Concurrent workers for discovery (default: 5)
	GauBinary         string        // Path to gau (default: "gau")
	KatanaBinary      string        // Path to katana (default: "katana")
	MaxURLsPerHost    int           // Max URLs to collect per host (default: 500)
	FollowRedirects   bool          // Follow redirects in katana (default: true)
	IncludeSubdomains bool          // Include subdomains in crawl (default: false)
}

// DefaultDiscoveryOptions returns sensible defaults for dynamic discovery
func DefaultDiscoveryOptions() *DiscoveryOptions {
	return &DiscoveryOptions{
		UseGau:            true,
		UseKatana:         true,
		UseJSAnalysis:     true,
		KatanaDepth:       2,
		KatanaMaxPages:    50,
		Timeout:           60 * time.Second,
		Workers:           5,
		GauBinary:         "gau",
		KatanaBinary:      "katana",
		MaxURLsPerHost:    500,
		FollowRedirects:   true,
		IncludeSubdomains: false,
	}
}

// DiscoverURLsFromHosts performs dynamic endpoint discovery for given hosts
// Returns deduplicated, normalized URLs ready for probing
func DiscoverURLsFromHosts(ctx context.Context, hosts []string, opts *DiscoveryOptions) []string {
	if opts == nil {
		opts = DefaultDiscoveryOptions()
	}

	log.Printf("[discovery] starting dynamic discovery for %d hosts", len(hosts))

	urlChan := make(chan string, 1000)
	var wg sync.WaitGroup

	// Worker pool for concurrent host discovery
	jobs := make(chan string, len(hosts))
	for i := 0; i < opts.Workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for host := range jobs {
				// Check for cancellation
				select {
				case <-ctx.Done():
					log.Printf("[discovery] worker cancelled, stopping discovery")
					return
				default:
				}
				discoverURLsForHost(host, opts, urlChan)
			}
		}()
	}

	// Collect URLs in background
	allURLs := make([]string, 0)
	var collectWg sync.WaitGroup
	collectWg.Add(1)
	go func() {
		defer collectWg.Done()
		for url := range urlChan {
			allURLs = append(allURLs, url)
		}
	}()

	// Send jobs with cancellation check
	for _, host := range hosts {
		select {
		case <-ctx.Done():
			log.Printf("[discovery] context cancelled, stopping job distribution")
			close(jobs)
			wg.Wait()
			close(urlChan)
			collectWg.Wait()
			return allURLs
		case jobs <- host:
		}
	}
	close(jobs)

	// Wait for all discovery to complete
	wg.Wait()
	close(urlChan)

	// Wait for URL collection to complete
	collectWg.Wait()

	log.Printf("[discovery] collected %d raw URLs, normalizing and deduplicating", len(allURLs))
	if discoveryLogCallback != nil {
		discoveryLogCallback(fmt.Sprintf("📦 Collected %d raw URLs, normalizing...", len(allURLs)), "info")
	}

	// Normalize and deduplicate URLs
	normalized := normalizeAndDeduplicateURLs(allURLs, opts.MaxURLsPerHost*len(hosts))

	log.Printf("[discovery] final URL count: %d", len(normalized))
	return normalized
}

// discoverURLsForHost discovers URLs for a single host using all enabled methods
func discoverURLsForHost(host string, opts *DiscoveryOptions, urlChan chan<- string) {
	log.Printf("[discovery] discovering URLs for %s", host)
	if discoveryLogCallback != nil {
		discoveryLogCallback(fmt.Sprintf("🔍 Discovering URLs for %s...", host), "info")
	}

	var wg sync.WaitGroup

	// Run gau for historical URLs
	if opts.UseGau {
		wg.Add(1)
		go func() {
			defer wg.Done()
			urls := runGau(host, opts)
			for _, u := range urls {
				urlChan <- u
			}
		}()
	}

	// Run katana for crawling
	if opts.UseKatana {
		wg.Add(1)
		go func() {
			defer wg.Done()
			urls := runKatana(host, opts)
			for _, u := range urls {
				urlChan <- u
			}
		}()
	}

	// Wait for this host's discovery to complete
	wg.Wait()

	// If JS analysis is enabled, analyze discovered JS files
	// This happens after initial discovery to use found JS URLs
	if opts.UseJSAnalysis {
		// For now, we'll handle JS analysis inline during katana crawling
		// Katana has built-in JS parsing capability
		log.Printf("[discovery] JS analysis handled by katana for %s", host)
	}
}

// runGau executes gau and returns discovered URLs
func runGau(host string, opts *DiscoveryOptions) []string {
	ctx, cancel := context.WithTimeout(context.Background(), opts.Timeout)
	defer cancel()

	// gau --subs --blacklist ttf,woff,woff2,svg,png,jpg,jpeg,gif,ico <host>
	args := []string{
		"--blacklist", "ttf,woff,woff2,svg,png,jpg,jpeg,gif,ico,css,webp,mp4,mp3,avi,mov,pdf,zip,tar,gz",
		"--threads", "5",
		"--timeout", fmt.Sprintf("%d", int(opts.Timeout.Seconds())),
	}

	if opts.IncludeSubdomains {
		args = append(args, "--subs")
	}

	args = append(args, host)

	cmd := exec.CommandContext(ctx, opts.GauBinary, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if strings.Contains(err.Error(), "executable file not found") {
			log.Printf("[discovery] gau not installed, skipping gau for %s", host)
			if discoveryLogCallback != nil {
				discoveryLogCallback(fmt.Sprintf("⚠️ gau not installed, skipping for %s", host), "warning")
			}
			return []string{}
		}
		log.Printf("[discovery] gau error for %s: %v (stderr: %s)", host, err, stderr.String())
		if discoveryLogCallback != nil {
			discoveryLogCallback(fmt.Sprintf("❌ gau error for %s: %v", host, err), "warning")
		}
		return []string{}
	}

	urls := make([]string, 0)
	scanner := bufio.NewScanner(&stdout)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && strings.HasPrefix(line, "http") {
			urls = append(urls, line)
		}
	}

	log.Printf("[discovery] gau found %d URLs for %s", len(urls), host)
	if discoveryLogCallback != nil {
		discoveryLogCallback(fmt.Sprintf("✅ gau found %d URLs for %s", len(urls), host), "success")
	}
	return urls
}

// runKatana executes katana and returns discovered URLs
func runKatana(host string, opts *DiscoveryOptions) []string {
	ctx, cancel := context.WithTimeout(context.Background(), opts.Timeout)
	defer cancel()

	// Ensure host has a scheme
	if !strings.HasPrefix(host, "http://") && !strings.HasPrefix(host, "https://") {
		host = "https://" + host
	}

	// katana -u <url> -d <depth> -jc -kf -aff -silent -jsl -ef woff,css,png,svg,jpg,woff2,jpeg,gif,svg
	args := []string{
		"-u", host,
		"-d", fmt.Sprintf("%d", opts.KatanaDepth),
		"-ps", fmt.Sprintf("%d", opts.KatanaMaxPages),
		"-jc",                         // JavaScript parsing
		"-kf", "robotstxt,sitemapxml", // Known files
		"-aff", // Automatic form filling
		"-silent",
		"-jsl", // JavaScript link extraction
		"-timeout", fmt.Sprintf("%d", int(opts.Timeout.Seconds())),
		"-ef", "woff,woff2,ttf,eot,svg,png,jpg,jpeg,gif,ico,css,webp,mp4,mp3,avi,mov,pdf,zip,tar,gz,bmp,tiff",
		"-json", // JSON output for better parsing
	}

	if opts.FollowRedirects {
		args = append(args, "-rl", "5") // Follow up to 5 redirects
	}

	if !opts.IncludeSubdomains {
		args = append(args, "-ns") // No subdomains
	}

	cmd := exec.CommandContext(ctx, opts.KatanaBinary, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if strings.Contains(err.Error(), "executable file not found") {
			log.Printf("[discovery] katana not installed, skipping katana for %s", host)
			if discoveryLogCallback != nil {
				discoveryLogCallback(fmt.Sprintf("⚠️ katana not installed, skipping for %s", host), "warning")
			}
			return []string{}
		}
		log.Printf("[discovery] katana error for %s: %v (stderr: %s)", host, err, stderr.String())
		if discoveryLogCallback != nil {
			discoveryLogCallback(fmt.Sprintf("❌ katana error for %s", host), "warning")
		}
		return []string{}
	}

	urls := make([]string, 0)
	scanner := bufio.NewScanner(&stdout)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		// Try to parse as JSON first (katana -json output)
		var katanaOutput map[string]interface{}
		if err := json.Unmarshal([]byte(line), &katanaOutput); err == nil {
			if requestURL, ok := katanaOutput["request"].(map[string]interface{}); ok {
				if endpoint, ok := requestURL["endpoint"].(string); ok && endpoint != "" {
					urls = append(urls, endpoint)
					continue
				}
			}
		}

		// Fallback: treat as plain URL
		if strings.HasPrefix(line, "http") {
			urls = append(urls, line)
		}
	}

	log.Printf("[discovery] katana found %d URLs for %s", len(urls), host)
	if discoveryLogCallback != nil {
		discoveryLogCallback(fmt.Sprintf("✅ katana found %d URLs for %s", len(urls), host), "success")
	}
	return urls
}

// extractEndpointsFromJS extracts API endpoints from JavaScript content
// This regex-based approach looks for common endpoint patterns
func extractEndpointsFromJS(jsContent string) []string {
	endpoints := make([]string, 0)

	// Patterns to match API endpoints in JS
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`["'](/api/[^"'\s]+)["']`),
		regexp.MustCompile(`["'](/v\d+/[^"'\s]+)["']`),
		regexp.MustCompile(`["'](https?://[^"'\s]+)["']`),
		regexp.MustCompile(`fetch\s*\(\s*["']([^"']+)["']`),
		regexp.MustCompile(`axios\.[a-z]+\s*\(\s*["']([^"']+)["']`),
		regexp.MustCompile(`\$\.ajax\s*\(\s*["']([^"']+)["']`),
		regexp.MustCompile(`\$\.(get|post|put|delete)\s*\(\s*["']([^"']+)["']`),
		regexp.MustCompile(`["']([^"'\s]*\.(json|xml|txt))["']`),
	}

	for _, pattern := range patterns {
		matches := pattern.FindAllStringSubmatch(jsContent, -1)
		for _, match := range matches {
			if len(match) >= 2 {
				endpoint := match[1]
				if endpoint != "" && !strings.HasPrefix(endpoint, "//") {
					endpoints = append(endpoints, endpoint)
				}
			}
		}
	}

	return endpoints
}

// normalizeAndDeduplicateURLs performs URL normalization and deduplication
// Similar to uro tool behavior
func normalizeAndDeduplicateURLs(urls []string, maxURLs int) []string {
	seen := make(map[string]bool)
	normalized := make([]string, 0)

	for _, rawURL := range urls {
		// Parse URL
		parsedURL, err := url.Parse(rawURL)
		if err != nil {
			continue
		}

		// Skip invalid URLs
		if parsedURL.Host == "" || parsedURL.Scheme == "" {
			continue
		}

		// Normalize the URL
		normalizedURL := normalizeURL(parsedURL)

		// Deduplicate
		if !seen[normalizedURL] {
			seen[normalizedURL] = true
			normalized = append(normalized, normalizedURL)

			// Limit total URLs
			if len(normalized) >= maxURLs {
				break
			}
		}
	}

	return normalized
}

// normalizeURL performs URL normalization
func normalizeURL(u *url.URL) string {
	// Convert scheme to lowercase
	u.Scheme = strings.ToLower(u.Scheme)

	// Convert host to lowercase
	u.Host = strings.ToLower(u.Host)

	// Remove default ports
	if u.Scheme == "http" && strings.HasSuffix(u.Host, ":80") {
		u.Host = strings.TrimSuffix(u.Host, ":80")
	}
	if u.Scheme == "https" && strings.HasSuffix(u.Host, ":443") {
		u.Host = strings.TrimSuffix(u.Host, ":443")
	}

	// Remove fragment
	u.Fragment = ""

	// Sort query parameters for consistency
	if u.RawQuery != "" {
		query := u.Query()
		u.RawQuery = query.Encode()
	}

	// Remove trailing slash from path (except for root)
	if len(u.Path) > 1 && strings.HasSuffix(u.Path, "/") {
		u.Path = strings.TrimSuffix(u.Path, "/")
	}

	// Ensure root path
	if u.Path == "" {
		u.Path = "/"
	}

	return u.String()
}

// deduplicateByPattern performs intelligent deduplication
// Groups URLs by pattern and keeps representative samples
func deduplicateByPattern(urls []string) []string {
	patterns := make(map[string][]string)

	for _, rawURL := range urls {
		pattern := extractURLPattern(rawURL)
		patterns[pattern] = append(patterns[pattern], rawURL)
	}

	// Keep first URL from each pattern group
	deduplicated := make([]string, 0, len(patterns))
	for _, urlGroup := range patterns {
		if len(urlGroup) > 0 {
			deduplicated = append(deduplicated, urlGroup[0])
		}
	}

	return deduplicated
}

// extractURLPattern extracts a pattern from URL for grouping
// Example: /api/users/123 -> /api/users/{id}
func extractURLPattern(rawURL string) string {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}

	path := parsedURL.Path

	// Replace numeric IDs with placeholder
	numericPattern := regexp.MustCompile(`/\d+`)
	path = numericPattern.ReplaceAllString(path, "/{id}")

	// Replace UUIDs with placeholder
	uuidPattern := regexp.MustCompile(`/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`)
	path = uuidPattern.ReplaceAllString(path, "/{uuid}")

	// Replace hex strings (32+ chars) with placeholder
	hexPattern := regexp.MustCompile(`/[0-9a-fA-F]{32,}`)
	path = hexPattern.ReplaceAllString(path, "/{hash}")

	return parsedURL.Scheme + "://" + parsedURL.Host + path
}
