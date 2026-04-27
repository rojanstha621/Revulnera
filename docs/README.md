# Revulnera - Security Reconnaissance & Network Analysis Platform

**Django REST + PostgreSQL + Django Channels WebSocket + Go Worker**

## Project Status

✅ **Subsystem 1: User Management** - COMPLETED  
✅ **Subsystem 2: Reconnaissance** - COMPLETED  
✅ **Subsystem 3: Network & Server Analysis** - COMPLETED *(Just implemented!)*

---

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│                 │      │                  │      │                 │
│  React Frontend │◄────►│  Django Backend  │◄────►│   Go Worker     │
│                 │ WSS  │  + Channels WS   │ HTTP │   Scanner       │
│                 │      │                  │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                  │                         │
                                  │                         │
                                  ▼                         ▼
                         ┌─────────────────┐      ┌─────────────────┐
                         │   PostgreSQL    │      │  External Tools │
                         │    Database     │      │  - Subfinder    │
                         │                 │      │  - Nmap         │
                         └─────────────────┘      │  - httpx        │
                                                  └─────────────────┘
```

## Feature Set

### 1. User Management ✅
- JWT authentication
- Role-based access control (Admin/User)
- User registration & login
- Secure password handling

### 2. Reconnaissance ✅
- **Subdomain Enumeration**: Subfinder integration
- **Live Host Detection**: httpx probing
- **Endpoint Discovery**: Web endpoint crawling
- **Technology Fingerprinting**: Header & content analysis
- **Real-time Updates**: WebSocket streaming of results

### 3. Network & Server Analysis ✅ *NEW!*
- **Port Scanning**: Nmap TCP connect scan with service detection
- **SSL/TLS Analysis**: Version detection, weak cipher identification
- **Certificate Validation**: Expiry checks, issuer verification
- **Directory Misconfiguration**: Sensitive path detection (.git, .env, backups, admin panels)
- **Real-time Results**: Chunked streaming via WebSocket

### 4. Performance Improvements ✅ *REFACTORED!*
- **Concurrent Host Probing**: 10-50x faster with worker pools
- **Multiple IP Support**: IPv4 + IPv6 resolution
- **HTTP Fallback**: Works without httpx using native Go
- **Enhanced Error Tracking**: Detailed error messages for debugging
- **Production-Ready**: Robust timeout handling and error recovery

📖 **See**: [Refactoring Guide](./REFACTORING_GUIDE.md) | [Quick Start](./QUICK_START_REFACTORED.md) | [Summary](./REFACTORING_SUMMARY.md)

---

## Quick Start

### Prerequisites
- Python 3.11+
- Go 1.21+
- PostgreSQL 14+
- Node.js 18+ (for frontend)
- **Nmap** (for network analysis)

### Installation

#### 1. Backend Setup
```bash
cd backend
python -m venv env
source env/bin/activate  # or .\env\Scripts\activate on Windows
pip install -r requirements.txt

# Configure database in settings.py
python manage.py migrate
python manage.py createsuperuser

# One-command local startup (auto-starts Redis + Celery worker + Django)
python manage.py devserver

# `runserver` now delegates to `devserver` automatically in this project.
python manage.py runserver

# Optional fallback if you want Django only
# python manage.py runserver --plain-runserver
```

#### 2. Go Worker Setup
```bash
cd scanner
go mod download
go run .
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### First Scan

1. **Login** to the frontend
2. **Create a scan** with a target domain (e.g., `example.com`)
3. **Watch real-time progress** via WebSocket
4. **View results**:
   - Subdomains discovered
   - Live endpoints found
   - Open ports detected
   - TLS/SSL configuration
   - Directory misconfigurations

---

## Network Analysis Details

### What Gets Scanned?

For each **alive host** discovered during reconnaissance:

