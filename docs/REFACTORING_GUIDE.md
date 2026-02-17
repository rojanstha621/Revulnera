# Subdomain Enumeration & Host Probing Refactoring

## Overview

This document describes the major refactoring of the subdomain enumeration and host probing system. The refactored code provides:

- **Concurrent probing** with configurable worker pools
- **Enhanced HostCheck** with multiple IPs (IPv4 + IPv6) and error messages  
- **HTTP probing** with httpx as primary tool and native Go http.Client as fallback
- **Robust DNS resolution** with context timeouts and all IP addresses
- **Production-ready Go code** with proper error handling

---

## Architecture

### Package Structure

```
scanner/
├── enum/
│   └── subfinder.go        # Subdomain enumeration using subfinder
├── probe/
│   └── probe.go            # Concurrent host probing (HTTP/DNS)
├── scanner/
│   └── scanner.go          # High-level scanner orchestration
└── recon/
    └── job_handler.go      # Integration layer for scan jobs
```

---

## Go Package APIs

### 1. `probe` Package

#### Enhanced HostCheck Struct

```go
type HostCheck struct {
    Host     string   `json:"host"`       // Hostname being checked
    IPs      []string `json:"ips"`        // All resolved IPs (IPv4 + IPv6)
    Alive    bool     `json:"alive"`      // True if HTTP/HTTPS responsive
    ErrorMsg string   `json:"error_msg"`  // Error details if any
}
```

#### ProbeOptions Configuration

```go
type ProbeOptions struct {
    Workers        int           // Number of concurrent workers (default: 10)
    HTTPTimeout    time.Duration // Timeout for HTTP requests (default: 10s)
    DNSTimeout     time.Duration // Timeout for DNS resolution (default: 5s)
    UseHttpx       bool          // Try httpx first (default: true)
    HttpxBinary    string        // Path to httpx binary (default: "httpx")
    HttpxTimeout   int           // Httpx timeout in seconds (default: 5)
}
```

#### Main Functions

```go
// Check a single host (backward compatible)
func CheckHost(host string) HostCheck

// Check a single host with custom options
func CheckHostWithOptions(host string, opts *ProbeOptions) HostCheck

// Probe multiple hosts concurrently (RECOMMENDED for bulk operations)
func ProbeHosts(hosts []string, opts *ProbeOptions) []HostCheck
```

#### Example Usage

```go
package main

import (
    "fmt"
    "time"
    "recon/probe"
)

func main() {
    hosts := []string{
        "example.com",
        "test.example.com", 
        "api.example.com",
    }

    opts := &probe.ProbeOptions{
        Workers:      10,
        HTTPTimeout:  10 * time.Second,
        DNSTimeout:   5 * time.Second,
        UseHttpx:     true,
        HttpxBinary:  "httpx",
        HttpxTimeout: 5,
    }

    results := probe.ProbeHosts(hosts, opts)
    
    for _, result := range results {
        fmt.Printf("Host: %s\n", result.Host)
        fmt.Printf("  IPs: %v\n", result.IPs)
        fmt.Printf("  Alive: %v\n", result.Alive)
        if result.ErrorMsg != "" {
            fmt.Printf("  Error: %s\n", result.ErrorMsg)
        }
    }
}
```

---

### 2. `enum` Package

The subfinder enumeration package remains mostly unchanged but includes proper error handling and timeout support.

```go
type SubfinderOptions struct {
    BinaryPath string        // Path to subfinder binary
    Timeout    time.Duration // Timeout for enumeration
}

func EnumerateSubdomains(domain string, opts *SubfinderOptions) ([]string, error)
```

---

### 3. `scanner` Package (NEW)

High-level scanner orchestration that combines enumeration and probing.

#### ScanOptions Configuration

```go
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
```

#### Main Function

```go
func ScanDomain(domain string, opts *ScanOptions) (*ScanResult, error)
```

#### Example Usage

