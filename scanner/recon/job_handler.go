package recon

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"recon/enum"
	"recon/probe"
)

type Job struct {
	ScanID   int64                 `json:"scan_id"`
	Target   string                `json:"target"`
	UserID   int64                 `json:"user_id"` // User ID for file organization
	Workers  int                   `json:"workers"` // Optional: number of concurrent workers
	Callback func(SubdomainResult) `json:"-"`       // Optional: callback for streaming results
}

type SubdomainResult struct {
	Name     string   `json:"name"`
	IP       string   `json:"ip"`  // Primary IP (first one) for backward compatibility
	IPs      []string `json:"ips"` // All resolved IPs
	Alive    bool     `json:"alive"`
	ErrorMsg string   `json:"error_msg"` // Error details if any
}

// ScanFilePath returns the JSON path for a given user_id + scan_id + target.
// Organized as data/user_<user_id>/scan_<scan_id>_<target>.json
func ScanFilePath(userID int64, scanID int64, target string) string {
	dataDir := "data"

	// Create user-specific subdirectory
	userDir := filepath.Join(dataDir, fmt.Sprintf("user_%d", userID))

	safeTarget := strings.ReplaceAll(target, "/", "_")
	safeTarget = strings.ReplaceAll(safeTarget, ":", "_")

	filename := fmt.Sprintf("scan_%d_%s.json", scanID, safeTarget)
	return filepath.Join(userDir, filename)
}

// HandleJob: enum + liveness + save to file.
// Now uses concurrent probing with worker pool.
func HandleJob(job Job) ([]SubdomainResult, error) {
	log.Printf("[recon] starting job: scan_id=%d target=%s", job.ScanID, job.Target)

	enumDomain, directProbeHost := normalizeTargetForRecon(job.Target)

	// Start with a direct probe target so local/single-host scans still work
	// even when subdomain enumeration is not applicable.
	hostCandidates := make([]string, 0)
	if directProbeHost != "" {
		hostCandidates = append(hostCandidates, directProbeHost)
	}

	// Enumerate subdomains only for public domain targets.
	if enumDomain != "" {
		subdomains, err := enum.EnumerateSubdomains(enumDomain, &enum.SubfinderOptions{
			BinaryPath: "subfinder",
			Timeout:    120 * time.Second,
		})
		if err != nil {
			log.Printf("[recon] subfinder error for %s: %v", enumDomain, err)
			return nil, err
		}
		hostCandidates = append(hostCandidates, subdomains...)
	} else {
		fallbackHosts := enumerateLocalFallbackHosts(directProbeHost)
		hostCandidates = append(hostCandidates, fallbackHosts...)
		log.Printf("[recon] subfinder skipped for local/IP target: %s (fallback hosts=%d)", job.Target, len(fallbackHosts))
	}

	// Deduplicate while preserving order.
	seen := make(map[string]struct{}, len(hostCandidates))
	subdomains := make([]string, 0, len(hostCandidates))
	for _, h := range hostCandidates {
		h = strings.TrimSpace(strings.ToLower(h))
		if h == "" {
			continue
		}
		if _, exists := seen[h]; exists {
			continue
		}
		seen[h] = struct{}{}
		subdomains = append(subdomains, h)
	}

	if len(subdomains) == 0 {
		return nil, fmt.Errorf("no valid hosts derived from target: %s", job.Target)
	}

	log.Printf("[recon] prepared %d hosts, starting concurrent probing", len(subdomains))

	// Configure probe options
	workers := 10
	if job.Workers > 0 {
		workers = job.Workers
	}

	opts := &probe.ProbeOptions{
		Workers:      workers,
		HTTPTimeout:  10 * time.Second,
		DNSTimeout:   5 * time.Second,
		UseHttpx:     true,
		HttpxBinary:  "httpx",
		HttpxTimeout: 5,
	}

	// Probe all hosts concurrently with streaming callback
	results := make([]SubdomainResult, 0, len(subdomains))
	aliveCount := 0
	var resultsMutex sync.Mutex

	// Create callback for immediate streaming
	streamCallback := func(check probe.HostCheck) {
		primaryIP := ""
		if len(check.IPs) > 0 {
			primaryIP = check.IPs[0]
		}

		// Ensure ips is always an array, never null
		ips := check.IPs
		if ips == nil {
			ips = []string{}
		}

		result := SubdomainResult{
			Name:     check.Host,
			IP:       primaryIP,
			IPs:      ips,
			Alive:    check.Alive,
			ErrorMsg: check.ErrorMsg,
		}

		// Thread-safe result storage
		resultsMutex.Lock()
		results = append(results, result)
		if check.Alive {
			aliveCount++
		}
		resultsMutex.Unlock()

		// Call user-provided callback immediately (for real-time updates)
		if job.Callback != nil {
			job.Callback(result)
		}
	}

	// Probe all hosts with streaming
	probe.ProbeHostsWithCallback(subdomains, opts, streamCallback)

	log.Printf("[recon] probing complete: %d alive out of %d subdomains", aliveCount, len(results))

	if _, err := SaveSubdomainsToFile(job, results); err != nil {
		log.Printf("[recon] failed to save results for scan_id=%d: %v", job.ScanID, err)
	}

	log.Printf("[recon] job finished: scan_id=%d target=%s subdomains=%d alive=%d",
		job.ScanID, job.Target, len(results), aliveCount)

	return results, nil
}

