# Network & Server Analysis Subsystem - Implementation Complete

## Overview

Subsystem 3: Network & Server Analysis has been fully implemented with the following capabilities:
1. **Port scanning + service/banner detection** (Nmap)
2. **SSL/TLS weakness checks** (TLS versions + certificate validation)
3. **Directory misconfiguration checks** (sensitive paths + directory listing detection)

## Architecture

### Flow
1. After recon discovers hosts/subdomains, the Go worker automatically runs network analysis
2. For each **alive** host discovered:
   - Port scanning (Nmap TCP connect scan)
   - TLS/SSL analysis (version detection, certificate checks)
   - Directory misconfiguration scanning (sensitive paths)
3. Results are posted to Django backend in chunks
4. Results are broadcast via WebSocket to frontend in real-time

## Django Backend Implementation

### Models (`backend/reconscan/models.py`)

#### PortScanFinding
- Stores open ports discovered on each host
- Fields: `scan`, `host`, `port`, `protocol`, `state`, `service`, `product`, `version`, `banner`, `created_at`
- Unique constraint: `(scan, host, port, protocol)`
- Indexed: `(scan, host)`, `created_at`

#### TLSScanResult
- Stores TLS/SSL analysis results per host
- Fields: `scan`, `host`, `has_https`, `supported_versions`, `weak_versions`, `cert_valid`, `cert_expires_at`, `cert_issuer`, `issues`, `created_at`
- Unique constraint: `(scan, host)`
- Detects weak TLS versions (1.0, 1.1)
- Validates certificates (expiry, validity)

#### DirectoryFinding
- Stores directory/path misconfiguration findings
- Fields: `scan`, `host`, `base_url`, `path`, `status_code`, `issue_type`, `evidence`, `created_at`
- Unique constraint: `(scan, host, path)`
- Indexed: `(scan, host)`, `issue_type`, `created_at`

### API Endpoints (`backend/reconscan/urls.py`, `views.py`)

#### POST /api/recon/scans/{scan_id}/network/ports/ingest/
- Accepts bulk port findings from Go worker
- Validates scan exists and request is authorized (JWT)
- Uses `bulk_create` with `ignore_conflicts=True` for efficiency
- Broadcasts `network_ports_chunk` message via WebSocket

#### POST /api/recon/scans/{scan_id}/network/tls/ingest/
- Accepts single TLS result per host from Go worker
- Parses ISO8601 datetime for certificate expiry
- Uses `update_or_create` to handle re-scans
- Broadcasts `network_tls_result` message via WebSocket

#### POST /api/recon/scans/{scan_id}/network/dirs/ingest/
- Accepts bulk directory findings from Go worker
- Uses `bulk_create` with `ignore_conflicts=True` for efficiency
- Broadcasts `network_dirs_chunk` message via WebSocket

### WebSocket Broadcasting
- Reuses existing Channels layer and scan-specific group naming: `scan_{scan_id}`
- Message types:
  - `network_ports_chunk`: Port scan findings
  - `network_tls_result`: TLS analysis result
  - `network_dirs_chunk`: Directory findings

## Go Worker Implementation

### Network Analysis Functions

#### Port Scanning (`scanner/network/nmap.go`)
```go
func ScanHostPorts(host string, topPorts int) ([]PortFinding, error)
```
- Uses Nmap TCP connect scan (`-sT`) - safe, non-intrusive
- Service version detection (`-sV`)
- Top 200 ports by default (configurable)
- XML output parsing for stable results
- Timeouts: 5m host timeout, max 1 retry
- Version intensity: 2 (lighter probing)
- Returns: host, port, protocol, state, service, product, version, banner

#### TLS Checking (`scanner/network/tls.go`)
```go
func CheckTLS(host string) TLSResult
```
- Tests TLS 1.0, 1.1, 1.2, 1.3 support individually
- Marks TLS 1.0 and 1.1 as weak versions
- Extracts certificate information:
  - Issuer
  - Expiry date (NotAfter)
  - Validity status
- Detects issues:
  - `weak_tls_version_10`, `weak_tls_version_11`
  - `certificate_expired`
  - `certificate_expiring_soon` (within 30 days)
  - `certificate_not_yet_valid`
- Uses Go `crypto/tls` (no external dependencies)
- 5-second timeout per TLS version check

#### Directory Checking (`scanner/network/directory.go`)
```go
func CheckDirectories(host string, hasHTTPS bool) []DirectoryFinding
```
- Checks fixed list of sensitive paths:
  - `/.git/`, `/.git/config`, `/.env`
  - `/backup/`, `/backups/`, `/admin/`, `/uploads/`
  - `/server-status`, `/actuator`, `/actuator/health`
  - `/swagger`, `/swagger-ui/`, `/api-docs`, `/.well-known/`
- Prefers HTTPS if available, falls back to HTTP
- GET requests only (safe, non-intrusive)
- 5-second timeout per request
- Follows up to 3 redirects
- Detects:
  - **Directory listing**: `Index of /`, `Directory listing`, `Parent directory`
  - **Sensitive file exposure**: `.git`, `.env` accessible
  - **Sensitive path accessible**: backup, admin paths
- Returns: host, base_url, path, status_code, issue_type, evidence

### Pipeline Integration (`scanner/scan_handler.go`)

The `runFullScan()` function now executes 3 stages:

1. **Subdomain Discovery** (existing)
2. **Endpoint Discovery** (existing)
3. **Network Analysis** (NEW)
   - Collects all **alive** hosts from subdomain results
   - Runs network analysis concurrently with worker pool (10 workers)
   - For each host:
     - Port scan → POST to `/network/ports/ingest/` (chunks of 50)
     - TLS check → POST to `/network/tls/ingest/` (single result)
     - Directory check → POST to `/network/dirs/ingest/` (chunks of 50)
   - Continues on host-level errors (resilient)
   - Marks scan as FAILED only on critical worker errors

### Concurrency & Safety
- Worker pool: 10 concurrent hosts maximum (prevents resource exhaustion)
- Per-host timeout enforcement via Nmap and HTTP client settings
- Chunked POSTs prevent memory issues with large result sets
- Non-blocking: Main scan flow completes even if some hosts fail

## Security & Non-Intrusive Constraints

✅ **Detection only** - No exploitation attempts
✅ **Safe scanning defaults**:
- Nmap TCP connect scan (`-sT`) - not SYN scan
- Top 200 ports only (not full 65535)
- Reasonable timeouts and retries
- Light version detection intensity

✅ **Directory checks**:
- GET requests only
- Small fixed list of high-value paths
- Short timeouts (5s per request)

✅ **TLS checks**:
- Lightweight Go crypto/tls library
- Quick version probes (5s timeout each)
- No cipher suite brute-forcing

## Database Migration

**File**: `backend/reconscan/migrations/0002_network_analysis_models.py`

Creates:
- `PortScanFinding` table with indexes
- `TLSScanResult` table
- `DirectoryFinding` table with indexes

**To apply**:
```bash
cd backend
python manage.py migrate reconscan
```

## Django Admin Integration

All 3 new models are registered in Django admin with:
- List displays
- Search fields
- Filters
- Raw ID fields for foreign keys
- Date hierarchies

## Testing Steps

### 1. Apply Migration
```bash
cd backend
source env/bin/activate  # or appropriate activation
python manage.py migrate reconscan
```

### 2. Start Django Backend
```bash
cd backend
python manage.py runserver
```

### 3. Start Go Worker
```bash
cd scanner
go run .
```

### 4. Create a Scan (via API or Django admin)
```bash
curl -X POST http://localhost:8000/api/recon/scans/start/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target": "example.com"}'
```

### 5. Monitor WebSocket Messages
Connect to WebSocket and subscribe to `scan_{scan_id}` group to see:
- `network_ports_chunk` - Port scan results
- `network_tls_result` - TLS analysis
- `network_dirs_chunk` - Directory findings

### 6. Verify Results in Database
```python
from reconscan.models import PortScanFinding, TLSScanResult, DirectoryFinding

# Check port findings
PortScanFinding.objects.filter(scan_id=YOUR_SCAN_ID)

# Check TLS results
TLSScanResult.objects.filter(scan_id=YOUR_SCAN_ID)

# Check directory findings
DirectoryFinding.objects.filter(scan_id=YOUR_SCAN_ID)
```

### 7. Check Django Admin
Navigate to:
- http://localhost:8000/admin/reconscan/portscanfinding/
- http://localhost:8000/admin/reconscan/tlsscanresult/
- http://localhost:8000/admin/reconscan/directoryfinding/

## Manual Testing Commands

### Test Port Scanning (requires Nmap installed)
```bash
cd scanner
go run . -test-nmap example.com
```

### Test TLS Checking
```bash
cd scanner
go run . -test-tls example.com
```

### Test Directory Checking
```bash
cd scanner
go run . -test-dirs example.com
```

## Performance Characteristics

- **Port scanning**: 200 ports × 10 concurrent hosts = ~2000 ports/minute
- **TLS checking**: 4 version checks × 5s timeout = ~20s per host
- **Directory checking**: 14 paths × 5s timeout = ~70s per host (worst case)

With 10 worker goroutines, analysis of 100 hosts completes in ~10-15 minutes.

## Future Enhancements

- [ ] Configurable port ranges and scan intensity
- [ ] Custom sensitive path lists per scan
- [ ] TLS cipher suite analysis
- [ ] HTTP header security checks
- [ ] Certificate chain validation
- [ ] Vulnerability correlation with CVE databases
- [ ] Scan scheduling and periodic rescans
- [ ] Export results to PDF/CSV

## Dependencies

### Go
- Standard library (`crypto/tls`, `net`, `encoding/xml`)
- `nmap` binary (must be installed on system)

### Django
- Django 5.2+
- Django REST Framework
- Django Channels (for WebSocket)
- PostgreSQL (for JSONField support)

## File Changes Summary

### New Files
- `backend/reconscan/migrations/0002_network_analysis_models.py`

### Modified Files
- `backend/reconscan/models.py` - Added 3 new models
- `backend/reconscan/serializers.py` - Added 3 new serializers
- `backend/reconscan/views.py` - Added 3 new ingestion views
- `backend/reconscan/urls.py` - Added 3 new URL patterns
- `backend/reconscan/admin.py` - Added 3 new admin classes
- `scanner/scan_handler.go` - Integrated network analysis pipeline

### Existing Files (No Changes Required)
- `scanner/network/nmap.go` - Already implemented
- `scanner/network/tls.go` - Already implemented
- `scanner/network/directory.go` - Already implemented

---

**Implementation Status**: ✅ **COMPLETE**

All requirements from Subsystem 3: Network & Server Analysis have been implemented and are ready for testing.