```go
package main

import (
    "fmt"
    "log"
    "recon/scanner"
)

func main() {
    opts := scanner.DefaultScanOptions()
    opts.ProbeWorkers = 20  // Increase concurrency

    result, err := scanner.ScanDomain("example.com", opts)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Domain: %s\n", result.Domain)
    fmt.Printf("Total Subdomains: %d\n", result.TotalHosts)
    fmt.Printf("Alive Hosts: %d\n", result.AliveHosts)
    fmt.Printf("Scan Duration: %s\n", result.ScanDuration)

    // Get only alive hosts
    alive := scanner.GetAliveHosts(result)
    for _, host := range alive {
        fmt.Printf("  %s -> %v\n", host.Host, host.IPs)
    }
}
```

---

## Django Backend Changes

### Model Updates

The `Subdomain` model now includes:

```python
class Subdomain(models.Model):
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="subdomains")
    name = models.CharField(max_length=255, db_index=True)
    ip = models.GenericIPAddressField(null=True, blank=True)  # Primary IP (backward compatible)
    ips = models.JSONField(default=list, blank=True)          # All IPs (NEW)
    alive = models.BooleanField(default=False)
    error_msg = models.TextField(blank=True, default="")      # Error details (NEW)
```

### Migration

Run the following to apply database changes:

```bash
cd backend
python manage.py migrate
```

The migration file is: `backend/reconscan/migrations/0004_subdomain_enhanced_fields.py`

### API Updates

The `/api/recon/scans/<scan_id>/ingest/subdomains/` endpoint now accepts:

```json
{
  "items": [
    {
      "name": "subdomain.example.com",
      "ip": "1.2.3.4",           // Primary IP (optional for backward compatibility)
      "ips": ["1.2.3.4", "::1"],  // All IPs (NEW)
      "alive": true,
      "error_msg": ""             // Error message if any (NEW)
    }
  ]
}
```

---

## Frontend Changes

### ScanDetail.jsx

The subdomain table now displays:

- **Multiple IPs** - Shows all resolved IPv4 and IPv6 addresses
- **Error Messages** - Displays error details if probing failed
- **Enhanced tooltips** - Shows full error message on hover

---

## Key Features

### 1. Concurrent Probing

- Uses a **worker pool** pattern with goroutines
- Configurable number of workers (default: 10)
- Non-blocking - slow hosts don't hold up the entire scan
- Proper synchronization with `sync.WaitGroup`

### 2. Robust HTTP Probing

**Strategy:**
1. Try `httpx` first (if installed and enabled)
2. If `httpx` fails or is not found, fallback to native Go `http.Client`
3. Test both `https://` and `http://` schemes
4. Accept any HTTP response (even 4xx/5xx) as "alive"

**Benefits:**
- Works even if `httpx` is not installed
- Insecure TLS verification for maximum compatibility
- Configurable timeouts

### 3. Enhanced DNS Resolution

```go
func resolveAllIPs(host string, timeout time.Duration) ([]string, error)
```

- Returns **all IPs** (both IPv4 and IPv6)
- Uses context with timeout
- Deduplicates results
- Proper error handling

### 4. Error Messages

Every `HostCheck` includes an `ErrorMsg` field that captures:
- DNS resolution failures
- HTTP connection errors
- Timeout errors
- httpx execution errors

This helps with debugging and understanding why hosts might be marked as offline.

---

## Performance Considerations

### Worker Pool Tuning

```go
opts := &probe.ProbeOptions{
    Workers: 20,  // Increase for faster scanning of many hosts
}
```

- **Low worker count (5-10):** Lower network load, slower scans
- **High worker count (20-50):** Faster scans, higher resource usage
- **Very high (50+):** May hit OS limits or network bottlenecks

### Timeouts

```go
opts := &probe.ProbeOptions{
    HTTPTimeout: 5 * time.Second,   // Reduce for faster scans
    DNSTimeout:  3 * time.Second,   // Reduce for faster scans
}
```

Shorter timeouts = faster scans but may miss slower hosts.

---

## Migration Guide

