// src/pages/Reports.jsx
import React, { useState, useEffect } from "react";
import { 
  FileText, Calendar, Download, AlertTriangle, CheckCircle, 
  XCircle, Shield, Globe, Lock, FolderOpen, Server, Activity 
} from "lucide-react";
import { getReportsSummary, generateScanReport } from "../api/api";

export default function Reports() {
  const [dateRange, setDateRange] = useState("all");
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState(null);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(null); // null, 'downloading', 'success', 'error'
  const [beginnerMode, setBeginnerMode] = useState(false); // Toggle for beginner-friendly explanations

  useEffect(() => {
    loadScans();
  }, [dateRange]);

  const loadScans = async () => {
    try {
      setLoading(true);
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
      alert("Failed to generate report: " + (err.message || "Unknown error"));
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
      
      // Add subdomains section
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
    switch (severity) {
      case "critical": return "text-red-400 bg-red-500/20 border-red-500/30";
      case "high": return "text-orange-400 bg-orange-500/20 border-orange-500/30";
      case "medium": return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
      case "low": return "text-blue-400 bg-blue-500/20 border-blue-500/30";
      default: return "text-gray-400 bg-gray-500/20 border-gray-500/30";
    }
  };

  // Beginner-friendly explanations
  const getBeginnerExplanation = (type, detail) => {
    const explanations = {
      "Open High-Risk Port": `This means a door (port) on the server is open that hackers commonly target. It's like leaving a window unlocked in your house.`,
      "Weak TLS": `The security lock (encryption) protecting data transfer is old and weak. Modern hackers can break it. Like using an old padlock that's easy to pick.`,
      "Exposed Admin Panel": `The website's control panel (where admins log in) is publicly visible. This is like having your house's alarm system controls on the front porch.`,
      "Directory Listing": `The website shows all its files and folders publicly. Like leaving your filing cabinet open for anyone to browse through.`,
      "Sensitive File Exposed": `Important files (like configuration or backup files) are accessible to anyone. Like leaving your diary on a public bench.`,
      "HTTP Only (No HTTPS)": `The website doesn't use encryption, so anyone can read the data being sent. Like sending a postcard instead of a sealed letter.`,
    };

    // Try to match the finding type
    for (const [key, explanation] of Object.entries(explanations)) {
      if (type && type.includes(key)) return explanation;
      if (detail && detail.includes(key)) return explanation;
    }

    // Default explanation
    if (detail && detail.toLowerCase().includes('port')) {
      return 'An entry point to the server is open. Some are normal, others might be risky if not properly secured.';
    }
    
    return 'This is a security concern that should be reviewed by a technical team member.';
  };

  const getSeverityExplanation = (severity) => {
    const explanations = {
      critical: "🚨 URGENT: This is a serious security risk that could lead to your system being hacked. Fix immediately!",
      high: "⚠️ IMPORTANT: This is a significant security weakness that should be fixed soon to prevent attacks.",
      medium: "⚡ MODERATE: This is a security concern that should be addressed to improve your defenses.",
      low: "ℹ️ MINOR: This is a small issue that's good to fix but not immediately critical.",
    };
    return explanations[severity] || "This requires attention from security experts.";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3 animate-slide-up">
        <h1 className="text-4xl font-bold text-gradient">Reports & Analytics</h1>
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
                  ? "bg-purple-600/30 border-purple-500 text-purple-300"
                  : "bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/50"
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
                    ? "bg-purple-500/20 border-purple-500"
                    : "bg-white/5 border-white/10 hover:border-purple-500/50"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-purple-400" />
                      <h3 className="text-lg font-semibold text-white">{scan.target}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        scan.status === "COMPLETED" ? "bg-green-500/20 text-green-400" :
                        scan.status === "FAILED" ? "bg-red-500/20 text-red-400" :
                        "bg-yellow-500/20 text-yellow-400"
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
          <Activity className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Generating report...</p>
        </div>
      )}

      {report && !reportLoading && (
        <div id="report-display" className="space-y-6 animate-slide-up">
          {/* Report Header */}
          <div className="card bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            {/* Beginner Mode Toggle */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">View Mode:</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-800/50 rounded-full p-1">
                <button
                  onClick={() => setBeginnerMode(false)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    !beginnerMode 
                      ? 'bg-purple-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Technical
                </button>
                <button
                  onClick={() => setBeginnerMode(true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    beginnerMode 
                      ? 'bg-green-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Beginner-Friendly
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Security Assessment Report
                </h2>
                <p className="text-gray-300">Target: {report.scan_info.target}</p>
                <p className="text-gray-400 text-sm">
                  Generated: {new Date(report.scan_info.updated_at).toLocaleString()}
                </p>
                {beginnerMode && (
                  <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-green-400 text-sm">
                      📚 <strong>Beginner Mode:</strong> Technical terms are explained in simple language. 
                    </p>
                  </div>
                )}
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
                  {beginnerMode ? "Web Addresses Found" : "Subdomains"}
                </div>
                <div className="text-xs text-green-400 mt-1">
                  {report.summary.alive_subdomains} {beginnerMode ? "active" : "alive"}
                </div>
                {beginnerMode && (
                  <div className="text-xs text-gray-500 mt-1">
                    (like blog.site.com, mail.site.com)
                  </div>
                )}
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <Server className="w-6 h-6 text-purple-400 mb-2" />
                <div className="text-2xl font-bold text-white">
                  {report.summary.total_endpoints}
                </div>
                <div className="text-xs text-gray-400">
                  {beginnerMode ? "Pages & APIs" : "Endpoints"}
                </div>
                {beginnerMode && (
                  <div className="text-xs text-gray-500 mt-1">
                    (individual web pages and services)
                  </div>
                )}
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <Lock className="w-6 h-6 text-yellow-400 mb-2" />
                <div className="text-2xl font-bold text-white">
                  {report.summary.total_open_ports}
                </div>
                <div className="text-xs text-gray-400">
                  {beginnerMode ? "Open Entry Points" : "Open Ports"}
                </div>
                <div className="text-xs text-orange-400 mt-1">
                  {report.summary.high_risk_ports} {beginnerMode ? "risky" : "high-risk"}
                </div>
                {beginnerMode && (
                  <div className="text-xs text-gray-500 mt-1">
                    (doors through which services communicate)
                  </div>
                )}
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <AlertTriangle className="w-6 h-6 text-red-400 mb-2" />
                <div className="text-2xl font-bold text-white">
                  {report.summary.critical_findings_count}
                </div>
                <div className="text-xs text-gray-400">
                  {beginnerMode ? "Security Issues" : "Critical Findings"}
                </div>
                {beginnerMode && (
                  <div className="text-xs text-gray-500 mt-1">
                    (problems that need attention)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Critical Findings */}
          {report.critical_findings && report.critical_findings.length > 0 && (
            <div className="card">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                {beginnerMode ? "🔍 Security Issues Found" : "Critical Findings"}
              </h3>
              {beginnerMode && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-400 text-sm">
                    💡 <strong>What is this?</strong> These are potential security weaknesses we found. 
                    Think of them as unlocked doors or windows in your digital house that could let bad actors in.
                  </p>
                </div>
              )}
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
                        
                        {beginnerMode ? (
                          <>
                            {/* Beginner-friendly view */}
                            <div className="space-y-3">
                              <div className="bg-black/20 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">Risk Level:</p>
                                <p className="text-sm">{getSeverityExplanation(finding.severity)}</p>
                              </div>
                              
                              <div className="bg-black/20 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">What We Found:</p>
                                <p className="text-sm">{finding.detail}</p>
                              </div>
                              
                              <div className="bg-black/20 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">What Does This Mean?</p>
                                <p className="text-sm">{getBeginnerExplanation(finding.type, finding.detail)}</p>
                              </div>
                              
                              <div className="bg-black/20 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">💡 What Should You Do?</p>
                                <p className="text-sm">
                                  {finding.severity === 'critical' && 'Contact your IT team or security professional immediately. This needs urgent attention.'}
                                  {finding.severity === 'high' && 'Schedule a fix with your technical team within the next few days.'}
                                  {finding.severity === 'medium' && 'Add this to your security improvement list. Fix it within the next week or two.'}
                                  {finding.severity === 'low' && 'Note this for future improvements. Not urgent, but good to address eventually.'}
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Technical view */}
                            <p className="text-sm">{finding.detail}</p>
                            {finding.type && (
                              <p className="text-xs text-gray-400 mt-1">Type: {finding.type}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
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
                {beginnerMode ? "🛠️ Technologies Used" : "Detected Technologies"}
              </h3>
              {beginnerMode && (
                <p className="text-sm text-gray-400 mb-4">
                  These are the software tools and frameworks your website is built with. 
                  Like knowing what materials were used to build your house.
                </p>
              )}
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
                {beginnerMode ? "🔒 Encryption Issues" : "TLS/SSL Issues"}
              </h3>
              <div className="text-3xl font-bold text-yellow-400">
                {report.summary.tls_issues}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {beginnerMode 
                  ? "Problems with how your site encrypts data (like weak locks on your doors)" 
                  : "Total TLS/SSL configuration issues detected"}
              </p>
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-3">
                {beginnerMode ? "📁 Exposed Folders" : "Directory Issues"}
              </h3>
              <div className="text-3xl font-bold text-orange-400">
                {report.summary.directory_issues}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {beginnerMode 
                  ? "Folders showing their contents publicly (like leaving filing cabinets open)" 
                  : "Directories with public listing enabled"}
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

        <div class="footer">
            <p><strong>Revulnera Security Scanner</strong></p>
            <p>This report contains sensitive security information. Handle with care.</p>
        </div>
    </div>
</body>
</html>
  `.trim();
}
