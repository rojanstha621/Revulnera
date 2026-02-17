# Quick Start - Refactored Scanner

## TL;DR

The scanner has been refactored for better performance, robustness, and maintainability:

- ✅ **Concurrent probing** - Scan multiple hosts in parallel (10x+ faster)
- ✅ **Multiple IPs** - Returns IPv4 + IPv6 addresses
- ✅ **Better error handling** - Know exactly why a host failed
- ✅ **HTTP fallback** - Works without httpx using native Go
- ✅ **Backward compatible** - Existing code still works

---

## Installation

### Prerequisites

```bash
# Required: subfinder
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# Optional but recommended: httpx (for faster HTTP probing)
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest

# Make sure they're in PATH
export PATH=$PATH:~/go/bin
```

### Setup

```bash
cd /home/aaila/Documents/Development/revulnera

# 1. Build the Go scanner
cd scanner
go build -o scanner_bin .

# 2. Apply database migrations
cd ../backend
python manage.py migrate

# 3. Install frontend dependencies (if needed)
cd ../frontend
npm install
```

---

## Usage

### Option 1: Run Example Demo

```bash
cd scanner
go run example_usage.go example.com
```

This will demonstrate:
- Full domain scan with subdomain enumeration
- Manual probing with custom options
- Single host checking

### Option 2: Use in Your Code

#### Simple Single Host Check

```go
import "recon/probe"

result := probe.CheckHost("example.com")
fmt.Printf("Alive: %v, IPs: %v\n", result.Alive, result.IPs)
```

#### Concurrent Bulk Probing (RECOMMENDED)

```go
import "recon/probe"

hosts := []string{"sub1.example.com", "sub2.example.com", "sub3.example.com"}
opts := probe.DefaultProbeOptions()
opts.Workers = 20  // Adjust based on your needs

results := probe.ProbeHosts(hosts, opts)
for _, r := range results {
    if r.Alive {
        fmt.Printf("✓ %s: %v\n", r.Host, r.IPs)
    }
}
```

#### Full Domain Scan

```go
import "recon/scanner"

result, err := scanner.ScanDomain("example.com", scanner.DefaultScanOptions())
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Found %d subdomains, %d alive\n", result.TotalHosts, result.AliveHosts)
```

### Option 3: Run Full System

#### Start Backend

```bash
cd backend
python manage.py runserver
```

#### Start Frontend

```bash
cd frontend
npm run dev
```

#### Start Go Scanner Worker

```bash
cd scanner
./scanner_bin
```

Then use the web interface to trigger scans.

---

## Performance Tuning

### Fast Scan (More Resources)

```go
opts := scanner.DefaultScanOptions()
opts.ProbeWorkers = 50           // More concurrent workers
opts.ProbeHTTPTimeout = 5 * time.Second
opts.ProbeDNSTimeout = 3 * time.Second
```

### Conservative Scan (Less Resources)

```go
opts := scanner.DefaultScanOptions()
opts.ProbeWorkers = 5            // Fewer workers
opts.ProbeHTTPTimeout = 15 * time.Second
opts.ProbeDNSTimeout = 10 * time.Second
```

### Without httpx (Native Go Only)

```go
opts := scanner.DefaultScanOptions()
opts.UseHttpx = false  // Disable httpx, use native Go HTTP client
```

---

## API Changes

### Go Structs

**Old:**
```go
type HostCheck struct {
    IP    string
    Alive bool
}
```

**New:**
```go
type HostCheck struct {
    Host     string   // Added
    IPs      []string // Changed from single IP
    Alive    bool
    ErrorMsg string   // Added
}
```

### Django Models

**Old:**
```python
class Subdomain(models.Model):
    name = models.CharField(max_length=255)
    ip = models.GenericIPAddressField(null=True, blank=True)
    alive = models.BooleanField(default=False)
```

