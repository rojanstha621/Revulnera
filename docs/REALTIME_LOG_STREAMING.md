# Real-time Log Streaming

## Overview

The scanner now streams progress logs in real-time to the frontend during scan execution, providing visibility into what's happening at each stage of the discovery process.

## Architecture

```
Go Scanner → HTTP POST → Django ScanLogView → WebSocket → Frontend Display
```

### Flow:
1. **Go Scanner** sends log messages via POST to `/api/recon/scans/{scan_id}/logs/`
2. **Django ScanLogView** receives messages and broadcasts via Django Channels
3. **Frontend** receives WebSocket events with type `scan_log` and displays them in real-time

## Log Message Structure

```json
{
  "message": "🔍 Starting subdomain enumeration for example.com...",
  "level": "info",
  "timestamp": "2024-01-15T10:30:45Z"
}
```

### Log Levels
- **`info`**: General progress updates (blue)
- **`success`**: Completed tasks (green)
- **`warning`**: Non-critical issues (yellow)
- **`error`**: Failures that stop the scan (red)

## Backend Implementation

### Django View (`backend/reconscan/views.py`)

```python
class ScanLogView(APIView):
    """Receive and broadcast log messages from Go worker"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, scan_id: int):
        message = request.data.get("message", "")
        level = request.data.get("level", "info")
        
        broadcast(scan_id, {
            "type": "scan_log",
            "scan_id": scan_id,
            "message": message,
            "level": level,
            "timestamp": request.data.get("timestamp", "")
        })
        
        return Response({"ok": True})
```

### URL Configuration (`backend/reconscan/urls.py`)

```python
urlpatterns = [
    # ... other paths ...
    path("scans/<int:scan_id>/logs/", ScanLogView.as_view()),
]
```

## Go Scanner Implementation

### Helper Function (`scanner/scan_handler.go`)

```go
func postLog(authHeader, url, message, level string) {
    body := map[string]any{
        "message":   message,
        "level":     level,
        "timestamp": time.Now().Format(time.RFC3339),
    }
    postJSON(authHeader, url, body)
}
```

### Log Messages Sent

The scanner sends logs at these key milestones:

| Stage | Message | Level |
|-------|---------|-------|
| Subdomain Start | 🔍 Starting subdomain enumeration for {target}... | info |
| Subdomain Complete | ✅ Subdomain enumeration complete: found {count} subdomains ({alive} alive) | success |
| Subdomain Error | ❌ Subdomain enumeration failed: {error} | error |
| Endpoint Start | 🕷️ Starting endpoint discovery (gau + katana)... | info |
| **Per-host Discovery** | **🔍 Discovering URLs for {host}...** | **info** |
| **gau Success** | **✅ gau found {count} URLs for {host}** | **success** |
| **gau Error** | **❌ gau error for {host}** | **warning** |
| **katana Success** | **✅ katana found {count} URLs for {host}** | **success** |
| **katana Error** | **❌ katana error for {host}** | **warning** |
| **Collection** | **📦 Collected {count} raw URLs, normalizing...** | **info** |
| URLs Discovered | 📊 Discovered {count} unique URLs from gau/katana | info |
| Probing Start | 🔍 Starting probing of {count} URLs... | info |
| Probing Complete | ✅ Probing complete: {responding}/{total} endpoints responding | success |
| No URLs Found | ⚠️ No URLs discovered from gau/katana, using basic paths | warning |
| Endpoint Error | ❌ Endpoint discovery failed: {error} | error |
| Network Start | 🔬 Starting network analysis for {count} hosts... | info |
| Network Complete | ✅ Network analysis complete for {count} hosts | success |
| Network Skip | ⚠️ No alive hosts found, skipping network analysis | warning |
| Scan Complete | 🎉 Scan completed successfully! | success |

**Note:** Messages in **bold** are new detailed per-host discovery logs that stream in real-time as each tool (gau/katana) completes for each host.

### Example Integration

```go
func runFullScan(req ScanRequest) {
    // ... setup ...
    logURL := fmt.Sprintf("%s/api/recon/scans/%d/logs/", req.BackendBase, req.ScanID)
    
    // Send log at start of subdomain discovery
    postLog(req.AuthHeader, logURL, 
        fmt.Sprintf("🔍 Starting subdomain enumeration for %s...", req.Target), 
        "info")
    
    // ... perform subdomain discovery ...
    
    // Send log after completion
    postLog(req.AuthHeader, logURL, 
        fmt.Sprintf("✅ Subdomain enumeration complete: found %d subdomains (%d alive)", 
            len(subs), aliveCount), 
        "success")
    
    // Set log callback for endpoint discovery progress
    endpointspkg.SetLogCallback(func(message, level string) {
        postLog(req.AuthHeader, logURL, message, level)
    })
    
    // Endpoint discovery will now send progress logs automatically
    eps, err := endpointspkg.DiscoverEndpointsFromScanWithCallback(
        req.ScanID, req.Target, endpointCallback)
}
```

### Progress Messages During Discovery

The endpoint discovery phase now sends **detailed per-host progress logs**:

1. **"🕷️ Starting endpoint discovery (gau + katana)..."** - Initiated
2. **"🔍 Discovering URLs for api.hackerone.com..."** - Starting discovery for each host
3. **"✅ gau found 456 URLs for support.hackerone.com"** - gau completes per host
4. **"✅ katana found 23 URLs for www.hackerone.com"** - katana completes per host
5. **"❌ katana error for api.hackerone.com"** - If katana fails for a host
6. **"📦 Collected 6983 raw URLs, normalizing..."** - After all hosts processed
7. **"📊 Discovered 5500 unique URLs from gau/katana"** - After deduplication
8. **"🔍 Starting probing of 5500 URLs..."** - Before probing phase begins
9. **"✅ Probing complete: 392/5500 endpoints responding"** - After probing finishes