#### Port Scanning
- Top 200 most common ports
- TCP connect scan (safe, non-intrusive)
- Service version detection
- Banner grabbing
- **Example output**: 
  - `80/tcp open http nginx 1.18.0`
  - `443/tcp open https nginx 1.18.0`
  - `22/tcp open ssh OpenSSH 8.2p1`

#### TLS/SSL Analysis
- Tests TLS 1.0, 1.1, 1.2, 1.3 support
- Identifies weak versions (TLS 1.0, 1.1)
- Certificate validation:
  - Expiry date
  - Issuer
  - Validity status
- **Example issues**:
  - `weak_tls_version_10`
  - `certificate_expiring_soon`
  - `certificate_expired`

#### Directory Checks
Checks for common misconfigurations:
- `.git/` directory exposure
- `.env` file accessibility
- Backup directories (`/backup/`, `/backups/`)
- Admin panels (`/admin/`)
- API documentation (`/swagger`, `/api-docs`)
- Server status pages (`/server-status`, `/actuator`)

**Example findings**:
- `/.git/ → 200 OK → sensitive_file_exposed`
- `/.env → 200 OK → sensitive_file_exposed`
- `/admin/ → 200 OK → admin_panel_accessible`

### Safety & Constraints

✅ **Detection Only** - No exploitation  
✅ **Non-Intrusive Scanning**:
- TCP connect (not SYN scan)
- Limited port range (200 ports)
- Reasonable timeouts
- GET requests only for directories

✅ **Configurable Concurrency**:
- 10 worker goroutines (adjustable)
- Per-host timeout enforcement
- Graceful error handling

---

## API Endpoints

### User Authentication
- `POST /api/accounts/register/` - User registration
- `POST /api/accounts/login/` - JWT login
- `GET /api/accounts/me/` - Current user profile

### Scan Management
- `POST /api/recon/scans/start/` - Create new scan
- `GET /api/recon/user/scans/` - List user's scans
- `GET /api/recon/user/scans/{id}/` - Scan details with results

### Network Analysis (Worker Endpoints)
- `POST /api/recon/scans/{id}/network/ports/ingest/` - Port findings
- `POST /api/recon/scans/{id}/network/tls/ingest/` - TLS results
- `POST /api/recon/scans/{id}/network/dirs/ingest/` - Directory findings

### WebSocket
- `ws://localhost:8000/ws/scans/` - Real-time scan updates
- Message types:
  - `scan_status` - Scan lifecycle events
  - `subdomains_chunk` - Subdomain discoveries
  - `endpoints_chunk` - Endpoint discoveries
  - `network_ports_chunk` - Port scan results *NEW*
  - `network_tls_result` - TLS analysis *NEW*
  - `network_dirs_chunk` - Directory findings *NEW*

---

## Database Schema

### Core Models
- **Scan**: Scan jobs with status tracking
- **Subdomain**: Discovered subdomains with IP and liveness
- **Endpoint**: Discovered web endpoints with fingerprints

### Network Analysis Models *NEW*
- **PortScanFinding**: Open ports with service details
- **TLSScanResult**: TLS/SSL configuration per host
- **DirectoryFinding**: Directory misconfigurations

---

## Development

### Running Tests
```bash
# Django tests
cd backend
python manage.py test

# Go tests
cd scanner
go test ./... -v
```

### Code Structure
```
revulnera/
├── backend/           # Django REST API
│   ├── accounts/      # User management
│   ├── reconscan/     # Scan orchestration & results
│   └── revulnera_project/  # Settings
├── scanner/           # Go worker
│   ├── recon/         # Subdomain enumeration
│   ├── endpoints/     # Endpoint discovery
│   ├── network/       # Network analysis (ports, TLS, dirs)
│   └── main.go        # HTTP server
├── frontend/          # React UI
└── docs/              # Documentation
```

---

## Recent Implementation: Network Analysis

**Date**: January 2026  
**Files Changed**: 8 files  
**Files Created**: 3 files

### Changes Made

