# Data Structure Comparison: Django Models vs Go Scanner

## Summary

✅ **Overall Status**: Data structures are **well-aligned** with minor discrepancies

⚠️ **Issues Found**: 
1. Missing `ip` field in Go `PortFinding` struct
2. Missing `risk_tags` handling in port scan ingestion
3. Inconsistent field naming conventions (snake_case vs camelCase)

---

## 1. Subdomain Data Structure

### Django Model: `Subdomain`
```python
class Subdomain(models.Model):
    scan = ForeignKey(Scan)           # Relationship
    name = CharField(max_length=255)
    ip = GenericIPAddressField()      # Primary IP (backward compat)
    ips = JSONField(default=list)     # All IPs (IPv4 + IPv6)
    alive = BooleanField(default=False)
    error_msg = TextField(blank=True)
```

### Go Struct: `SubdomainResult`
```go
type SubdomainResult struct {
    Name     string   `json:"name"`
    IP       string   `json:"ip"`        // Primary IP
    IPs      []string `json:"ips"`       // All resolved IPs
    Alive    bool     `json:"alive"`
    ErrorMsg string   `json:"error_msg"` // Error details
}
```

### ✅ Status: **PERFECT MATCH**
- All fields align correctly
- JSON field names match (snake_case)
- Django correctly handles both `ip` and `ips` for backward compatibility
- Error message support on both sides

---

## 2. Endpoint Data Structure

### Django Model: `Endpoint`
```python
class Endpoint(models.Model):
    scan = ForeignKey(Scan)           # Relationship
    url = URLField(max_length=1000)
    status_code = IntegerField()
    title = CharField(max_length=255, blank=True)
    headers = JSONField(default=dict)
    fingerprints = JSONField(default=list)
    evidence = JSONField(default=dict)
```

### Go Struct: `EndpointResult`
```go
type EndpointResult struct {
    URL           string            `json:"url"`
    StatusCode    int               `json:"status_code"`
    ContentLength int64             `json:"content_length"`
    Title         string            `json:"title"`
    Headers       map[string]string `json:"headers"`
    Fingerprints  []string          `json:"fingerprints"`
    Evidence      map[string]string `json:"evidence"`
}
```

### ⚠️ Status: **MINOR MISMATCH**
**Missing in Django**:
- `content_length` field not stored in Django model

**Impact**: Low - Content length is sent but not persisted in database
**Recommendation**: Add `content_length` field if needed for analysis

---

## 3. Port Scan Finding Data Structure

### Django Model: `PortScanFinding`
```python
class PortScanFinding(models.Model):
    scan = ForeignKey(Scan)           # Relationship
    host = CharField(max_length=255)
    ip = GenericIPAddressField()      # ⚠️ Resolved IP address
    port = IntegerField()
    protocol = CharField(max_length=10, default="tcp")
    state = CharField(max_length=20, default="open")
    service = CharField(max_length=100, blank=True)
    product = CharField(max_length=255, blank=True)
    version = CharField(max_length=100, blank=True)
    banner = TextField(blank=True)
    risk_tags = JSONField(default=list)  # ⚠️ Risk tags
    created_at = DateTimeField(auto_now_add=True)
```

### Go Struct: `PortFinding`
```go
type PortFinding struct {
    Host     string `json:"host"`
    Port     int    `json:"port"`
    Protocol string `json:"protocol"`
    State    string `json:"state"`
    Service  string `json:"service"`
    Product  string `json:"product"`
    Version  string `json:"version"`
    Banner   string `json:"banner"`
    // ⚠️ Missing: IP field
    // ⚠️ Missing: RiskTags field
}
```

### ❌ Status: **MISMATCH - Missing Fields in Go**

**Problems**:
1. **No `ip` field** in Go struct - Django expects resolved IP address
2. **No `risk_tags` field** in Go struct - Django has field but Go doesn't populate it

**Impact**: 
- Medium - `ip` field will always be NULL in database
- Low - `risk_tags` will always be empty array

**Recommendation**: 
```go
type PortFinding struct {
    Host     string   `json:"host"`
    IP       string   `json:"ip"`         // ADD THIS
    Port     int      `json:"port"`
    Protocol string   `json:"protocol"`
    State    string   `json:"state"`
    Service  string   `json:"service"`
    Product  string   `json:"product"`
    Version  string   `json:"version"`
    Banner   string   `json:"banner"`
    RiskTags []string `json:"risk_tags"`  // ADD THIS (optional)
}
```

---

## 4. TLS Scan Result Data Structure

### Django Model: `TLSScanResult`
```python
class TLSScanResult(models.Model):
    scan = ForeignKey(Scan)
    host = CharField(max_length=255)
    has_https = BooleanField(default=False)
    supported_versions = JSONField(default=list)
    weak_versions = JSONField(default=list)
    cert_valid = BooleanField(null=True)
    cert_expires_at = DateTimeField(null=True)
    cert_issuer = TextField(blank=True)
    issues = JSONField(default=list)
    created_at = DateTimeField(auto_now_add=True)
```

### Go Struct: `TLSResult`
```go
type TLSResult struct {
    Host              string   `json:"host"`
    HasHTTPS          bool     `json:"has_https"`
    SupportedVersions []string `json:"supported_versions"`
    WeakVersions      []string `json:"weak_versions"`
    CertValid         *bool    `json:"cert_valid,omitempty"`
    CertExpiresAt     string   `json:"cert_expires_at,omitempty"`
    CertIssuer        string   `json:"cert_issuer,omitempty"`
    Issues            []string `json:"issues"`
}
```