**New:**
```python
class Subdomain(models.Model):
    name = models.CharField(max_length=255)
    ip = models.GenericIPAddressField(null=True, blank=True)  # Primary IP
    ips = models.JSONField(default=list, blank=True)          # All IPs (NEW)
    alive = models.BooleanField(default=False)
    error_msg = models.TextField(blank=True, default="")      # NEW
```

### REST API

**POST /api/recon/scans/{scan_id}/ingest/subdomains/**

**Old:**
```json
{
  "items": [
    {"name": "sub.example.com", "ip": "1.2.3.4", "alive": true}
  ]
}
```

**New (backward compatible):**
```json
{
  "items": [
    {
      "name": "sub.example.com",
      "ip": "1.2.3.4",
      "ips": ["1.2.3.4", "::1"],
      "alive": true,
      "error_msg": ""
    }
  ]
}
```

---

## Testing

### Test Concurrent Probing

```bash
cd scanner
go test -v ./probe/
```

### Test httpx Fallback

```bash
# Temporarily disable httpx
which httpx && sudo mv $(which httpx) $(which httpx).backup

# Run scanner - should automatically use Go fallback
go run example_usage.go example.com

# Restore httpx
sudo mv $(which httpx).backup $(which httpx)
```

### Test Race Conditions

```bash
cd scanner
go test -race ./...
```

---

## Troubleshooting

### Problem: "subfinder: executable file not found"

**Solution:** Install subfinder:
```bash
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
```

### Problem: "httpx: executable file not found" (Warning Only)

This is not an error! The scanner automatically falls back to native Go HTTP client.

To install httpx (optional):
```bash
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
```

### Problem: Slow scanning

**Solutions:**
- Increase workers: `opts.ProbeWorkers = 30`
- Decrease timeouts: `opts.ProbeHTTPTimeout = 5 * time.Second`
- Disable httpx: `opts.UseHttpx = false` (sometimes faster)

### Problem: Too many errors / timeouts

**Solutions:**
- Decrease workers: `opts.ProbeWorkers = 5`
- Increase timeouts: `opts.ProbeHTTPTimeout = 15 * time.Second`

### Problem: Database migration errors

```bash
cd backend
python manage.py migrate --fake-initial  # If tables already exist
# OR
python manage.py migrate reconscan 0003  # Rollback
python manage.py migrate  # Re-apply
```

---

## What's Different?

| Feature | Before | After |
|---------|--------|-------|
| Probing Speed | Sequential (1 host at a time) | Concurrent (10-50 hosts at a time) |
| IP Addresses | Single IP | Multiple IPs (IPv4 + IPv6) |
| Error Handling | Silent failures | Detailed error messages |
| HTTP Fallback | httpx only | httpx + native Go fallback |
| Worker Pool | None | Configurable (1-50+ workers) |
| Timeouts | Fixed | Configurable per operation |

---

## Example Output

```
=== Subdomain Enumeration & Host Probing Demo ===

Target Domain: example.com

--- Method 1: Using scanner.ScanDomain() ---
Starting full scan with 15 workers...

Scan completed in 12.3s
Results:
  Total Subdomains: 47
  Alive Hosts: 23
  Dead Hosts: 24

Alive Hosts:
  ✓ www.example.com
      └─ 93.184.216.34
      └─ 2606:2800:220:1:248:1893:25c8:1946
  ✓ api.example.com
      └─ 93.184.216.35
  ... and 21 more

Hosts with Errors: 15
  ✗ old.example.com: DNS resolution failed: no such host
  ✗ timeout.example.com: HTTP check failed: context deadline exceeded
  ... and 13 more

Full results exported to: scan_result_example.com.json
```

---

## Next Steps

1. **Read the full documentation**: [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md)
2. **Test the scanner**: Run `go run example_usage.go <domain>`
3. **Integrate into your workflow**: Update your code to use `ProbeHosts()` for better performance
4. **Tune for your environment**: Adjust worker count and timeouts based on your needs

---

## Need Help?

- Full documentation: [docs/REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md)
- Example code: [scanner/example_usage.go](../scanner/example_usage.go)
- Open an issue on GitHub
