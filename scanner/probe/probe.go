package probe

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// HostCheck represents the result of probing a single host.
type HostCheck struct {
	Host     string   `json:"host"`
	IPs      []string `json:"ips"`       // All resolved IPs (IPv4 + IPv6)
	Alive    bool     `json:"alive"`     // True if HTTP/HTTPS responsive
	ErrorMsg string   `json:"error_msg"` // Error details if any
}

// ProbeOptions configures the probing behavior.
type ProbeOptions struct {
	Workers      int           // Number of concurrent workers (default: 10)
	HTTPTimeout  time.Duration // Timeout for HTTP requests (default: 10s)
	DNSTimeout   time.Duration // Timeout for DNS resolution (default: 5s)
	UseHttpx     bool          // Try httpx first (default: true)
	HttpxBinary  string        // Path to httpx binary (default: "httpx")
	HttpxTimeout int           // Httpx timeout in seconds (default: 5)
}

// DefaultProbeOptions returns sensible defaults.
func DefaultProbeOptions() *ProbeOptions {
	return &ProbeOptions{
		Workers:      10,
		HTTPTimeout:  10 * time.Second,
		DNSTimeout:   5 * time.Second,
		UseHttpx:     true,
		HttpxBinary:  "httpx",
		HttpxTimeout: 5,
	}
}

// CheckHost probes a single host and returns its status.
// This is the legacy single-host function for backward compatibility.
func CheckHost(host string) HostCheck {
	return CheckHostWithOptions(host, DefaultProbeOptions())
}

// CheckHostWithOptions probes a single host with custom options.
func CheckHostWithOptions(host string, opts *ProbeOptions) HostCheck {
	if opts == nil {
		opts = DefaultProbeOptions()
	}

	host = strings.TrimSpace(host)
	res := HostCheck{
		Host:  host,
		IPs:   []string{},
		Alive: false,
	}

	// First resolve DNS to get all IPs
	ips, dnsErr := resolveAllIPs(host, opts.DNSTimeout)
	res.IPs = ips
	if dnsErr != nil {
		res.ErrorMsg = fmt.Sprintf("DNS resolution failed: %v", dnsErr)
		return res
	}

	if len(ips) == 0 {
		res.ErrorMsg = "No IPs resolved"
		return res
	}

	// Try httpx first if enabled
	if opts.UseHttpx {
		alive, httpxErr := checkWithHttpx(host, opts.HttpxBinary, opts.HttpxTimeout)
		if alive {
			res.Alive = true
			return res
		}
		// If httpx failed, try native Go HTTP fallback
		if httpxErr != nil && strings.Contains(httpxErr.Error(), "executable file not found") {
			// httpx not installed, fall through to native HTTP
		} else if httpxErr != nil {
			// httpx ran but failed - could be no web server
			res.ErrorMsg = fmt.Sprintf("httpx check failed: %v", httpxErr)
		}
	}

	// Fallback to native Go HTTP client
	alive, httpErr := checkWithNativeHTTP(host, opts.HTTPTimeout)
	res.Alive = alive
	if !alive && httpErr != nil {
		if res.ErrorMsg != "" {
			res.ErrorMsg += "; "
		}
		res.ErrorMsg += fmt.Sprintf("HTTP check failed: %v", httpErr)
	}

	return res
}

// ProbeHosts probes multiple hosts concurrently using a worker pool.
// This is the main concurrent function you should use for bulk probing.
func ProbeHosts(hosts []string, opts *ProbeOptions) []HostCheck {
	if opts == nil {
		opts = DefaultProbeOptions()
	}

	if len(hosts) == 0 {
		return []HostCheck{}
	}

	results := make([]HostCheck, len(hosts))
	jobs := make(chan int, len(hosts))
	var wg sync.WaitGroup

	// Spawn worker pool
	for i := 0; i < opts.Workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobs {
				results[idx] = CheckHostWithOptions(hosts[idx], opts)
			}
		}()
	}

	// Send jobs
	for i := range hosts {
		jobs <- i
	}
	close(jobs)

	// Wait for completion
	wg.Wait()

	return results
}

// checkWithHttpx runs httpx and returns (alive, error).
func checkWithHttpx(host, binary string, timeoutSec int) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec+5)*time.Second)
	defer cancel()

	// httpx -silent -u <host> -nc -timeout <sec>
	cmd := exec.CommandContext(ctx, binary, "-silent", "-u", host, "-nc", "-timeout", fmt.Sprintf("%d", timeoutSec))

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		// Check if httpx is not installed
		if strings.Contains(err.Error(), "executable file not found") {
			return false, fmt.Errorf("httpx not found: %w", err)
		}
		return false, fmt.Errorf("httpx error: %w (stderr: %s)", err, stderr.String())
	}

	// httpx outputs URLs that responded
	output := strings.TrimSpace(stdout.String())
	alive := strings.Contains(output, "http://") || strings.Contains(output, "https://")
	return alive, nil
}

// checkWithNativeHTTP tries HTTP and HTTPS requests using Go's http.Client.
// Returns (alive, error).
func checkWithNativeHTTP(host string, timeout time.Duration) (bool, error) {
	client := &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // Don't follow redirects
		},
	}

	schemes := []string{"https://", "http://"}
	var lastErr error

	for _, scheme := range schemes {
		url := scheme + host
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		cancel()

		if err != nil {
			lastErr = err
			continue
		}

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		resp.Body.Close()

		// Any response (even 4xx/5xx) means the host is alive
		if resp.StatusCode > 0 {
			return true, nil
		}
	}

	return false, lastErr
}

// resolveAllIPs performs DNS lookup and returns all IPs (IPv4 + IPv6).
func resolveAllIPs(host string, timeout time.Duration) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ips, err := net.DefaultResolver.LookupHost(ctx, host)
	if err != nil {
		return nil, err
	}

	// Deduplicate IPs
	seen := make(map[string]struct{})
	result := make([]string, 0, len(ips))
	for _, ip := range ips {
		if _, exists := seen[ip]; !exists {
			seen[ip] = struct{}{}
			result = append(result, ip)
		}
	}

	return result, nil
}
