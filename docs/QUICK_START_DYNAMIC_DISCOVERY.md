# Quick Start - Dynamic Endpoint Discovery

This guide helps you get started with the new dynamic endpoint discovery system in under 5 minutes.

## Prerequisites

- Go 1.19+ installed
- Scanner already built and running
- Basic familiarity with running terminal commands

## Step 1: Install Discovery Tools

### Install gau (GetAllURLs)

```bash
# Install gau
go install github.com/lc/gau/v2/cmd/gau@latest

# Copy to system path
sudo cp ~/go/bin/gau /usr/local/bin/

# Verify installation
gau -version
```

**Expected output**: `gau version X.X.X`

### Install katana (Web Crawler)

```bash
# Install katana
go install github.com/projectdiscovery/katana/cmd/katana@latest

# Copy to system path
sudo cp ~/go/bin/katana /usr/local/bin/

# Verify installation
katana -version
```

**Expected output**: `katana version X.X.X`

## Step 2: Rebuild Scanner (If Needed)

If you haven't already built the scanner with the new code:

```bash
cd /home/aaila/Documents/Development/revulnera/scanner
go build -o scanner_bin .
```

**Expected output**: No errors, `scanner_bin` file created

## Step 3: Configure (Optional)

Set environment variables to customize behavior:

```bash
# Basic configuration (recommended for first run)
export ENDPOINT_DISCOVERY_WORKERS=5
export KATANA_DEPTH=2
export MAX_URLS_PER_HOST=500
export ENDPOINT_WORKERS=20
export ENDPOINT_RPS=10
```

Add these to your `~/.bashrc` or `~/.zshrc` to make them permanent.

## Step 4: Start Scanner

### Stop existing scanner (if running)

```bash
# Find scanner process
lsof -ti:8080

# Kill it
lsof -ti:8080 | xargs kill -9
```

### Start fresh scanner

```bash
cd /home/aaila/Documents/Development/revulnera/scanner
./scanner_bin > scanner.log 2>&1 &
```

**Check it's running**:

```bash
curl http://localhost:8080/health
```

**Expected output**: `{"status":"ok"}` or similar

## Step 5: Start Django Backend

```bash
cd /home/aaila/Documents/Development/revulnera/backend
source .venv/bin/activate  # or your virtualenv path
python manage.py runserver
```

**Check it's running**:

```bash
curl http://localhost:8000/api/recon/scans/start/
```

## Step 6: Trigger a Test Scan

### Option A: Via Frontend

1. Open browser to `http://localhost:5173` (or your frontend URL)
2. Login with your account
3. Click "New Scan"
4. Enter target: `example.com`
5. Click "Start Scan"

### Option B: Via API

```bash
# Get auth token first (if needed)
TOKEN="your-jwt-token"

# Start scan
curl -X POST http://localhost:8000/api/recon/scans/start/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target": "hackerone.com"
  }'
```

## Step 7: Monitor Progress

### Watch Scanner Logs

```bash
tail -f /home/aaila/Documents/Development/revulnera/scanner/scanner.log
```

**What to look for**:

```
[discovery] starting dynamic discovery for 5 alive hosts
[discovery] gau found 45 URLs for api.example.com
[discovery] katana found 23 URLs for api.example.com
[discovery] final URL count: 157
[endpoints] httpx found 89 results
```

### Check Django Logs

In the terminal where Django is running, you should see:

```
POST /api/recon/scans/1/ingest/subdomains/ 200
POST /api/recon/scans/1/ingest/endpoints/ 200
```

### View Results in Frontend

Refresh the scan detail page - you should see:
- ✅ Subdomains appearing
- ✅ Endpoints appearing in real-time
- ✅ Status codes, titles, fingerprints displayed

## Verification Checklist

After your first scan completes, verify:

- [ ] Scan status shows "COMPLETED" in frontend
- [ ] Subdomains are listed with IP addresses
- [ ] Endpoints are listed with status codes
- [ ] More endpoints discovered than before (if comparing to old system)
- [ ] No errors in scanner.log
- [ ] JSON file created in `scanner/data/endpoints_<scan_id>_<target>.json`

