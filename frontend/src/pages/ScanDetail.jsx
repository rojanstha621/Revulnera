// src/pages/ScanDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Shield, Globe, Copy, Check, Loader, Lock, FolderOpen, Network, AlertTriangle, LayoutGrid, Table } from "lucide-react";
import { getUserScanDetail } from "../api/api";

export default function ScanDetail() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [activeTab, setActiveTab] = useState("subdomains");

  useEffect(() => {
    const loadScan = async () => {
      try {
        setLoading(true);
        const data = await getUserScanDetail(scanId);
        setScan(data);
        console.log("Scan data loaded:", data);
      } catch (err) {
        console.error("Error loading scan:", err);
        setError("Failed to load scan details");
      } finally {
        setLoading(false);
      }
    };

    loadScan();
  }, [scanId]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader className="w-12 h-12 text-purple-500 animate-spin" />
        <p className="text-gray-400">Loading scan details...</p>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Go Back
        </button>
        <div className="card bg-red-500/20 border border-red-500/30">
          <p className="text-red-300">{error || "Scan not found"}</p>
        </div>
      </div>
    );
  }

  const aliveCount = scan.alive_count || 0;
  const successEndpoints = scan.endpoints?.filter(e => e.status_code >= 200 && e.status_code < 300).length || 0;
  const errorEndpoints = scan.endpoints?.filter(e => e.status_code >= 400).length || 0;
  const openPortsCount = scan.port_findings_count || 0;
  const tlsIssuesCount = scan.tls_results?.filter(t => t.weak_versions && t.weak_versions.length > 0).length || 0;
  const dirIssuesCount = scan.directory_findings_count || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4 animate-slide-up">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>
        <div>
          <h1 className="text-5xl font-bold text-gradient">{scan.target}</h1>
          <p className="text-gray-400 mt-2">Detailed reconnaissance scan results</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up">
        <div className="stat-card">
          <p className="text-gray-400 text-sm">Scan Status</p>
          <p className="text-2xl font-bold mt-1">
            <span className={
              scan.status === "COMPLETED" ? "text-green-400" : 
              scan.status === "RUNNING" ? "text-yellow-400" :
              scan.status === "FAILED" ? "text-red-400" : "text-blue-400"
            }>
              {scan.status}
            </span>
          </p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-sm">Subdomains</p>
          <p className="text-3xl font-bold text-purple-300">{scan.subdomain_count}</p>
          <p className="text-xs text-purple-400 mt-1">Alive: {aliveCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-sm">Endpoints</p>
          <p className="text-3xl font-bold text-pink-300">{scan.endpoint_count}</p>
          <p className="text-xs text-pink-400 mt-1">Success: {successEndpoints}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-sm">Open Ports</p>
          <p className="text-3xl font-bold text-cyan-300">{openPortsCount}</p>
          <p className="text-xs text-cyan-400 mt-1">Found by Nmap</p>
        </div>
      </div>

      {(tlsIssuesCount > 0 || dirIssuesCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up">
          <div className="card bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">TLS Issues</p>
                <p className="text-2xl font-bold text-orange-300 mt-1">{tlsIssuesCount}</p>
              </div>
              <Lock className="w-8 h-8 text-orange-400 opacity-50" />
            </div>
          </div>
          <div className="card bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Directory Issues</p>
                <p className="text-2xl font-bold text-pink-300 mt-1">{dirIssuesCount}</p>
              </div>
              <FolderOpen className="w-8 h-8 text-pink-400 opacity-50" />
            </div>
          </div>
          <div className="card bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Findings</p>
                <p className="text-2xl font-bold text-green-300 mt-1">{openPortsCount + tlsIssuesCount + dirIssuesCount}</p>
              </div>
              <Network className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Scan Info Card */}
      <div className="card animate-slide-up">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-gray-400 text-sm mb-2">Created</p>
            <p className="text-white font-mono text-sm">{new Date(scan.created_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-2">Last Updated</p>
            <p className="text-white font-mono text-sm">{new Date(scan.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/10 animate-slide-up overflow-x-auto">
        <button
          onClick={() => setActiveTab("subdomains")}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "subdomains"
              ? "text-purple-400 border-purple-500"
              : "text-gray-400 hover:text-gray-300 border-transparent"
          }`}
        >
          <Shield className="w-5 h-5 inline-block mr-2" />
          Subdomains ({scan.subdomain_count})
        </button>
        <button
          onClick={() => setActiveTab("endpoints")}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "endpoints"
              ? "text-pink-400 border-pink-500"
              : "text-gray-400 hover:text-gray-300 border-transparent"
          }`}
        >
          <Globe className="w-5 h-5 inline-block mr-2" />
          Endpoints ({scan.endpoint_count})
        </button>
        <button
          onClick={() => setActiveTab("ports")}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "ports"
              ? "text-cyan-400 border-cyan-500"
              : "text-gray-400 hover:text-gray-300 border-transparent"
          }`}
        >
          <Network className="w-5 h-5 inline-block mr-2" />
          Open Ports ({openPortsCount})
        </button>
        <button
          onClick={() => setActiveTab("tls")}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "tls"
              ? "text-orange-400 border-orange-500"
              : "text-gray-400 hover:text-gray-300 border-transparent"
          }`}
        >
          <Lock className="w-5 h-5 inline-block mr-2" />
          TLS Analysis ({scan.tls_results_count || 0})
        </button>
        <button
          onClick={() => setActiveTab("directories")}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "directories"
              ? "text-red-400 border-red-500"
              : "text-gray-400 hover:text-gray-300 border-transparent"
          }`}
        >
          <FolderOpen className="w-5 h-5 inline-block mr-2" />
          Directories ({dirIssuesCount})
        </button>
      </div>

      {/* Subdomains Table */}
      {activeTab === "subdomains" && (
        <div className="card animate-slide-up">
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th>Domain Name</th>
                  <th>IP Address(es)</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {scan.subdomains && scan.subdomains.length > 0 ? (
                  scan.subdomains.map((subdomain, idx) => (
                    <tr key={idx}>
                      <td>
                        <code className="text-purple-300 font-mono text-xs">{subdomain.name}</code>
                        {subdomain.error_msg && (
                          <div className="text-xs text-red-400 mt-1" title={subdomain.error_msg}>
                            ⚠ {subdomain.error_msg.substring(0, 50)}{subdomain.error_msg.length > 50 ? '...' : ''}
                          </div>
                        )}
                      </td>
                      <td className="text-gray-300 font-mono text-sm">
                        {subdomain.ips && subdomain.ips.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {subdomain.ips.map((ip, i) => (
                              <span key={i} className="text-xs">{ip}</span>
                            ))}
                          </div>
                        ) : (
                          subdomain.ip || "N/A"
                        )}
                      </td>
                      <td>
                        {subdomain.alive ? (
                          <span className="badge-success">Live</span>
                        ) : (
                          <span className="badge-warning">Offline</span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => copyToClipboard(subdomain.name)}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-300"
                        >
                          {copiedId === subdomain.name ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8">
                      <p className="text-gray-400">No subdomains found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Endpoints Table */}
      {activeTab === "endpoints" && (
        <div className="card animate-slide-up">
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="table-premium w-full text-sm">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Status Code</th>
                  <th>Title</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {scan.endpoints && scan.endpoints.length > 0 ? (
                  scan.endpoints.map((endpoint, idx) => (
                    <tr key={idx}>
                      <td>
                        <a
                          href={endpoint.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-400 hover:text-purple-300 truncate max-w-xs inline-block"
                        >
                          {endpoint.url}
                        </a>
                      </td>
                      <td>
                        {endpoint.status_code && (
                          <span
                            className={
                              endpoint.status_code >= 200 && endpoint.status_code < 300
                                ? "badge-success"
                                : endpoint.status_code >= 400 && endpoint.status_code < 500
                                ? "badge-warning"
                                : endpoint.status_code >= 500
                                ? "badge-error"
                                : "badge-info"
                            }
                          >
                            {endpoint.status_code}
                          </span>
                        )}
                      </td>
                      <td className="text-gray-300 max-w-xs truncate">
                        {endpoint.title || "-"}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => copyToClipboard(endpoint.url)}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-300"
                        >
                          {copiedId === endpoint.url ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8">
                      <p className="text-gray-400">No endpoints found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Open Ports Table */}
      {activeTab === "ports" && (
        <div className="card card-hover animate-slide-up">
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="table-premium w-full text-sm">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Port</th>
                  <th>Protocol</th>
                  <th>Service</th>
                  <th>Product</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {scan.port_findings && scan.port_findings.length > 0 ? (
                  scan.port_findings.map((finding, idx) => (
                    <tr key={idx}>
                      <td className="text-cyan-300 font-mono text-xs">{finding.host}</td>
                      <td>
                        <span className="badge-info">{finding.port}</span>
                      </td>
                      <td className="text-gray-400 text-xs uppercase">{finding.protocol}</td>
                      <td className="text-purple-300 font-mono">{finding.service || "-"}</td>
                      <td className="text-gray-300">{finding.product || "-"}</td>
                      <td className="text-gray-400 text-xs">{finding.version || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <p className="text-gray-400">No open ports found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TLS Analysis Table */}
      {activeTab === "tls" && (
        <div className="card card-hover animate-slide-up">
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="table-premium w-full text-sm">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>HTTPS</th>
                  <th>Supported Versions</th>
                  <th>Weak Versions</th>
                  <th>Cert Valid</th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {scan.tls_results && scan.tls_results.length > 0 ? (
                  scan.tls_results.map((result, idx) => (
                    <tr key={idx}>
                      <td className="text-cyan-300 font-mono text-xs">{result.host}</td>
                      <td>
                        {result.has_https ? (
                          <span className="badge-success">Yes</span>
                        ) : (
                          <span className="badge-error">No</span>
                        )}
                      </td>
                      <td className="text-gray-300 text-xs">
                        {result.supported_versions && result.supported_versions.length > 0
                          ? result.supported_versions.join(", ")
                          : "-"}
                      </td>
                      <td>
                        {result.weak_versions && result.weak_versions.length > 0 ? (
                          <span className="badge-warning">{result.weak_versions.join(", ")}</span>
                        ) : (
                          <span className="text-green-400 text-xs">None</span>
                        )}
                      </td>
                      <td>
                        {result.cert_valid === true ? (
                          <span className="badge-success">Valid</span>
                        ) : result.cert_valid === false ? (
                          <span className="badge-error">Invalid</span>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="text-gray-400 text-xs">
                        {result.issues && result.issues.length > 0 ? result.issues.length : 0} issues
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <p className="text-gray-400">No TLS analysis results</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Directory Findings Table */}
      {activeTab === "directories" && (
        <div className="card card-hover animate-slide-up">
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="table-premium w-full text-sm">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Issue Type</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {scan.directory_findings && scan.directory_findings.length > 0 ? (
                  scan.directory_findings.map((finding, idx) => (
                    <tr key={idx}>
                      <td className="text-cyan-300 font-mono text-xs">{finding.host}</td>
                      <td className="text-purple-300 font-mono">{finding.path}</td>
                      <td>
                        <span className={
                          finding.status_code === 200 ? "badge-success" :
                          finding.status_code >= 300 && finding.status_code < 400 ? "badge-info" :
                          "badge-warning"
                        }>
                          {finding.status_code}
                        </span>
                      </td>
                      <td>
                        <span className={
                          finding.issue_type.includes("sensitive") || finding.issue_type.includes("exposed")
                            ? "badge-error"
                            : finding.issue_type.includes("admin")
                            ? "badge-warning"
                            : "badge-info"
                        }>
                          {finding.issue_type}
                        </span>
                      </td>
                      <td className="text-gray-400 text-xs max-w-xs truncate">
                        {finding.evidence || "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8">
                      <p className="text-gray-400">No directory issues found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 animate-slide-up">
        <Link to="/scanners" className="btn-primary flex items-center gap-2">
          Start New Scan
        </Link>
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary flex items-center gap-2"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
