# Reporting Feature - Quick Guide

## Overview

The reporting system provides a simple and effective way to generate comprehensive security assessment reports from completed reconnaissance scans.

## Features

### ✅ What's Implemented

1. **Report Generation API**
   - Comprehensive scan reports with all collected data
   - Critical findings identification and severity classification
   - Technology stack summary
   - Statistics and metrics

2. **Report Formats**
   - **JSON**: Complete data export for programmatic access
   - **HTML**: Beautiful, shareable HTML reports with styling

3. **Report Contents**
   - Executive summary with key metrics
   - Critical security findings (high-risk ports, weak TLS, exposed files)
   - Technology stack detected across endpoints
   - Detailed results (subdomains, endpoints, ports, TLS, directories)

4. **User Interface**
   - Filter scans by date range (7 days, 30 days, all time)
   - One-click report generation
   - Visual display of findings with severity indicators
   - Download reports in multiple formats

## Usage

### Backend API Endpoints

#### 1. Get Scans Summary for Reports
```
GET /api/recon/reports/scans/?range={dateRange}
```
**Parameters:**
- `range`: `7days`, `30days`, or `all` (default: `all`)

**Response:**
```json
[
  {
    "id": 1,
    "target": "example.com",
    "status": "COMPLETED",
    "created_at": "2026-02-18T10:00:00Z",
    "subdomain_count": 25,
    "endpoint_count": 150,
    "port_findings_count": 10,
    "has_critical_findings": true
  }
]
```

#### 2. Generate Scan Report
```
GET /api/recon/reports/scans/{scan_id}/
```

**Response:**
```json
{
  "scan_info": {
    "id": 1,
    "target": "example.com",
    "status": "COMPLETED",
    "created_at": "2026-02-18T10:00:00Z",
    "updated_at": "2026-02-18T10:30:00Z",
    "created_by": "user@example.com"
  },
  "summary": {
    "total_subdomains": 25,
    "alive_subdomains": 20,
    "total_endpoints": 150,
    "total_open_ports": 10,
    "high_risk_ports": 2,
    "tls_issues": 5,
    "directory_issues": 3,
    "critical_findings_count": 5
  },
  "critical_findings": [
    {
      "type": "high_risk_port",
      "severity": "high",
      "host": "admin.example.com",
      "detail": "High-risk service rdp on port 3389"
    }
  ],
  "technology_stack": {
    "nginx": 45,
    "Apache": 30,
    "PHP": 25
  },
  "detailed_results": {
    "subdomains": [...],
    "endpoints": [...],
    "port_findings": [...],
    "tls_results": [...],
    "directory_findings": [...]
  }
}
```

### Frontend Usage

1. **Navigate to Reports Page**
   - Go to `/reports` in the application

2. **Filter Scans**
   - Select date range filter (Last 7 Days, Last 30 Days, All Time)

3. **Generate Report**
   - Click on any scan in the list to generate its report
   - Report will be displayed immediately

4. **Download Report**
   - Click "JSON" button to download raw JSON data
   - Click "HTML" button to download formatted HTML report

## Critical Findings Detection

The system automatically identifies these critical security issues:

### High-Risk Ports (Severity: HIGH)
- Port 23 (Telnet) - Cleartext protocol
- Port 3389 (RDP) - Remote Desktop access
- Port 5900+ (VNC) - Remote access
- Any service tagged as "high-risk"

### TLS Issues (Severity: MEDIUM-HIGH)
- Weak TLS 1.0 or 1.1 (Severity: MEDIUM)
- Expired SSL certificates (Severity: HIGH)
- Certificate expiring soon (Severity: LOW)

### Sensitive File Exposure (Severity: CRITICAL)
- `.git` directory exposed
- `.env` file exposed
- Backup directories accessible
- `/admin` paths without authentication

## Report Structure

### Executive Summary
- Total counts of discovered assets
- Alive vs dead hosts
- Security issues summary
- Critical findings count

### Critical Findings
- Top 20 most critical security issues
- Severity classification
- Host identification
- Issue description

### Technology Stack
- Top 15 detected technologies
- Frequency of detection
- Useful for understanding attack surface

### Detailed Results
Complete raw data for:
- All discovered subdomains
- All discovered endpoints
- All open ports with service detection
- All TLS/SSL analysis results
- All directory findings

## HTML Report Features

The generated HTML reports include:
- Professional styling for easy reading
- Color-coded severity indicators
- Responsive design for any screen size
- Organized sections with clear headers
- Printable format
- Self-contained (no external dependencies)

## Security Considerations

1. **Authentication**: All report endpoints require JWT authentication
2. **Authorization**: Users can only access reports for their own scans
3. **Data Sensitivity**: Reports contain sensitive security information
   - Handle with care
   - Share only with authorized personnel
   - Consider encrypting when storing or transmitting

## Example Use Cases

### 1. Bug Bounty Reporting
```javascript
// Generate report for a scan
const report = await generateScanReport(scanId);

// Download as JSON for submission
downloadJSON();
```

### 2. Compliance Documentation
```javascript
// Filter scans from last 30 days
setDateRange("30days");

// Generate reports for each scan
scans.forEach(scan => handleGenerateReport(scan.id));

// Download HTML reports for documentation
downloadHTML();
```

### 3. Security Assessment
```javascript
// Review critical findings
report.critical_findings.forEach(finding => {
  console.log(`${finding.severity}: ${finding.detail}`);
});

// Check for specific vulnerabilities
const hasWeakTLS = report.critical_findings.some(
  f => f.type === "weak_tls"
);
```

## Future Enhancements

Potential additions (not yet implemented):
- PDF export with charts and graphs
- Scheduled report generation
- Email delivery
- Report templates
- Comparison reports (before/after)
- Executive vs technical report formats
- Custom branding
- Report sharing with team members

## Troubleshooting

### Report Generation Fails
- Check if scan is completed (`status === "COMPLETED"`)
- Verify user has permission to access the scan
- Check backend logs for errors

### Empty Report
- Scan may not have collected data yet
- Check if scan completed successfully
- Review scan detail page to verify data exists

### Download Not Working
- Check browser download permissions
- Verify popup blocker is not interfering
- Try different browser

## API Integration Example

```javascript
import { getReportsSummary, generateScanReport } from "../api/api";

// Get all completed scans
const scans = await getReportsSummary("all");

// Filter for completed scans with critical findings
const criticalScans = scans.filter(
  s => s.status === "COMPLETED" && s.has_critical_findings
);

// Generate reports for critical scans
for (const scan of criticalScans) {
  const report = await generateScanReport(scan.id);
  
  // Process critical findings
  const highSeverity = report.critical_findings.filter(
    f => f.severity === "critical" || f.severity === "high"
  );
  
  console.log(`${scan.target}: ${highSeverity.length} high-severity issues`);
}
```

## Summary

The reporting feature provides a simple, effective way to:
- ✅ Generate comprehensive security reports
- ✅ Identify critical vulnerabilities automatically
- ✅ Export data in multiple formats
- ✅ Share findings with stakeholders
- ✅ Document security assessments

All with just a few clicks!