## Example: What Good Output Looks Like

### Scanner Log

```
[recon] starting job: scan_id=28 target=hackerone.com
[recon] found 32 subdomains, starting concurrent probing
[recon] probing complete: 11 alive out of 32 subdomains
[endpoints] loaded 32 subdomains from data/scan_28_hackerone.com.json
[endpoints] starting dynamic discovery for 11 alive hosts
[discovery] starting dynamic discovery for 11 hosts
[discovery] discovering URLs for api.hackerone.com
[discovery] gau found 234 URLs for api.hackerone.com
[discovery] katana found 87 URLs for api.hackerone.com
[discovery] discovering URLs for www.hackerone.com
[discovery] gau found 1823 URLs for www.hackerone.com
[discovery] katana found 156 URLs for www.hackerone.com
[discovery] collected 3245 raw URLs, normalizing and deduplicating
[discovery] final URL count: 847
[endpoints] discovered 847 unique URLs, starting probing
[endpoints] httpx found 392 results
[endpoints] probing complete: 392 endpoints responding
```

### Results

- **Subdomains**: 32 found, 11 alive
- **Endpoints**: 847 discovered, 392 responding
- **Time**: ~90 seconds total
- **Success**: All endpoints are **real URLs** that actually exist

## Troubleshooting

### "gau: command not found"

**Problem**: gau not in PATH

**Solution**:
```bash
which gau  # Check if installed
sudo cp ~/go/bin/gau /usr/local/bin/
```

### "katana: command not found"

**Problem**: katana not in PATH

**Solution**:
```bash
which katana  # Check if installed
sudo cp ~/go/bin/katana /usr/local/bin/
```

### No URLs discovered

**Problem**: Both tools failed or no data available

**Solution**: Check logs for errors. System will fall back to basic root URLs automatically.

### Discovery is too slow

**Problem**: Default settings are conservative

**Solution**: Adjust environment variables:
```bash
export KATANA_DEPTH=1          # Reduce crawl depth
export MAX_URLS_PER_HOST=200   # Reduce URL limit
```

### Too many 404s still

**Problem**: May need to tune deduplication

**Solution**: This is normal - discovered URLs include historical URLs that may no longer exist. The system filters by response code (200, 401, 403, etc. are kept; 404s logged but useful for enumeration).

## Next Steps

Once the basic setup works:

1. **Tune Configuration**: Adjust workers and depths based on your needs
2. **Monitor Resource Usage**: Check CPU/memory during scans
3. **Compare Results**: Run same target with old vs new system - see the difference!
4. **Production Setup**: Add authentication, monitoring, rate limiting

## Performance Tips

### For Bug Bounty (Maximum Coverage)

```bash
export ENDPOINT_DISCOVERY_WORKERS=10
export KATANA_DEPTH=3
export MAX_URLS_PER_HOST=2000
```

### For Pentesting (Balanced)

```bash
export ENDPOINT_DISCOVERY_WORKERS=5
export KATANA_DEPTH=2
export MAX_URLS_PER_HOST=500
```

### For OSINT (Fast Survey)

```bash
export ENDPOINT_DISCOVERY_WORKERS=3
export KATANA_DEPTH=1
export MAX_URLS_PER_HOST=100
```

## Support

If you encounter issues:

1. **Check Logs**: `tail -f scanner/scanner.log`
2. **Verify Tools**: `gau -version` and `katana -version`
3. **Test Manually**: 
   ```bash
   echo "example.com" | gau
   katana -u https://example.com -d 1
   ```
4. **Review Documentation**: See `DYNAMIC_ENDPOINT_DISCOVERY.md` for details

## Success! 🎉

If you see endpoints appearing in your scan results with proper status codes, titles, and fingerprints - **you're all set!**

The new dynamic discovery system is now actively finding real endpoints for your reconnaissance scans.

---

**Time to Complete**: ~5 minutes  
**Difficulty**: Easy  
**Prerequisites**: Go, Scanner built, Django running