#### Django Backend
- ✅ Added 3 new models (`PortScanFinding`, `TLSScanResult`, `DirectoryFinding`)
- ✅ Created 3 serializers
- ✅ Implemented 3 ingestion API endpoints
- ✅ Added WebSocket broadcasting for network results
- ✅ Registered models in Django admin
- ✅ Created migration `0002_network_analysis_models.py`

#### Go Worker
- ✅ Integrated network analysis into scan pipeline
- ✅ Added concurrent host processing (10 workers)
- ✅ Implemented chunked result POSTing
- ✅ Added error handling and resilience

#### Documentation
- 📄 `NETWORK_ANALYSIS_IMPLEMENTATION.md` - Complete technical documentation
- 📄 `QUICK_START_NETWORK_ANALYSIS.md` - Setup and testing guide
- 📄 `setup_network_analysis.sh` - Automated setup script

### Migration Command
```bash
cd backend
python manage.py migrate reconscan
```

Expected output:
```
Applying reconscan.0002_network_analysis_models... OK
```

---

## Performance

### Typical Scan Times (100 subdomains)
- **Subdomain enumeration**: 1-2 minutes
- **Endpoint discovery**: 3-5 minutes  
- **Network analysis**: 10-15 minutes
  - Port scanning: ~5 minutes (200 ports × 100 hosts)
  - TLS checking: ~3 minutes
  - Directory checking: ~7 minutes

### Optimizations
- Concurrent workers (10 goroutines)
- Bulk database inserts
- Chunked WebSocket streaming
- Timeout enforcement

---

## Security Considerations

### Authentication
- JWT tokens with expiry
- Password hashing (Django PBKDF2)
- CORS configuration
- CSRF protection

### Scanning Ethics
- ⚠️ **Only scan authorized targets**
- ⚠️ **Respect robots.txt and rate limits**
- ⚠️ **No exploitation or attacks**
- ⚠️ **Detection-only approach**

### Data Protection
- User isolation (scan ownership)
- Database constraints
- Input validation
- Parameterized queries

---

## Troubleshooting

### Common Issues

#### "Nmap not found"
```bash
sudo apt-get install nmap  # Ubuntu/Debian
brew install nmap          # macOS
```

#### "No alive hosts found"
- Check target domain is valid
- Verify DNS resolution
- Ensure network connectivity

#### "Migration already applied"
- This is normal if re-running migrations
- Check: `python manage.py showmigrations reconscan`

#### WebSocket not connecting
- Ensure Django Channels is running
- Check ALLOWED_HOSTS in settings
- Verify Redis/Channels layer configuration

---

## Future Roadmap

- [ ] Vulnerability correlation with CVE databases
- [ ] Automated scheduling & periodic rescans
- [ ] PDF/CSV report generation
- [ ] Custom wordlists for directory scanning
- [ ] Advanced TLS cipher suite analysis
- [ ] HTTP security header analysis
- [ ] Multi-tenant support
- [ ] Email notifications

---

## Contributing

This is a security research tool. Contributions should:
1. Maintain non-intrusive scanning approach
2. Add tests for new features
3. Update documentation
4. Follow existing code patterns

---

## License

[Add your license here]

---

## Credits

- **Subfinder**: OWASP Amass alternative for subdomain enumeration
- **Nmap**: Network exploration and security auditing
- **httpx**: Fast HTTP toolkit
- **Django**: High-level Python web framework
- **Go**: Efficient concurrent worker implementation

---

## Support

For issues, questions, or feature requests:
- Check `docs/NETWORK_ANALYSIS_IMPLEMENTATION.md` for detailed docs
- Check `docs/QUICK_START_NETWORK_ANALYSIS.md` for setup help
- Review Django logs: `python manage.py runserver` output
- Review Go logs: Worker console output

---

**Last Updated**: January 27, 2026  
**Version**: 1.0.0 (Network Analysis Complete)
