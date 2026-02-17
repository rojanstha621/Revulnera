package scanner

import (
	"fmt"
	"log"
	"time"

	"recon/enum"
	"recon/probe"
)

// ScanResult holds comprehensive scan results for a domain.
type ScanResult struct {
	Domain       string            `json:"domain"`
	Subdomains   []string          `json:"subdomains"`
	HostChecks   []probe.HostCheck `json:"host_checks"`
	AliveHosts   int               `json:"alive_hosts"`
	TotalHosts   int               `json:"total_hosts"`
	ScanDuration time.Duration     `json:"scan_duration"`
	Error        string            `json:"error,omitempty"`
}

// ScanOptions configures the scanning behavior.
type ScanOptions struct {
	// Subdomain enumeration
	SubfinderBinary  string
	SubfinderTimeout time.Duration

	// Host probing
	ProbeWorkers     int
	ProbeHTTPTimeout time.Duration
	ProbeDNSTimeout  time.Duration
	UseHttpx         bool
	HttpxBinary      string
	HttpxTimeout     int
}

// DefaultScanOptions returns sensible defaults.
func DefaultScanOptions() *ScanOptions {
	return &ScanOptions{
		SubfinderBinary:  "subfinder",
		SubfinderTimeout: 120 * time.Second,
		ProbeWorkers:     10,
		ProbeHTTPTimeout: 10 * time.Second,
		ProbeDNSTimeout:  5 * time.Second,
		UseHttpx:         true,
		HttpxBinary:      "httpx",
		HttpxTimeout:     5,
	}
}

// ScanDomain performs a complete scan: subdomain enumeration + concurrent probing.
// This is the main high-level function you should use.
func ScanDomain(domain string, opts *ScanOptions) (*ScanResult, error) {
	if opts == nil {
		opts = DefaultScanOptions()
	}

	startTime := time.Now()
	result := &ScanResult{
		Domain: domain,
	}

	// Step 1: Enumerate subdomains
	log.Printf("[scanner] enumerating subdomains for %s", domain)
	subdomains, err := enum.EnumerateSubdomains(domain, &enum.SubfinderOptions{
		BinaryPath: opts.SubfinderBinary,
		Timeout:    opts.SubfinderTimeout,
	})
	if err != nil {
		result.Error = fmt.Sprintf("subdomain enumeration failed: %v", err)
		result.ScanDuration = time.Since(startTime)
		return result, err
	}

	result.Subdomains = subdomains
	result.TotalHosts = len(subdomains)
	log.Printf("[scanner] found %d subdomains", len(subdomains))

	if len(subdomains) == 0 {
		result.ScanDuration = time.Since(startTime)
		return result, nil
	}

	// Step 2: Probe all hosts concurrently
	log.Printf("[scanner] probing %d hosts with %d workers", len(subdomains), opts.ProbeWorkers)
	probeOpts := &probe.ProbeOptions{
		Workers:      opts.ProbeWorkers,
		HTTPTimeout:  opts.ProbeHTTPTimeout,
		DNSTimeout:   opts.ProbeDNSTimeout,
		UseHttpx:     opts.UseHttpx,
		HttpxBinary:  opts.HttpxBinary,
		HttpxTimeout: opts.HttpxTimeout,
	}

	hostChecks := probe.ProbeHosts(subdomains, probeOpts)
	result.HostChecks = hostChecks

	// Count alive hosts
	aliveCount := 0
	for _, check := range hostChecks {
		if check.Alive {
			aliveCount++
		}
	}
	result.AliveHosts = aliveCount

	result.ScanDuration = time.Since(startTime)
	log.Printf("[scanner] scan complete: %d/%d hosts alive in %s",
		aliveCount, len(hostChecks), result.ScanDuration)

	return result, nil
}

// ScanDomains scans multiple domains concurrently.
func ScanDomains(domains []string, opts *ScanOptions) []*ScanResult {
	if opts == nil {
		opts = DefaultScanOptions()
	}

	results := make([]*ScanResult, len(domains))

	// For now, scan domains sequentially to avoid overwhelming resources
	// You could parallelize this too if needed
	for i, domain := range domains {
		result, err := ScanDomain(domain, opts)
		if err != nil {
			log.Printf("[scanner] error scanning %s: %v", domain, err)
		}
		results[i] = result
	}

	return results
}

// GetAliveHosts returns only the hosts that are alive from scan results.
func GetAliveHosts(result *ScanResult) []probe.HostCheck {
	alive := make([]probe.HostCheck, 0)
	for _, check := range result.HostChecks {
		if check.Alive {
			alive = append(alive, check)
		}
	}
	return alive
}

// GetHostsWithErrors returns hosts that had errors during probing.
func GetHostsWithErrors(result *ScanResult) []probe.HostCheck {
	withErrors := make([]probe.HostCheck, 0)
	for _, check := range result.HostChecks {
		if check.ErrorMsg != "" {
			withErrors = append(withErrors, check)
		}
	}
	return withErrors
}
