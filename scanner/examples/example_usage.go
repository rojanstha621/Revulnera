package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"recon/probe"
	"recon/scanner"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run example_usage.go <domain>")
		fmt.Println("Example: go run example_usage.go example.com")
		os.Exit(1)
	}

	domain := os.Args[1]

	fmt.Printf("=== Subdomain Enumeration & Host Probing Demo ===\n\n")
	fmt.Printf("Target Domain: %s\n\n", domain)

	// Example 1: Using the high-level scanner package
	fmt.Println("--- Method 1: Using scanner.ScanDomain() ---")
	scanExample(domain)

	// Example 2: Manual probing with custom options
	fmt.Println("\n--- Method 2: Manual probing with custom options ---")
	manualProbeExample()

	// Example 3: Single host check
	fmt.Println("\n--- Method 3: Single host check ---")
	singleHostExample("google.com")
}

func scanExample(domain string) {
	// Configure scan options
	opts := scanner.DefaultScanOptions()
	opts.ProbeWorkers = 15 // Use 15 concurrent workers
	opts.ProbeHTTPTimeout = 8 * time.Second

	fmt.Printf("Starting full scan with %d workers...\n", opts.ProbeWorkers)
	startTime := time.Now()

	// Perform the scan
	result, err := scanner.ScanDomain(domain, opts)
	if err != nil {
		log.Printf("Scan error: %v\n", err)
		return
	}

	// Display results
	fmt.Printf("\nScan completed in %s\n", time.Since(startTime))
	fmt.Printf("Results:\n")
	fmt.Printf("  Total Subdomains: %d\n", result.TotalHosts)
	fmt.Printf("  Alive Hosts: %d\n", result.AliveHosts)
	fmt.Printf("  Dead Hosts: %d\n", result.TotalHosts-result.AliveHosts)

	// Show alive hosts
	if result.AliveHosts > 0 {
		fmt.Printf("\nAlive Hosts:\n")
		alive := scanner.GetAliveHosts(result)
		for i, host := range alive {
			if i >= 10 {
				fmt.Printf("  ... and %d more\n", len(alive)-10)
				break
			}
			fmt.Printf("  ✓ %s\n", host.Host)
			for _, ip := range host.IPs {
				fmt.Printf("      └─ %s\n", ip)
			}
		}
	}

	// Show hosts with errors
	hostsWithErrors := scanner.GetHostsWithErrors(result)
	if len(hostsWithErrors) > 0 {
		fmt.Printf("\nHosts with Errors: %d\n", len(hostsWithErrors))
		for i, host := range hostsWithErrors {
			if i >= 5 {
				fmt.Printf("  ... and %d more\n", len(hostsWithErrors)-5)
				break
			}
			fmt.Printf("  ✗ %s: %s\n", host.Host, host.ErrorMsg)
		}
	}

	// Export to JSON
	jsonData, _ := json.MarshalIndent(result, "", "  ")
	filename := fmt.Sprintf("scan_result_%s.json", domain)
	os.WriteFile(filename, jsonData, 0644)
	fmt.Printf("\nFull results exported to: %s\n", filename)
}

func manualProbeExample() {
	hosts := []string{
		"google.com",
		"github.com",
		"stackoverflow.com",
		"reddit.com",
		"twitter.com",
	}

	// Custom probe options
	opts := &probe.ProbeOptions{
		Workers:      5,
		HTTPTimeout:  10 * time.Second,
		DNSTimeout:   5 * time.Second,
		UseHttpx:     true,
		HttpxBinary:  "httpx",
		HttpxTimeout: 5,
	}

	fmt.Printf("Probing %d hosts with custom options...\n", len(hosts))
	results := probe.ProbeHosts(hosts, opts)

	fmt.Printf("\nResults:\n")
	for _, result := range results {
		status := "✗ Dead"
		if result.Alive {
			status = "✓ Alive"
		}
		fmt.Printf("  %s %s\n", status, result.Host)
		if len(result.IPs) > 0 {
			fmt.Printf("      IPs: %v\n", result.IPs)
		}
		if result.ErrorMsg != "" {
			fmt.Printf("      Error: %s\n", result.ErrorMsg)
		}
	}
}

func singleHostExample(host string) {
	fmt.Printf("Checking single host: %s\n", host)

	// Simple check with defaults
	result := probe.CheckHost(host)

	fmt.Printf("Results:\n")
	fmt.Printf("  Host: %s\n", result.Host)
	fmt.Printf("  Alive: %v\n", result.Alive)
	fmt.Printf("  IPs: %v\n", result.IPs)
	if result.ErrorMsg != "" {
		fmt.Printf("  Error: %s\n", result.ErrorMsg)
	}

	// Custom check
	customOpts := &probe.ProbeOptions{
		Workers:      1,
		HTTPTimeout:  5 * time.Second,
		DNSTimeout:   3 * time.Second,
		UseHttpx:     false, // Force use of native Go HTTP client
		HttpxBinary:  "",
		HttpxTimeout: 0,
	}

	fmt.Printf("\nWith custom options (native Go HTTP):\n")
	result2 := probe.CheckHostWithOptions(host, customOpts)
	fmt.Printf("  Host: %s\n", result2.Host)
	fmt.Printf("  Alive: %v\n", result2.Alive)
	fmt.Printf("  IPs: %v\n", result2.IPs)
	if result2.ErrorMsg != "" {
		fmt.Printf("  Error: %s\n", result2.ErrorMsg)
	}
}