func normalizeTargetForRecon(rawTarget string) (enumDomain string, probeHost string) {
	target := strings.TrimSpace(rawTarget)
	if target == "" {
		return "", ""
	}

	parsed := parseTargetAsURL(target)
	hostPort := strings.TrimSpace(parsed.Host)
	if hostPort == "" {
		hostPort = strings.TrimSpace(target)
	}

	// Remove path if user pasted target without scheme (e.g. localhost:3000/app).
	if i := strings.Index(hostPort, "/"); i >= 0 {
		hostPort = hostPort[:i]
	}

	probeHost = strings.ToLower(hostPort)
	hostname := strings.ToLower(parsed.Hostname())
	if hostname == "" {
		hostname = probeHost
		if h, _, err := net.SplitHostPort(probeHost); err == nil {
			hostname = h
		}
	}

	if hostname == "" || hostname == "localhost" || net.ParseIP(hostname) != nil {
		return "", probeHost
	}

	// Subfinder expects a domain (no scheme/port/path).
	return hostname, probeHost
}

func parseTargetAsURL(target string) *url.URL {
	if strings.Contains(target, "://") {
		if u, err := url.Parse(target); err == nil {
			return u
		}
	}

	// Handle bare host/host:port/path by giving url.Parse a scheme.
	u, err := url.Parse("http://" + target)
	if err != nil {
		return &url.URL{}
	}
	return u
}

// enumerateLocalFallbackHosts generates additional host candidates for local targets
// where subfinder is not applicable (e.g., localhost, *.localhost, host:port).
func enumerateLocalFallbackHosts(probeHost string) []string {
	hostOnly, port := splitHostAndPortLoose(strings.TrimSpace(strings.ToLower(probeHost)))
	if hostOnly == "" {
		return []string{}
	}

	// Start with the direct target host.
	candidates := []string{hostOnly}

	// Common local virtual-host naming patterns.
	if hostOnly == "localhost" || strings.HasSuffix(hostOnly, ".localhost") {
		candidates = append(candidates,
			"www.localhost",
			"api.localhost",
			"admin.localhost",
			"dev.localhost",
			"test.localhost",
			"staging.localhost",
			"app.localhost",
		)
	}

	// Add loopback aliases from /etc/hosts when available.
	candidates = append(candidates, readLoopbackHostAliases()...)

	seen := make(map[string]struct{}, len(candidates))
	out := make([]string, 0, len(candidates))
	for _, c := range candidates {
		c = strings.TrimSpace(strings.ToLower(c))
		if c == "" {
			continue
		}
		if port != "" && !strings.Contains(c, ":") {
			c = c + ":" + port
		}
		if _, exists := seen[c]; exists {
			continue
		}
		seen[c] = struct{}{}
		out = append(out, c)
	}

	// Ensure the original probe host is retained.
	if probeHost != "" {
		normalized := strings.TrimSpace(strings.ToLower(probeHost))
		if _, exists := seen[normalized]; !exists {
			out = append([]string{normalized}, out...)
		}
	}

	return out
}

func splitHostAndPortLoose(input string) (host string, port string) {
	if input == "" {
		return "", ""
	}

	if strings.Contains(input, "://") {
		if u, err := url.Parse(input); err == nil {
			input = u.Host
		}
	}

	if h, p, err := net.SplitHostPort(input); err == nil {
		return strings.Trim(h, "[]"), p
	}

	// Handle cases like localhost:3000 without brackets.
	if strings.Count(input, ":") == 1 {
		parts := strings.SplitN(input, ":", 2)
		if parts[0] != "" && parts[1] != "" {
			return strings.Trim(parts[0], "[]"), parts[1]
		}
	}

	return strings.Trim(input, "[]"), ""
}

func readLoopbackHostAliases() []string {
	f, err := os.Open("/etc/hosts")
	if err != nil {
		return []string{}
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	aliases := make([]string, 0)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		ip := fields[0]
		if ip != "127.0.0.1" && ip != "::1" {
			continue
		}

		for _, name := range fields[1:] {
			if strings.HasPrefix(name, "#") {
				break
			}
			aliases = append(aliases, name)
		}
	}

	return aliases
}

// SaveSubdomainsToFile writes the results as JSON to data/user_<user_id>/scan_<id>_<target>.json
func SaveSubdomainsToFile(job Job, subs []SubdomainResult) (string, error) {
	dataDir := "data"
	userDir := filepath.Join(dataDir, fmt.Sprintf("user_%d", job.UserID))

	// Create user-specific directory if it doesn't exist
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		return "", fmt.Errorf("creating user dir: %w", err)
	}

	path := ScanFilePath(job.UserID, job.ScanID, job.Target)

	payload := struct {
		ScanID     int64             `json:"scan_id"`
		Target     string            `json:"target"`
		Subdomains []SubdomainResult `json:"subdomains"`
		SavedAt    time.Time         `json:"saved_at"`
	}{
		ScanID:     job.ScanID,
		Target:     job.Target,
		Subdomains: subs,
		SavedAt:    time.Now().UTC(),
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

	log.Printf("[recon] saved %d subdomains to %s", len(subs), path)
	return path, nil
}

// LoadSubdomainsFromFile reads a JSON file and returns subdomains.
func LoadSubdomainsFromFile(path string) ([]SubdomainResult, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	var payload struct {
		ScanID     int64             `json:"scan_id"`
		Target     string            `json:"target"`
		Subdomains []SubdomainResult `json:"subdomains"`
		SavedAt    time.Time         `json:"saved_at"`
	}

	if err := json.NewDecoder(f).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode json: %w", err)
	}

	return payload.Subdomains, nil
}

// LoadSubdomainsForScan uses user_id + scan_id + target to compute the file path.
func LoadSubdomainsForScan(userID int64, scanID int64, target string) ([]SubdomainResult, string, error) {
	path := ScanFilePath(userID, scanID, target)
	subs, err := LoadSubdomainsFromFile(path)
	if err != nil {
		return nil, "", err
	}
	return subs, path, nil
}