### For Existing Code Using Old `probe.CheckHost()`

**Old code:**
```go
check := probe.CheckHost("example.com")
fmt.Println(check.IP, check.Alive)
```

**Updated code (backward compatible):**
```go
check := probe.CheckHost("example.com")
fmt.Println(check.IPs[0], check.Alive)  // Use first IP
fmt.Println(check.ErrorMsg)              // Check for errors
```

### For Bulk Probing

**Old code (sequential):**
```go
for _, subdomain := range subdomains {
    check := probe.CheckHost(subdomain)
    // process check
}
```

**New code (concurrent - MUCH FASTER):**
```go
opts := probe.DefaultProbeOptions()
checks := probe.ProbeHosts(subdomains, opts)
for _, check := range checks {
    // process check
}
```

---

## Testing

### Test httpx Fallback

Test behavior when httpx is not installed:

```bash
# Temporarily rename httpx
sudo mv /usr/bin/httpx /usr/bin/httpx.backup

# Run scanner - should fallback to native Go HTTP
go run main.go

# Restore httpx
sudo mv /usr/bin/httpx.backup /usr/bin/httpx
```

### Test Concurrent Probing

```bash
cd scanner
go run -race main.go  # Race detector to catch concurrency issues
```

---

## Dependencies

### Go Packages

No new dependencies - uses only standard library:
- `net/http` - HTTP client
- `crypto/tls` - TLS configuration
- `context` - Timeout handling
- `sync` - Goroutine synchronization

### External Tools (Optional)

- **subfinder** - For subdomain enumeration (required)
- **httpx** - For HTTP probing (optional, has Go fallback)

---

## Troubleshooting

### "httpx not found" Errors

This is expected if httpx is not installed. The system will automatically fallback to native Go HTTP client.

To install httpx:
```bash
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
```

### DNS Resolution Timeouts

If you see many "DNS resolution failed: context deadline exceeded" errors, increase the DNS timeout:

```go
opts.DNSTimeout = 10 * time.Second
```

### Slow Scans

- Increase worker count: `opts.Workers = 20`
- Decrease timeouts: `opts.HTTPTimeout = 5 * time.Second`
- Disable httpx: `opts.UseHttpx = false` (native Go is sometimes faster)

### Rate Limiting / Network Errors

If you're hitting rate limits or network issues:
- Decrease worker count: `opts.Workers = 5`
- Increase timeouts: `opts.HTTPTimeout = 15 * time.Second`

---

## Summary of Changes

### Go Scanner

| File | Changes |
|------|---------|
| `probe/probe.go` | Complete rewrite with concurrency, multiple IPs, error messages, HTTP fallback |
| `scanner/scanner.go` | NEW - High-level scanner orchestration |
| `recon/job_handler.go` | Updated to use concurrent probing, handle new fields |
| `enum/subfinder.go` | Minor improvements (already had good error handling) |

### Django Backend

| File | Changes |
|------|---------|
| `models.py` | Added `ips` (JSONField) and `error_msg` (TextField) to Subdomain |
| `serializers.py` | Updated SubdomainSerializer to include new fields |
| `views.py` | Updated ingestion and detail views to handle new fields |
| `migrations/0004_*.py` | NEW - Migration for model changes |

### Frontend

| File | Changes |
|------|---------|
| `ScanDetail.jsx` | Display multiple IPs and error messages in subdomain table |

---

## Future Enhancements

Potential improvements for future iterations:

1. **Configurable retry logic** - Retry failed hosts before marking as dead
2. **Rate limiting** - Built-in rate limiter to avoid overwhelming targets
3. **IP geolocation** - Add location data for resolved IPs
4. **CDN detection** - Identify hosts behind CDNs (Cloudflare, Akamai, etc.)
5. **Port scanning integration** - Combine host probing with port detection
6. **Caching** - Cache DNS and HTTP results to avoid redundant checks

---

## License

Same as main project.

## Questions?

For questions or issues, please open a GitHub issue or contact the development team.
