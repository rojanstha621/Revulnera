// src/pages/Reports.jsx
import React, { useState, useEffect } from "react";
import { 
  FileText, Calendar, Download, AlertTriangle, CheckCircle, 
  Shield, Globe, Lock, Server, Activity 
} from "lucide-react";
import { getReportsSummary, generateScanReport } from "../api/api";
import { emitErrorToast } from "../utils/errorUtils";

export default function Reports() {
  // User-selected scan window filter shown as quick range buttons.
  const [dateRange, setDateRange] = useState("all");
  // List of scans used to choose which report to generate.
  const [scans, setScans] = useState([]);
  // Loading state for initial scan list fetch.
  const [loading, setLoading] = useState(true);
  // Tracks the currently selected scan id.
  const [selectedScan, setSelectedScan] = useState(null);
  // Full report payload returned by backend.
  const [report, setReport] = useState(null);
  // Loading state for report generation call.
  const [reportLoading, setReportLoading] = useState(false);
  // Download UI feedback state for export buttons.
  const [downloadStatus, setDownloadStatus] = useState(null); // null, 'downloading', 'success', 'error'

  useEffect(() => {
    loadScans();
  }, [dateRange]);

  const loadScans = async () => {
    try {
      setLoading(true);
      // Get report-ready scan summaries for selected date range.
      const data = await getReportsSummary(dateRange);
      setScans(data || []);
    } catch (err) {
      console.error("Error loading scans:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (scanId) => {
    try {
      setReportLoading(true);
      setSelectedScan(scanId);
      // Fetch one fully aggregated report from backend.
      const reportData = await generateScanReport(scanId);
      setReport(reportData);
      
      // Scroll to report after a brief delay to ensure render
      setTimeout(() => {
        const reportElement = document.getElementById('report-display');
        if (reportElement) {
          reportElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    } catch (err) {
      console.error("Error generating report:", err);
      emitErrorToast("Failed to generate report: " + (err.message || "Unknown error"));
    } finally {
      setReportLoading(false);
    }
  };

  const downloadJSON = () => {
    if (!report) {
      console.error("No report data available");
      return;
    }
    
    if (downloadStatus === 'downloading') return; // Prevent duplicate clicks
    
    setDownloadStatus('downloading');
    
    try {
      // JSON export keeps the complete report structure for API/tool reuse.
      const dataStr = JSON.stringify(report, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      
      // Sanitize filename - remove special characters
      const safeTarget = report.scan_info.target.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `scan-report-${safeTarget}-${report.scan_info.id}.json`;
      
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      
      // Force reflow to ensure link is in DOM
      link.offsetHeight;
      
      // Use requestAnimationFrame for better browser compatibility
      requestAnimationFrame(() => {
        link.click();
        
        // Clean up after delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1000);
      });
      
      setDownloadStatus('success');
      setTimeout(() => setDownloadStatus(null), 3000);
    } catch (error) {
      console.error("Download failed:", error);
      setDownloadStatus('error');
      setTimeout(() => setDownloadStatus(null), 3000);
    }
  };

  const downloadHTML = () => {
    if (!report) {
      console.error("No report data available");
      return;
    }
    
    if (downloadStatus === 'downloading') return; // Prevent duplicate clicks
    
    setDownloadStatus('downloading');
    
    try {
      // HTML export is generated client-side from current report payload.
      const html = generateHTMLReport(report);
      const dataBlob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(dataBlob);
      
      // Sanitize filename - remove special characters
      const safeTarget = report.scan_info.target.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `scan-report-${safeTarget}-${report.scan_info.id}.html`;
      
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      
      // Force reflow to ensure link is in DOM
      link.offsetHeight;
      
      // Use requestAnimationFrame for better browser compatibility
      requestAnimationFrame(() => {
        link.click();
        
        // Clean up after delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1000);
      });
      
      setDownloadStatus('success');
      setTimeout(() => setDownloadStatus(null), 3000);
    } catch (error) {
      console.error("Download failed:", error);
      setDownloadStatus('error');
      setTimeout(() => setDownloadStatus(null), 3000);
    }
  };

  const downloadCSV = () => {
    if (!report) {
      console.error("No report data available");
      return;
    }
    
    if (downloadStatus === 'downloading') return; // Prevent duplicate clicks
    
    setDownloadStatus('downloading');
    
    try {
      // Create CSV content with critical findings
      let csv = "Type,Severity,Host,Detail\n";
      
      if (report.critical_findings) {
        report.critical_findings.forEach(finding => {
          const type = (finding.type || '').replace(/,/g, ';');
          const severity = (finding.severity || '').replace(/,/g, ';');
          const host = (finding.host || '').replace(/,/g, ';');
          const detail = (finding.detail || '').replace(/,/g, ';');
          csv += `"${type}","${severity}","${host}","${detail}"\n`;
        });
      }
      
      // Add a compact subdomain appendix (trimmed for spreadsheet readability).
      csv += "\n\nSubdomains\n";
      csv += "Name,IP,Status\n";
      if (report.detailed_results?.subdomains) {
        report.detailed_results.subdomains.slice(0, 100).forEach(sub => {
          const name = (sub.name || '').replace(/,/g, ';');
          const ip = (sub.ips && sub.ips.length > 0 ? sub.ips.join(';') : 'N/A').replace(/,/g, ';');
          const status = sub.alive ? 'Alive' : 'Down';
          csv += `"${name}","${ip}","${status}"\n`;
        });
      }
      
      const dataBlob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(dataBlob);
      
      // Sanitize filename - remove special characters
      const safeTarget = report.scan_info.target.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `scan-report-${safeTarget}-${report.scan_info.id}.csv`;
      
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      
      // Force reflow to ensure link is in DOM
      link.offsetHeight;
      
      // Use requestAnimationFrame for better browser compatibility
      requestAnimationFrame(() => {
        link.click();
        
        // Clean up after delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1000);
      });
      
      setDownloadStatus('success');
      setTimeout(() => setDownloadStatus(null), 3000);
    } catch (error) {
      console.error("Download failed:", error);
      setDownloadStatus('error');
      setTimeout(() => setDownloadStatus(null), 3000);
    }
  };

  const getSeverityColor = (severity) => {
    // Map severity to badge background/text styles for quick visual scanning.
    switch (severity) {
      case "critical": return "text-red-400 bg-red-500/20 border-red-500/30";
      case "high": return "text-slate-400 bg-slate-500/20 border-slate-500/30";
      case "medium": return "text-gray-400 bg-gray-500/20 border-gray-500/30";
      case "low": return "text-blue-400 bg-blue-500/20 border-blue-500/30";
      default: return "text-gray-400 bg-gray-500/20 border-gray-500/30";
    }
  };

  const normalizeSeverity = (severity) => {
    // Normalize incoming values so scoring always works with known levels.
    const value = String(severity || "").toLowerCase();
    if (["critical", "high", "medium", "low"].includes(value)) {
      return value;
    }
    return "low";
  };

  const getRiskScore = (reportData) => {
    // Heuristic risk score (0-100) derived from finding severity + exposure counts.
    const findings = reportData?.critical_findings || [];
    const severityWeights = { critical: 25, high: 15, medium: 8, low: 3 };

    const findingRisk = findings.reduce((sum, finding) => {
      return sum + (severityWeights[normalizeSeverity(finding.severity)] || 0);
    }, 0);

    const exposureRisk =
      (reportData?.summary?.high_risk_ports || 0) * 5 +
      (reportData?.summary?.tls_issues || 0) * 3 +
      (reportData?.summary?.directory_issues || 0) * 4;

    return Math.min(100, findingRisk + exposureRisk);
  };

  const getRiskLabel = (score) => {
    // Human-friendly score buckets for dashboard readability.
    if (score >= 75) return "Critical";
    if (score >= 50) return "High";
    if (score >= 25) return "Medium";
    return "Low";
  };

  const getRiskLabelColor = (label) => {
    // Keep risk wording and color aligned in cards/badges.
    if (label === "Critical") return "text-red-400";
    if (label === "High") return "text-slate-400";
    if (label === "Medium") return "text-gray-400";
    return "text-blue-400";
  };

  const getSeverityBreakdown = (reportData) => {
    // Count findings by severity for compact "what's most urgent" view.
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    (reportData?.critical_findings || []).forEach((finding) => {
      counts[normalizeSeverity(finding.severity)] += 1;
    });
    return counts;
  };

  const getTopRiskHosts = (reportData) => {
    // Rank hosts by highest observed severity, then number of findings.
    const hostMap = {};
    const severityScores = { critical: 4, high: 3, medium: 2, low: 1 };

    (reportData?.critical_findings || []).forEach((finding) => {
      const host = finding.host || "unknown";
      if (!hostMap[host]) {
        hostMap[host] = { host, findings: 0, maxSeverityScore: 0 };
      }
      hostMap[host].findings += 1;
      hostMap[host].maxSeverityScore = Math.max(
        hostMap[host].maxSeverityScore,
        severityScores[normalizeSeverity(finding.severity)] || 1
      );
    });

    return Object.values(hostMap)
      .sort((a, b) => {
        if (b.maxSeverityScore !== a.maxSeverityScore) {
          return b.maxSeverityScore - a.maxSeverityScore;
        }
        return b.findings - a.findings;
      })
      .slice(0, 5);
  };

  const getScannerCoverage = (reportData) => {
    // Explain what scanner modules produced usable data in this report.
    const details = reportData?.detailed_results || {};

    return [
      {
        key: "subdomains",
        label: "Subdomain Discovery",
        description: "Finds internet-facing assets related to your target.",
        value: details.subdomains?.length || 0,
      },
      {
        key: "endpoints",
        label: "Endpoint Mapping",
        description: "Maps pages and API routes that users or attackers can reach.",
        value: details.endpoints?.length || 0,
      },
      {
        key: "ports",
        label: "Port & Service Scan",
        description: "Checks network doors and service banners exposed to the internet.",
        value: details.port_findings?.length || 0,
      },
      {
        key: "tls",
        label: "TLS/SSL Inspection",
        description: "Validates encryption versions, certificates, and protocol weaknesses.",
        value: details.tls_results?.length || 0,
      },
      {
        key: "directories",
        label: "Directory Exposure Check",
        description: "Finds sensitive paths, open listings, and accidental leaks.",
        value: details.directory_findings?.length || 0,
      },
    ];
  };

  const getEndpointOverview = (reportData) => {
    // Summarize endpoint health and identify auth/admin-heavy attack surface.
    const endpoints = reportData?.detailed_results?.endpoints || [];
    const overview = {
      total: endpoints.length,
      healthy: 0,
      redirects: 0,
      clientErrors: 0,
      serverErrors: 0,
      authRelated: 0,
      adminRelated: 0,
    };

    endpoints.forEach((endpoint) => {
      const statusCode = Number(endpoint.status_code) || 0;
      const url = String(endpoint.url || "").toLowerCase();

      if (statusCode >= 200 && statusCode < 300) overview.healthy += 1;
      else if (statusCode >= 300 && statusCode < 400) overview.redirects += 1;
      else if (statusCode >= 400 && statusCode < 500) overview.clientErrors += 1;
      else if (statusCode >= 500) overview.serverErrors += 1;

      if (/(login|signin|auth|token|oauth)/.test(url)) overview.authRelated += 1;
      if (/(admin|dashboard|manage|panel)/.test(url)) overview.adminRelated += 1;
    });

    return overview;
  };

  const getActionPlan = (reportData) => {
    // Convert findings into plain-language next actions for non-technical viewers.
    const actions = [];
    const summary = reportData?.summary || {};
    const severity = getSeverityBreakdown(reportData);

    if (severity.critical > 0) {
      actions.push("Contain critical findings first, especially exposed secrets and high-impact hosts.");
    }
    if (summary.high_risk_ports > 0) {
      actions.push("Close unnecessary high-risk ports and restrict access to trusted IPs only.");
    }
    if (summary.tls_issues > 0) {
      actions.push("Disable weak TLS versions and renew or replace any weak/expired certificates.");
    }
    if (summary.directory_issues > 0) {
      actions.push("Block public access to sensitive directories and disable directory listing.");
    }
    if ((reportData?.detailed_results?.endpoints || []).length > 0) {
      actions.push("Review high-value endpoints (admin/auth) and enforce strict authentication and rate limits.");
    }
    if (actions.length === 0) {
      actions.push("No urgent issues found. Keep regular scans and patching cadence to maintain posture.");
    }

    return actions.slice(0, 5);
  };

  const getGrcData = (reportData) => reportData?.grc || {};

  const getGrcRiskLabelColor = (label) => {
    if (label === "Critical") return "text-red-400";
    if (label === "High") return "text-slate-400";
    if (label === "Medium") return "text-gray-400";
    return "text-blue-400";
  };

  const getControlStatusColor = (status) => {
    if (status === "healthy") return "text-green-400 bg-green-500/20 border-green-500/30";
    if (status === "partial") return "text-yellow-300 bg-yellow-500/20 border-yellow-500/30";
    return "text-red-300 bg-red-500/20 border-red-500/30";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3 animate-slide-up">
        <h1 className="text-4xl font-bold text-cyan-300">Reports & Analytics</h1>
        <p className="text-gray-400 mt-2">Generate comprehensive security assessment reports</p>
      </div>

      {/* Date Range Filter */}
      <div className="card animate-slide-up">
        <h2 className="text-xl font-semibold text-white mb-4">Filter Scans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { value: "7days", label: "Last 7 Days" },
            { value: "30days", label: "Last 30 Days" },
            { value: "all", label: "All Time" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setDateRange(option.value)}
              className={`p-4 rounded-lg border-2 transition-all ${
                dateRange === option.value
                  ? "bg-slate-600/30 border-slate-500 text-slate-300"
                  : "bg-white/5 border-white/10 text-gray-300 hover:border-slate-500/50"
              }`}
            >
              <Calendar className="w-5 h-5 mx-auto mb-2" />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scans List */}
      <div className="card animate-slide-up">
        <h2 className="text-xl font-semibold text-white mb-4">Available Scans</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading scans...</div>
        ) : scans.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No scans found</div>
        ) : (
          <div className="space-y-3">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className={`p-4 rounded-lg border transition-all ${
                  selectedScan === scan.id
                    ? "bg-slate-500/20 border-slate-500"
                    : "bg-white/5 border-white/10 hover:border-slate-500/50"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-slate-400" />
                      <h3 className="text-lg font-semibold text-white">{scan.target}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        scan.status === "COMPLETED" ? "bg-green-500/20 text-green-400" :
                        scan.status === "FAILED" ? "bg-red-500/20 text-red-400" :
                        "bg-gray-500/20 text-gray-400"
                      }`}>
                        {scan.status}
                      </span>
                      {scan.has_critical_findings && (
                        <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Critical Findings
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>ID: {scan.id}</span>
                      <span>•</span>
                      <span>{new Date(scan.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span>{scan.subdomain_count} subdomains</span>
                      <span>•</span>
                      <span>{scan.endpoint_count} endpoints</span>
                      <span>•</span>
                      <span>{scan.port_findings_count} ports</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleGenerateReport(scan.id)}
                    className="btn-primary flex items-center gap-2 px-4 py-2 whitespace-nowrap"
                    disabled={reportLoading && selectedScan === scan.id}
                  >
                    {reportLoading && selectedScan === scan.id ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Generate Report</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Display */}
      {reportLoading && (
        <div id="report-display" className="card animate-slide-up text-center py-12">
          <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Generating report...</p>
        </div>
      )}

      {report && !reportLoading && (
        <div id="report-display" className="space-y-6 animate-slide-up">
          {/* Report Header */}
          <div className="card bg-slate-900/90 border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Vulnerability Scanner Report
                </h2>
                <p className="text-gray-300">Target: {report.scan_info.target}</p>
                <p className="text-gray-400 text-sm">
                  Generated: {new Date(report.scan_info.updated_at).toLocaleString()}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Easy view: this report explains what was scanned, what was found, and what to fix first.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {downloadStatus && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50">
                    {downloadStatus === 'downloading' && (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                        <span className="text-sm text-blue-400">Preparing download...</span>
                      </>
                    )}
                    {downloadStatus === 'success' && (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400">Downloaded successfully!</span>
                      </>
                    )}
                    {downloadStatus === 'error' && (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400">Download failed</span>
                      </>
                    )}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={downloadJSON}
                    className="btn-secondary flex items-center gap-2 cursor-pointer"
                    title="Download complete data in JSON format"
                  >
                    <Download className="w-4 h-4" />
                    JSON
                  </button>
                  <button
                    onClick={downloadHTML}
                    className="btn-primary flex items-center gap-2 cursor-pointer"
                    title="Download formatted HTML report"
                  >
                    <Download className="w-4 h-4" />
                    HTML
                  </button>
                  <button
                    onClick={downloadCSV}
                    className="btn-secondary flex items-center gap-2 cursor-pointer"
                    title="Download findings in CSV format (Excel compatible)"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <Globe className="w-6 h-6 text-blue-400 mb-2" />
                <div className="text-2xl font-bold text-white">
                  {report.summary.total_subdomains}
                </div>
                <div className="text-xs text-gray-400">
                  Subdomains Discovered
                </div>
                <div className="text-xs text-green-400 mt-1">
                  {report.summary.alive_subdomains} alive
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <Server className="w-6 h-6 text-slate-400 mb-2" />
                <div className="text-2xl font-bold text-white">
                  {report.summary.total_endpoints}
                </div>
                <div className="text-xs text-gray-400">
                  Endpoints Mapped
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <Lock className="w-6 h-6 text-gray-400 mb-2" />
                <div className="text-2xl font-bold text-white">
                  {report.summary.total_open_ports}
                </div>
                <div className="text-xs text-gray-400">
                  Open Ports
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {report.summary.high_risk_ports} high-risk
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <AlertTriangle className="w-6 h-6 text-red-400 mb-2" />
                <div className="text-2xl font-bold text-white">
                  {report.summary.critical_findings_count}
                </div>
                <div className="text-xs text-gray-400">
                  Critical + High Findings
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Risk Score</p>
                <p className="text-3xl font-bold text-white">{getRiskScore(report)}/100</p>
                <p className={`text-sm mt-1 font-semibold ${getRiskLabelColor(getRiskLabel(getRiskScore(report)))}`}>
                  {getRiskLabel(getRiskScore(report))} Risk
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Finding Breakdown</p>
                {Object.entries(getSeverityBreakdown(report)).map(([level, count]) => (
                  <div key={level} className="flex items-center justify-between text-sm text-gray-300">
                    <span className="capitalize">{level}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Scanner Confidence</p>
                <p className="text-2xl font-bold text-white">
                  {Math.min(100, Math.round((getScannerCoverage(report).filter((item) => item.value > 0).length / 5) * 100))}%
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Based on how many scanner modules returned data.
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Scanner Coverage Snapshot
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getScannerCoverage(report).map((item) => (
                <div key={item.key} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-2xl font-bold text-cyan-300 mt-1">{item.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-slate-300" />
              Attack Surface Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-400">Healthy (2xx)</p>
                <p className="text-xl text-white font-bold">{getEndpointOverview(report).healthy}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-400">Redirects (3xx)</p>
                <p className="text-xl text-white font-bold">{getEndpointOverview(report).redirects}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-400">Client Errors (4xx)</p>
                <p className="text-xl text-white font-bold">{getEndpointOverview(report).clientErrors}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-400">Server Errors (5xx)</p>
                <p className="text-xl text-white font-bold">{getEndpointOverview(report).serverErrors}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-400">Authentication-Related Endpoints</p>
                <p className="text-lg text-white font-semibold">{getEndpointOverview(report).authRelated}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-400">Admin/Management Endpoints</p>
                <p className="text-lg text-white font-semibold">{getEndpointOverview(report).adminRelated}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-slate-400" />
              Priority Action Plan
            </h3>
            <div className="space-y-2">
              {getActionPlan(report).map((action, index) => (
                <div key={index} className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-500/30 text-slate-200 text-xs font-bold">
                    {index + 1}
                  </span>
                  <p className="text-sm text-gray-200">{action}</p>
                </div>
              ))}
            </div>
          </div>

          {getGrcData(report) && (
            <div className="card border border-cyan-500/20 bg-slate-950/70">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-300" />
                GRC Snapshot
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Risk Posture</p>
                  <p className="text-3xl font-bold text-white">{getGrcData(report)?.risk?.score ?? getRiskScore(report)}</p>
                  <p className={`text-sm mt-1 font-semibold ${getGrcRiskLabelColor(getGrcData(report)?.risk?.level || getRiskLabel(getRiskScore(report)))}`}>
                    {getGrcData(report)?.risk?.level || getRiskLabel(getRiskScore(report))}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Governance</p>
                  <p className="text-sm text-white font-semibold">{getGrcData(report)?.governance?.report_owner}</p>
                  <p className="text-xs text-gray-400 mt-1">{getGrcData(report)?.governance?.report_scope}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Compliance Mappings</p>
                  <p className="text-3xl font-bold text-white">{getGrcData(report)?.compliance_mappings?.length || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">Framework/control relationships</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Remediation Queue</p>
                  <p className="text-3xl font-bold text-white">{getGrcData(report)?.remediation_plan?.length || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">Prioritized follow-up actions</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                {(getGrcData(report)?.control_coverage || []).map((control) => (
                  <div key={control.control} className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{control.control}</p>
                        <p className="text-xs text-gray-400">{control.framework}</p>
                      </div>
                      <span className={`px-2 py-1 rounded border text-xs ${getControlStatusColor(control.status)}`}>
                        {control.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{control.description}</p>
                    <p className="text-xs text-gray-400 mt-2">Evidence count: {control.evidence}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <p className="text-sm font-semibold text-white mb-3">Compliance Frameworks</p>
                  <div className="space-y-3">
                    {(getGrcData(report)?.compliance_mappings || []).map((mapping) => (
                      <div key={`${mapping.framework}-${mapping.identifier}`} className="rounded-lg bg-slate-900/60 border border-white/5 p-3">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <p className="text-sm font-semibold text-white">{mapping.framework}</p>
                          <p className="text-xs text-cyan-300">{mapping.identifier}</p>
                        </div>
                        <p className="text-sm text-gray-200">{mapping.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{mapping.description}</p>
                      </div>
                    ))}
                    {(getGrcData(report)?.compliance_mappings || []).length === 0 && (
                      <p className="text-sm text-gray-400">No compliance mappings were derived for this scan.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <p className="text-sm font-semibold text-white mb-3">Remediation Plan</p>
                  <div className="space-y-3">
                    {(getGrcData(report)?.remediation_plan || []).map((item) => (
                      <div key={item.priority} className="rounded-lg bg-slate-900/60 border border-white/5 p-3">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="text-xs text-gray-400">Priority {item.priority}</p>
                        </div>
                        <p className="text-xs text-gray-400">Owner: {item.owner} · Effort: {item.effort}</p>
                        <p className="text-sm text-gray-200 mt-1">{item.details}</p>
                      </div>
                    ))}
                    {(getGrcData(report)?.remediation_plan || []).length === 0 && (
                      <p className="text-sm text-gray-400">No remediation actions were generated for this scan.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Critical Findings */}
          {report.critical_findings && report.critical_findings.length > 0 && (
            <div className="card">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Critical Findings
              </h3>
              <div className="space-y-3">
                {report.critical_findings.map((finding, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${getSeverityColor(finding.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold uppercase text-xs px-2 py-1 rounded">
                            {finding.severity}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-300">{finding.host}</span>
                        </div>
                        <p className="text-sm">{finding.detail}</p>
                        {finding.type && (
                          <p className="text-xs text-gray-400 mt-1">Type: {finding.type}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {getTopRiskHosts(report).length > 0 && (
            <div className="card">
              <h3 className="text-xl font-semibold text-white mb-4">Most Exposed Hosts</h3>
              <div className="space-y-2">
                {getTopRiskHosts(report).map((item) => (
                  <div key={item.host} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                    <div>
                      <p className="text-white font-medium">{item.host}</p>
                      <p className="text-xs text-gray-400">Findings: {item.findings}</p>
                    </div>
                    <p className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300">
                      Severity Score {item.maxSeverityScore}/4
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technology Stack */}
          {report.technology_stack && Object.keys(report.technology_stack).length > 0 && (
            <div className="card">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                Detected Technologies
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Technologies observed across discovered pages and endpoints.
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.technology_stack).map(([tech, count]) => (
                  <span
                    key={tech}
                    className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
                  >
                    {tech} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional Issues Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-3">
                TLS/SSL Issues
              </h3>
              <div className="text-3xl font-bold text-gray-400">
                {report.summary.tls_issues}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Total TLS/SSL configuration issues detected
              </p>
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-3">
                Directory Issues
              </h3>
              <div className="text-3xl font-bold text-slate-400">
                {report.summary.directory_issues}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Directories with public listing or sensitive exposure
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to generate HTML report
function generateHTMLReport(report) {
  // Build a standalone HTML document that can be shared offline.
  const findings = report.critical_findings || [];
  const severityCounts = findings.reduce((acc, finding) => {
    const sev = String(finding.severity || "low").toLowerCase();
    if (!acc[sev]) acc[sev] = 0;
    acc[sev] += 1;
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0 });

  const riskScore = Math.min(
    100,
    findings.reduce((sum, finding) => {
      const sev = String(finding.severity || "low").toLowerCase();
      if (sev === "critical") return sum + 25;
      if (sev === "high") return sum + 15;
      if (sev === "medium") return sum + 8;
      return sum + 3;
    }, 0) +
      (report.summary.high_risk_ports || 0) * 5 +
      (report.summary.tls_issues || 0) * 3 +
      (report.summary.directory_issues || 0) * 4
  );

  const endpointOverview = (report.detailed_results?.endpoints || []).reduce(
    (acc, endpoint) => {
      const status = Number(endpoint.status_code) || 0;
      if (status >= 200 && status < 300) acc.healthy += 1;
      else if (status >= 300 && status < 400) acc.redirects += 1;
      else if (status >= 400 && status < 500) acc.clientErrors += 1;
      else if (status >= 500) acc.serverErrors += 1;
      return acc;
    },
    { healthy: 0, redirects: 0, clientErrors: 0, serverErrors: 0 }
  );

  const grc = report.grc || {};
  const grcRiskScore = grc.risk?.score ?? riskScore;
  const grcRiskLevel = grc.risk?.level || (grcRiskScore >= 75 ? "Critical" : grcRiskScore >= 50 ? "High" : grcRiskScore >= 25 ? "Medium" : "Low");
  const grcControlCoverage = grc.control_coverage || [];
  const grcComplianceMappings = grc.compliance_mappings || [];
  const grcRemediationPlan = grc.remediation_plan || [];

  // Entire HTML and CSS are embedded so the exported file has no external dependencies.
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Assessment Report - ${report.scan_info.target}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6; 
            color: #333; 
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #6366f1; border-bottom: 3px solid #6366f1; padding-bottom: 10px; margin-bottom: 20px; }
        h2 { color: #4f46e5; margin-top: 30px; margin-bottom: 15px; }
        .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #6366f1; }
        .stat-value { font-size: 32px; font-weight: bold; color: #4f46e5; }
        .stat-label { color: #666; font-size: 14px; margin-top: 5px; }
        .finding { padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid; }
        .critical { background: #fee; border-color: #dc2626; }
        .high { background: #fef3cd; border-color: #ea580c; }
        .medium { background: #fef9c3; border-color: #eab308; }
        .severity { font-weight: bold; text-transform: uppercase; font-size: 12px; }
        .tech-tag { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 5px 12px; border-radius: 20px; margin: 5px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #666; font-size: 14px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ Security Assessment Report</h1>
        <div class="meta">
            <strong>Target:</strong> ${report.scan_info.target}<br>
            <strong>Scan ID:</strong> ${report.scan_info.id}<br>
            <strong>Status:</strong> ${report.scan_info.status}<br>
            <strong>Generated:</strong> ${new Date(report.scan_info.updated_at).toLocaleString()}<br>
            <strong>Created by:</strong> ${report.scan_info.created_by}
        </div>

        <h2>📊 Executive Summary</h2>
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${report.summary.total_subdomains}</div>
                <div class="stat-label">Total Subdomains (${report.summary.alive_subdomains} alive)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.total_endpoints}</div>
                <div class="stat-label">Endpoints Discovered</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.total_open_ports}</div>
                <div class="stat-label">Open Ports (${report.summary.high_risk_ports} high-risk)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.critical_findings_count}</div>
                <div class="stat-label">Critical Findings</div>
            </div>
        </div>

          <h2>🧭 Risk Posture</h2>
            <p><strong>Risk Score:</strong> ${grcRiskScore}/100</p>
            <p><strong>Risk Level:</strong> ${grcRiskLevel}</p>
            <p><strong>Severity Mix:</strong> Critical ${severityCounts.critical}, High ${severityCounts.high}, Medium ${severityCounts.medium}, Low ${severityCounts.low}</p>

            <h2>📘 Governance Snapshot</h2>
            <p><strong>Owner:</strong> ${grc.governance?.report_owner || report.scan_info.created_by}</p>
            <p><strong>Scope:</strong> ${grc.governance?.report_scope || report.scan_info.target}</p>
            <p><strong>Policy Alignment:</strong> ${(grc.governance?.policy_alignment || []).join(", ") || "Not set"}</p>

            <h2>🧩 Control Coverage</h2>
            ${grcControlCoverage.map((control) => `
            <p><strong>${control.control}</strong> (${control.framework}) - ${control.status} (${control.evidence} evidence items)</p>
            <p>${control.description}</p>
            `).join('')}

            <h2>📚 Compliance Mappings</h2>
            ${grcComplianceMappings.map((mapping) => `
            <p><strong>${mapping.framework}</strong> ${mapping.identifier} - ${mapping.name}</p>
            <p>${mapping.description}</p>
            `).join('') || '<p>No compliance mappings were derived for this scan.</p>'}

            <h2>🛠 Remediation Plan</h2>
            ${grcRemediationPlan.map((item) => `
            <p><strong>Priority ${item.priority}:</strong> ${item.title}</p>
            <p>Owner: ${item.owner} | Effort: ${item.effort}</p>
            <p>${item.details}</p>
            `).join('') || '<p>No remediation actions were generated for this scan.</p>'}

          <h2>🎯 Endpoint Health</h2>
          <p><strong>2xx Healthy:</strong> ${endpointOverview.healthy}</p>
          <p><strong>3xx Redirects:</strong> ${endpointOverview.redirects}</p>
          <p><strong>4xx Client Errors:</strong> ${endpointOverview.clientErrors}</p>
          <p><strong>5xx Server Errors:</strong> ${endpointOverview.serverErrors}</p>

        ${report.critical_findings && report.critical_findings.length > 0 ? `
        <h2>🚨 Critical Findings</h2>
        ${report.critical_findings.map(f => `
            <div class="finding ${f.severity}">
                <span class="severity">${f.severity}</span> - <strong>${f.host}</strong><br>
                ${f.detail}
            </div>
        `).join('')}
        ` : ''}

        ${report.technology_stack && Object.keys(report.technology_stack).length > 0 ? `
        <h2>🔧 Technology Stack</h2>
        <div>
            ${Object.entries(report.technology_stack).map(([tech, count]) => 
                `<span class="tech-tag">${tech} (${count})</span>`
            ).join('')}
        </div>
        ` : ''}

        <h2>🔐 Security Issues</h2>
        <p><strong>TLS/SSL Issues:</strong> ${report.summary.tls_issues}</p>
        <p><strong>Directory Issues:</strong> ${report.summary.directory_issues}</p>
        <p><strong>High-Risk Open Ports:</strong> ${report.summary.high_risk_ports}</p>

        <div class="footer">
            <p><strong>Revulnera Security Scanner</strong></p>
            <p>This report contains sensitive security information. Handle with care.</p>
        </div>
    </div>
</body>
</html>
  `.trim();
}
