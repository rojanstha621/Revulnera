package probe

import (
	"testing"
	"time"
)

func TestCheckHost(t *testing.T) {
	result := CheckHost("google.com")

	if result.Host != "google.com" {
		t.Errorf("Expected host 'google.com', got '%s'", result.Host)
	}

	if len(result.IPs) == 0 {
		t.Error("Expected at least one IP address")
	}

	t.Logf("google.com test - Alive: %v, IPs: %v", result.Alive, result.IPs)
}

func TestCheckHostWithInvalidDomain(t *testing.T) {
	result := CheckHost("this-domain-definitely-does-not-exist-12345.com")

	if len(result.IPs) > 0 {
		t.Error("Expected no IPs for non-existent domain")
	}

	if result.Alive {
		t.Error("Non-existent domain should not be alive")
	}

	if result.ErrorMsg == "" {
		t.Error("Expected error message for non-existent domain")
	}

	t.Logf("Invalid domain test - ErrorMsg: %s", result.ErrorMsg)
}

func TestProbeHosts(t *testing.T) {
	hosts := []string{
		"google.com",
		"github.com",
		"nonexistent-domain-12345.com",
	}

	opts := &ProbeOptions{
		Workers:      3,
		HTTPTimeout:  10 * time.Second,
		DNSTimeout:   5 * time.Second,
		UseHttpx:     false,
		HttpxBinary:  "",
		HttpxTimeout: 0,
	}

	results := ProbeHosts(hosts, opts)

	if len(results) != len(hosts) {
		t.Errorf("Expected %d results, got %d", len(hosts), len(results))
	}

	hostMap := make(map[string]HostCheck)
	for _, r := range results {
		hostMap[r.Host] = r
	}

	for _, host := range hosts {
		if _, exists := hostMap[host]; !exists {
			t.Errorf("Missing result for host: %s", host)
		}
	}

	for _, r := range results {
		t.Logf("Host: %s, Alive: %v, IPs: %v, Error: %s",
			r.Host, r.Alive, r.IPs, r.ErrorMsg)
	}
}

func TestDefaultProbeOptions(t *testing.T) {
	opts := DefaultProbeOptions()

	if opts.Workers <= 0 {
		t.Error("Workers should be positive")
	}

	if opts.HTTPTimeout <= 0 {
		t.Error("HTTPTimeout should be positive")
	}

	if opts.DNSTimeout <= 0 {
		t.Error("DNSTimeout should be positive")
	}

	t.Logf("Default options: Workers=%d, HTTPTimeout=%s, DNSTimeout=%s",
		opts.Workers, opts.HTTPTimeout, opts.DNSTimeout)
}
