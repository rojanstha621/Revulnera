# Quick Start Guide - Network Analysis

## Prerequisites Check

### 1. Nmap Installation (Required)
```bash
# Check if installed
nmap --version

# Install on Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y nmap

# Install on macOS
brew install nmap

# Install on Windows
# Download from: https://nmap.org/download.html
```

### 2. Python Environment
```bash
cd backend
source env/bin/activate  # Linux/macOS
# or
.\env\Scripts\activate   # Windows
```

## Quick Setup (3 Steps)

### Step 1: Apply Migration
```bash
cd backend
python manage.py migrate reconscan
```

Expected output:
```
Running migrations:
  Applying reconscan.0002_network_analysis_models... OK
```

### Step 2: Start Services

**Terminal 1 - Django Backend:**
```bash
cd backend
python manage.py runserver
```

**Terminal 2 - Go Worker:**
```bash
cd scanner
go run .
```

### Step 3: Create Test Scan
```bash
# Via Django shell
cd backend
python manage.py shell

>>> from reconscan.models import Scan
>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> user = User.objects.first()
>>> scan = Scan.objects.create(target="example.com", created_by=user)
>>> scan.id
1
```

Or via API with curl (replace YOUR_JWT_TOKEN):
```bash
curl -X POST http://localhost:8000/api/recon/scans/start/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target": "example.com"}'
```

## Verify Results

### Check Database
```bash
cd backend
python manage.py shell

>>> from reconscan.models import PortScanFinding, TLSScanResult, DirectoryFinding

# Port findings
>>> PortScanFinding.objects.all().count()
>>> PortScanFinding.objects.values('host', 'port', 'service')[:5]

# TLS results
>>> TLSScanResult.objects.all().count()
>>> TLSScanResult.objects.values('host', 'has_https', 'weak_versions')

# Directory findings
>>> DirectoryFinding.objects.all().count()
>>> DirectoryFinding.objects.values('host', 'path', 'issue_type')[:5]
```

### Check Django Admin
1. Create superuser if needed: `python manage.py createsuperuser`
2. Go to: http://localhost:8000/admin/
3. Navigate to:
   - Recon scan → Port scan findings
   - Recon scan → TLS scan results
   - Recon scan → Directory findings

## Test Individual Components

### Test Port Scanning
```bash
cd scanner
go run . &  # Start server in background
sleep 2     # Wait for server to start

# Manual test with nmap directly
nmap -sT -sV --top-ports 200 -oX - scanme.nmap.org
```

### Test TLS Checking
```bash
# Manual test with openssl
openssl s_client -connect google.com:443 -tls1_2 </dev/null 2>/dev/null | grep -i "protocol"
openssl s_client -connect google.com:443 -tls1_3 </dev/null 2>/dev/null | grep -i "protocol"
```

### Test Directory Checking
```bash
# Manual test with curl
curl -I https://example.com/.git/
curl -I https://example.com/.env
curl -I https://example.com/admin/
```

## Troubleshooting

### "Nmap not found"
```bash
# Install nmap
sudo apt-get install nmap  # Ubuntu/Debian
brew install nmap           # macOS

# Verify
which nmap
nmap --version
```

### "No module named 'daphne'"
```bash
# Make sure you're using the right Python environment
cd backend
source env/bin/activate
pip install -r requirements.txt
```

### "Migration already applied"
```bash
# This is fine - migration was already run
# Check current state:
python manage.py showmigrations reconscan
```

### No results appearing
```bash
# Check logs
# Django backend should show:
[network] starting network analysis for scan 1
[nmap] scanning example.com (top 200 ports)
[tls] TLS check for example.com: HTTPS=true, issues=0
[directory] found 2 directory issues on example.com

# Check if hosts are alive
>>> from reconscan.models import Subdomain
>>> Subdomain.objects.filter(alive=True).count()
# Network analysis only runs on alive hosts
```

## Performance Tips

- Reduce port count for faster scans: Edit `scan_handler.go` line with `ScanHostPorts(host, 200)` → change 200 to 100
- Increase workers for more concurrency: Edit `workers := 10` → change to 20 (but watch system resources)
- Skip TLS/directory checks during testing by commenting out those sections in `analyzeHost()`

## Next Steps

1. ✅ Run migration
2. ✅ Test basic scan
3. ✅ Verify results in admin
4. 📝 Integrate with frontend (display results in UI)
5. 📝 Add export functionality (CSV/PDF reports)
6. 📝 Add scheduling for periodic rescans

---

For complete documentation, see: `docs/NETWORK_ANALYSIS_IMPLEMENTATION.md`