### ✅ Status: **PERFECT MATCH**
- All fields align correctly
- JSON field names match (snake_case)
- Proper handling of nullable `cert_valid` using pointer
- ISO8601 datetime string properly parsed by Django

---

## 5. Directory Finding Data Structure

### Django Model: `DirectoryFinding`
```python
class DirectoryFinding(models.Model):
    scan = ForeignKey(Scan)
    host = CharField(max_length=255)
    base_url = CharField(max_length=500)
    path = CharField(max_length=500)
    status_code = IntegerField()
    issue_type = CharField(max_length=100)
    evidence = TextField(blank=True)
    created_at = DateTimeField(auto_now_add=True)
```

### Go Struct: `DirectoryFinding`
```go
type DirectoryFinding struct {
    Host       string `json:"host"`
    BaseURL    string `json:"base_url"`
    Path       string `json:"path"`
    StatusCode int    `json:"status_code"`
    IssueType  string `json:"issue_type"`
    Evidence   string `json:"evidence"`
}
```

### ✅ Status: **PERFECT MATCH**
- All fields align correctly
- JSON field names match (snake_case)
- Evidence can be arbitrary text on both sides

---

## Field Naming Convention Analysis

### Snake_case vs CamelCase

| Go Field Name | JSON Tag | Django Field | Match? |
|---------------|----------|--------------|--------|
| `Name` | `name` | `name` | ✅ |
| `StatusCode` | `status_code` | `status_code` | ✅ |
| `HasHTTPS` | `has_https` | `has_https` | ✅ |
| `BaseURL` | `base_url` | `base_url` | ✅ |
| `IssueType` | `issue_type` | `issue_type` | ✅ |
| `ErrorMsg` | `error_msg` | `error_msg` | ✅ |

**Result**: ✅ All JSON tags correctly use snake_case matching Django conventions

---

## Data Ingestion Flow

```
Go Scanner                    Django Backend
-----------                   --------------
SubdomainResult    ──JSON──►  IngestSubdomainsView    ──►  Subdomain model
EndpointResult     ──JSON──►  IngestEndpointsView     ──►  Endpoint model
PortFinding        ──JSON──►  IngestPortScanFindings  ──►  PortScanFinding model
TLSResult          ──JSON──►  IngestTLSResultView     ──►  TLSScanResult model
DirectoryFinding   ──JSON──►  IngestDirectoryFindings ──►  DirectoryFinding model
```

### Error Handling in Django Views

All ingestion views properly handle:
- Missing/optional fields with `.get()` and defaults
- Bulk creation with `ignore_conflicts=True` for duplicates
- WebSocket broadcasting of received data
- Backward compatibility (e.g., `ip` vs `ips`)

---

## Critical Issues Summary

### 🔴 HIGH Priority

**1. PortFinding missing IP field**
- **File**: `scanner/network/nmap.go`
- **Line**: ~52
- **Fix**: Add `IP string` field to struct and populate during Nmap parsing

### 🟡 MEDIUM Priority

**2. Endpoint ContentLength not persisted**
- **File**: `backend/reconscan/models.py`
- **Fix**: Add `content_length = models.BigIntegerField(default=0)` to Endpoint model

### 🟢 LOW Priority

**3. PortFinding missing RiskTags**
- **File**: `scanner/network/nmap.go`
- **Fix**: Add `RiskTags []string` field and implement risk classification logic
- **Example risks**: ssh (port 22), ftp (port 21), rdp (port 3389), telnet (port 23)

---

## Recommendations

### Immediate Actions Required

1. **Fix PortFinding struct** in `scanner/network/nmap.go`:
```go
type PortFinding struct {
    Host     string   `json:"host"`
    IP       string   `json:"ip"`         // ADD: Resolved IP
    Port     int      `json:"port"`
    Protocol string   `json:"protocol"`
    State    string   `json:"state"`
    Service  string   `json:"service"`
    Product  string   `json:"product"`
    Version  string   `json:"version"`
    Banner   string   `json:"banner"`
    RiskTags []string `json:"risk_tags"`  // ADD: Risk classification
}
```

2. **Update ScanHostPorts function** to resolve and populate IP field

3. **Add risk tagging logic** based on port/service:
```go
func classifyRisk(port int, service string) []string {
    risks := []string{}
    switch port {
    case 21: risks = append(risks, "ftp")
    case 22: risks = append(risks, "ssh")
    case 23: risks = append(risks, "telnet")
    case 3389: risks = append(risks, "rdp")
    // ... more cases
    }
    return risks
}
```

### Future Improvements

1. Consider adding `content_length` to Endpoint model for storage analytics
2. Add data validation schemas on both sides
3. Create automated tests comparing Go structs with Django model fields
4. Document all data contracts in OpenAPI/Swagger format

---

## Testing Checklist

- [ ] Verify subdomain data flows correctly (name, ips, alive, error_msg)
- [ ] Verify endpoint data flows correctly (url, status_code, title, headers, fingerprints)
- [ ] **BLOCKED**: Port findings with IP field population
- [ ] Verify TLS results flow correctly (all cert fields, issues)
- [ ] Verify directory findings flow correctly (base_url, path, issue_type)
- [ ] Test WebSocket broadcasting for all data types
- [ ] Test bulk ingestion with 100+ items
- [ ] Test duplicate handling (update_or_create, ignore_conflicts)

---

**Generated**: February 18, 2026
**Status**: Data structures mostly aligned, critical fix needed for PortFinding.IP field