This provides **granular visibility** into which hosts are being processed and how many URLs each tool discovers, preventing the frontend from appearing frozen during long discovery phases (30-120 seconds per host).

## Frontend Integration

### WebSocket Consumer

The frontend should listen for `scan_log` events:

```javascript
consumer.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === "scan_log") {
    displayLog(data.message, data.level, data.timestamp);
  }
};
```

### UI Display Example

```javascript
function displayLog(message, level, timestamp) {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${level}`;
  logEntry.textContent = `[${formatTime(timestamp)}] ${message}`;
  
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll
}
```

### Styling by Level

```css
.log-info { color: #3b82f6; } /* blue */
.log-success { color: #10b981; } /* green */
.log-warning { color: #f59e0b; } /* yellow */
.log-error { color: #ef4444; } /* red */
```

## Benefits

1. **Progress Visibility**: Users see what's happening in real-time
2. **Transparency**: Clear indication of which discovery phase is running
3. **Error Context**: Immediate notification if something fails
4. **Status Awareness**: Know when long-running phases (gau, katana) are executing
5. **Debugging**: Easier to diagnose issues with visibility into scan flow

## Granular Discovery Logs

**All discovery logs are now streamed to the frontend in real-time!**

Per-host detailed logs (e.g., "gau found 234 URLs for api.example.com") are sent via the `scan_log` WebSocket message type and displayed in the frontend UI.

These detailed logs are also available in:
- **Terminal output** (when running `go run .` or `./scanner_bin`)
- **Scanner log file** (`scanner.log` in the scanner directory)

These detailed logs use Go's standard `log.Printf()` which outputs to both terminal and file thanks to the dual-logging setup:

```go
// In main.go
logFile, _ := os.OpenFile("scanner.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
multiWriter := io.MultiWriter(os.Stdout, logFile)
log.SetOutput(multiWriter)
```

### Example Discovery Log Stream

When scanning `hackerone.com` with 11 alive hosts, you'll see:

```
🕷️ Starting endpoint discovery (gau + katana)...
🔍 Discovering URLs for api.hackerone.com...
🔍 Discovering URLs for www.hackerone.com...
🔍 Discovering URLs for support.hackerone.com...
✅ gau found 119 URLs for api.hackerone.com
❌ katana error for api.hackerone.com
✅ gau found 456 URLs for support.hackerone.com
✅ katana found 23 URLs for support.hackerone.com
✅ gau found 6825 URLs for docs.hackerone.com
✅ katana found 156 URLs for docs.hackerone.com
... (continues for all 11 hosts)
📦 Collected 6983 raw URLs, normalizing...
📊 Discovered 5500 unique URLs from gau/katana
🔍 Starting probing of 5500 URLs...
✅ Probing complete: 392/5500 endpoints responding
```

This provides complete transparency into the discovery process, letting users know exactly which tools are running, which hosts are being processed, and how many URLs each tool discovers.

## Future Enhancements

Potential improvements to log streaming:

1. ~~**Per-host discovery logs**: Send "gau found X URLs for host Y" to frontend~~ ✅ **IMPLEMENTED**
2. **Progress percentages**: Calculate and send completion percentage (e.g., "15/50 hosts analyzed")
3. **Rate limiting**: Batch rapid log messages to avoid WebSocket flooding
4. **Log filtering**: Allow frontend to filter by level (show only errors/warnings)
5. **Log export**: Download scan logs as text file from frontend
6. **Structured metadata**: Include scan phase, host being processed, tool used

## Testing

### 1. Start Django server
```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

### 2. Start scanner
```bash
cd scanner
./scanner_bin
# or
go run .
```

### 3. Trigger scan from frontend
- Open frontend in browser
- Start a scan for a target domain
- Watch the live log feed in the scan detail view

### 4. Verify logs appear
- Logs should stream in real-time as scan progresses
- Check console/network tab for WebSocket messages
- Verify log levels display with correct styling

## Troubleshooting

### Logs not appearing in frontend

**Check WebSocket connection:**
```javascript
// Browser console
console.log(wsConnection.readyState); // Should be 1 (OPEN)
```

**Check Django Channels:**
```bash
# Backend logs should show:
WebSocket CONNECT /ws/scan/123/
```

**Verify URL route:**
```python
# backend/reconscan/urls.py
path("scans/<int:scan_id>/logs/", ScanLogView.as_view()),
```

### Go scanner not sending logs

**Check log URL construction:**
```go
logURL := fmt.Sprintf("%s/api/recon/scans/%d/logs/", req.BackendBase, req.ScanID)
// Should produce: http://localhost:8000/api/recon/scans/123/logs/
```

**Verify POST requests:**
```bash
# Scanner logs should show:
[scan] POST http://localhost:8000/api/recon/scans/123/logs/ succeeded (200)
```

### Logs appear out of order

This is expected for concurrent operations. Logs from parallel workers (subdomain enumeration, endpoint probing) may arrive in non-deterministic order. The timestamp field helps reconstruct the actual sequence.

## Performance Considerations

- **Network overhead**: Each log message requires a POST request + WebSocket broadcast
- **Implementation**: ~10 log messages per scan (not per host)
- **Impact**: Minimal - log messages are small (~100 bytes) and infrequent
- **Optimization**: If needed, batch logs in Go and send every 2-3 seconds

## Related Documentation

- [Real-time Streaming Architecture](REALTIME_STREAMING.md)
- [Dynamic Endpoint Discovery](DYNAMIC_ENDPOINT_DISCOVERY.md)
- [Dual Logging Setup](../scanner/main.go) (see MultiWriter implementation)
