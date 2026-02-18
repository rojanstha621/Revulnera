// src/pages/ScanDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Shield, Globe, Copy, Check, Loader, Lock, FolderOpen, Network, AlertTriangle, LayoutGrid, Table, ChevronDown, ChevronRight, ExternalLink, Tags, Server, FileText, Filter, X } from "lucide-react";
import { getUserScanDetail } from "../api/api";

export default function ScanDetail() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [activeTab, setActiveTab] = useState("subdomains");
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  
  // Filter states
  const [subdomainFilter, setSubdomainFilter] = useState("");
  const [subdomainStatusFilter, setSubdomainStatusFilter] = useState("all");
  const [endpointFilter, setEndpointFilter] = useState("");
  const [endpointStatusFilter, setEndpointStatusFilter] = useState("all");
  const [portFilter, setPortFilter] = useState("");
  const [portProtocolFilter, setPortProtocolFilter] = useState("all");
  const [tlsFilter, setTlsFilter] = useState("");
  const [tlsStatusFilter, setTlsStatusFilter] = useState("all");
  const [directoryFilter, setDirectoryFilter] = useState("");
  const [directoryIssueFilter, setDirectoryIssueFilter] = useState("all");

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

  // Filter functions
  const getFilteredSubdomains = () => {
    if (!scan.subdomains) return [];
    return scan.subdomains.filter(subdomain => {
      const matchesSearch = subdomain.name.toLowerCase().includes(subdomainFilter.toLowerCase()) ||
                           (subdomain.ip_addresses && subdomain.ip_addresses.some(ip => ip.toLowerCase().includes(subdomainFilter.toLowerCase())));
      const matchesStatus = subdomainStatusFilter === "all" ||
                           (subdomainStatusFilter === "alive" && subdomain.error_msg === null) ||
                           (subdomainStatusFilter === "error" && subdomain.error_msg !== null);
      return matchesSearch && matchesStatus;
    });
  };

  const getFilteredEndpoints = () => {
    if (!scan.endpoints) return [];
    return scan.endpoints.filter(endpoint => {
      const matchesSearch = endpoint.url.toLowerCase().includes(endpointFilter.toLowerCase()) ||
                           (endpoint.title && endpoint.title.toLowerCase().includes(endpointFilter.toLowerCase())) ||
                           (endpoint.fingerprints && endpoint.fingerprints.some(fp => fp.toLowerCase().includes(endpointFilter.toLowerCase())));
      const matchesStatus = endpointStatusFilter === "all" ||
                           (endpointStatusFilter === "2xx" && endpoint.status_code >= 200 && endpoint.status_code < 300) ||
                           (endpointStatusFilter === "3xx" && endpoint.status_code >= 300 && endpoint.status_code < 400) ||
                           (endpointStatusFilter === "4xx" && endpoint.status_code >= 400 && endpoint.status_code < 500) ||
                           (endpointStatusFilter === "5xx" && endpoint.status_code >= 500);
      return matchesSearch && matchesStatus;
    });
  };

  const getFilteredPorts = () => {
    if (!scan.port_findings) return [];
    return scan.port_findings.filter(finding => {
      const matchesSearch = finding.host.toLowerCase().includes(portFilter.toLowerCase()) ||
                           finding.port.toString().includes(portFilter) ||
                           (finding.service && finding.service.toLowerCase().includes(portFilter.toLowerCase())) ||
                           (finding.product && finding.product.toLowerCase().includes(portFilter.toLowerCase()));
      const matchesProtocol = portProtocolFilter === "all" || finding.protocol.toLowerCase() === portProtocolFilter.toLowerCase();
      return matchesSearch && matchesProtocol;
    });
  };

  const getFilteredTLS = () => {
    if (!scan.tls_results) return [];
    return scan.tls_results.filter(result => {
      const matchesSearch = result.host.toLowerCase().includes(tlsFilter.toLowerCase());
      const matchesStatus = tlsStatusFilter === "all" ||
                           (tlsStatusFilter === "https" && result.has_https) ||
                           (tlsStatusFilter === "weak" && result.weak_versions && result.weak_versions.length > 0) ||
                           (tlsStatusFilter === "invalid_cert" && !result.cert_valid);
      return matchesSearch && matchesStatus;
    });
  };

  const getFilteredDirectories = () => {
    if (!scan.directory_findings) return [];
    return scan.directory_findings.filter(finding => {
      const matchesSearch = finding.host.toLowerCase().includes(directoryFilter.toLowerCase()) ||
                           finding.path.toLowerCase().includes(directoryFilter.toLowerCase()) ||
                           (finding.evidence && finding.evidence.toLowerCase().includes(directoryFilter.toLowerCase()));
      const matchesIssue = directoryIssueFilter === "all" || finding.issue_type.toLowerCase().includes(directoryIssueFilter.toLowerCase());
      return matchesSearch && matchesIssue;
    });
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
          {/* Filter Section */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by domain or IP..."
                  value={subdomainFilter}
                  onChange={(e) => setSubdomainFilter(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                {subdomainFilter && (
                  <button
                    onClick={() => setSubdomainFilter("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSubdomainStatusFilter("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    subdomainStatusFilter === "all"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-purple-500/30"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSubdomainStatusFilter("alive")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    subdomainStatusFilter === "alive"
                      ? "bg-green-500/20 text-green-300 border border-green-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-green-500/30"
                  }`}
                >
                  Live
                </button>
                <button
                  onClick={() => setSubdomainStatusFilter("error")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    subdomainStatusFilter === "error"
                      ? "bg-red-500/20 text-red-300 border border-red-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-red-500/30"
                  }`}
                >
                  Errors
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Showing {getFilteredSubdomains().length} of {scan.subdomains?.length || 0} subdomains
            </p>
          </div>

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
                {getFilteredSubdomains().length > 0 ? (
                  getFilteredSubdomains().map((subdomain, idx) => (
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
          {/* Filter Section */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by URL, title, or technology..."
                  value={endpointFilter}
                  onChange={(e) => setEndpointFilter(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                />
                {endpointFilter && (
                  <button
                    onClick={() => setEndpointFilter("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setEndpointStatusFilter("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    endpointStatusFilter === "all"
                      ? "bg-pink-500/20 text-pink-300 border border-pink-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-pink-500/30"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setEndpointStatusFilter("2xx")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    endpointStatusFilter === "2xx"
                      ? "bg-green-500/20 text-green-300 border border-green-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-green-500/30"
                  }`}
                >
                  2xx
                </button>
                <button
                  onClick={() => setEndpointStatusFilter("3xx")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    endpointStatusFilter === "3xx"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-blue-500/30"
                  }`}
                >
                  3xx
                </button>
                <button
                  onClick={() => setEndpointStatusFilter("4xx")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    endpointStatusFilter === "4xx"
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-yellow-500/30"
                  }`}
                >
                  4xx
                </button>
                <button
                  onClick={() => setEndpointStatusFilter("5xx")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    endpointStatusFilter === "5xx"
                      ? "bg-red-500/20 text-red-300 border border-red-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-red-500/30"
                  }`}
                >
                  5xx
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Showing {getFilteredEndpoints().length} of {scan.endpoints?.length || 0} endpoints
            </p>
          </div>

          <div className="space-y-2">
            {getFilteredEndpoints().length > 0 ? (
              getFilteredEndpoints().map((endpoint, idx) => (
                <div key={idx} className="border border-white/10 rounded-lg overflow-hidden bg-black/20">
                  {/* Main Row */}
                  <div 
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedEndpoint(expandedEndpoint === idx ? null : idx)}
                  >
                    <button className="text-gray-400 hover:text-gray-300">
                      {expandedEndpoint === idx ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <a
                          href={endpoint.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-400 hover:text-purple-300 truncate font-medium flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {endpoint.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <span
                          className={
                            endpoint.status_code >= 200 && endpoint.status_code < 300
                              ? "badge-success"
                              : endpoint.status_code >= 300 && endpoint.status_code < 400
                              ? "badge-info"
                              : endpoint.status_code >= 400 && endpoint.status_code < 500
                              ? "badge-warning"
                              : endpoint.status_code >= 500
                              ? "badge-error"
                              : "badge-info"
                          }
                        >
                          {endpoint.status_code}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">
                        {endpoint.title || "No title"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Content Length</p>
                        <p className="text-sm text-gray-300">{endpoint.content_length ? `${(endpoint.content_length / 1024).toFixed(1)} KB` : "-"}</p>
                      </div>
                      
                      {endpoint.fingerprints && endpoint.fingerprints.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Tags className="w-4 h-4 text-blue-400" />
                          <span className="text-xs text-gray-400">{endpoint.fingerprints.length} techs</span>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(endpoint.url);
                        }}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-300"
                      >
                        {copiedId === endpoint.url ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedEndpoint === idx && (
                    <div className="border-t border-white/10 bg-black/30 p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Headers */}
                        {endpoint.headers && Object.keys(endpoint.headers).length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Server className="w-4 h-4 text-purple-400" />
                              <h4 className="text-sm font-semibold text-gray-200">Response Headers</h4>
                            </div>
                            <div className="space-y-2">
                              {Object.entries(endpoint.headers).map(([key, value]) => (
                                <div key={key} className="flex items-start gap-2 text-xs">
                                  <span className="text-blue-400 font-mono min-w-[120px]">{key}:</span>
                                  <span className="text-gray-300 font-mono flex-1 break-all">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fingerprints */}
                        {endpoint.fingerprints && endpoint.fingerprints.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Tags className="w-4 h-4 text-blue-400" />
                              <h4 className="text-sm font-semibold text-gray-200">Technologies Detected</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {endpoint.fingerprints.map((tech, i) => (
                                <span
                                  key={i}
                                  className="px-3 py-1 bg-blue-500/10 border border-blue-400/30 rounded-full text-xs text-blue-300"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Title (full) */}
                        {endpoint.title && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <FileText className="w-4 h-4 text-green-400" />
                              <h4 className="text-sm font-semibold text-gray-200">Page Title</h4>
                            </div>
                            <p className="text-sm text-gray-300">{endpoint.title}</p>
                          </div>
                        )}

                        {/* Evidence */}
                        {endpoint.evidence && Object.keys(endpoint.evidence).length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              <h4 className="text-sm font-semibold text-gray-200">Evidence</h4>
                            </div>
                            <div className="space-y-2">
                              {Object.entries(endpoint.evidence).map(([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="text-yellow-400 font-mono">{key}:</span>
                                  <span className="text-gray-300 ml-2">{JSON.stringify(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Full URL (copyable) */}
                      <div className="pt-4 border-t border-white/10">
                        <p className="text-xs text-gray-500 mb-2">Full URL</p>
                        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg p-3">
                          <code className="flex-1 text-sm text-gray-300 font-mono break-all">{endpoint.url}</code>
                          <button
                            onClick={() => copyToClipboard(endpoint.url)}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-300 flex-shrink-0"
                          >
                            {copiedId === endpoint.url ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Globe className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No endpoints found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Open Ports Table */}
      {activeTab === "ports" && (
        <div className="card animate-slide-up">
          {/* Filter Section */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by host, port, service, or product..."
                  value={portFilter}
                  onChange={(e) => setPortFilter(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
                {portFilter && (
                  <button
                    onClick={() => setPortFilter("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPortProtocolFilter("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    portProtocolFilter === "all"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-cyan-500/30"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setPortProtocolFilter("tcp")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    portProtocolFilter === "tcp"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-blue-500/30"
                  }`}
                >
                  TCP
                </button>
                <button
                  onClick={() => setPortProtocolFilter("udp")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    portProtocolFilter === "udp"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-purple-500/30"
                  }`}
                >
                  UDP
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Showing {getFilteredPorts().length} of {scan.port_findings?.length || 0} ports
            </p>
          </div>

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
                {getFilteredPorts().length > 0 ? (
                  getFilteredPorts().map((finding, idx) => (
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
        <div className="card animate-slide-up">
          {/* Filter Section */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by host..."
                  value={tlsFilter}
                  onChange={(e) => setTlsFilter(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 transition-colors"
                />
                {tlsFilter && (
                  <button
                    onClick={() => setTlsFilter("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setTlsStatusFilter("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tlsStatusFilter === "all"
                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-orange-500/30"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTlsStatusFilter("https")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tlsStatusFilter === "https"
                      ? "bg-green-500/20 text-green-300 border border-green-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-green-500/30"
                  }`}
                >
                  HTTPS
                </button>
                <button
                  onClick={() => setTlsStatusFilter("weak")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tlsStatusFilter === "weak"
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-yellow-500/30"
                  }`}
                >
                  Weak Versions
                </button>
                <button
                  onClick={() => setTlsStatusFilter("invalid_cert")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tlsStatusFilter === "invalid_cert"
                      ? "bg-red-500/20 text-red-300 border border-red-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-red-500/30"
                  }`}
                >
                  Invalid Cert
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Showing {getFilteredTLS().length} of {scan.tls_results?.length || 0} TLS results
            </p>
          </div>

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
                {getFilteredTLS().length > 0 ? (
                  getFilteredTLS().map((result, idx) => (
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
        <div className="card animate-slide-up">
          {/* Filter Section */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by host, path, or evidence..."
                  value={directoryFilter}
                  onChange={(e) => setDirectoryFilter(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-colors"
                />
                {directoryFilter && (
                  <button
                    onClick={() => setDirectoryFilter("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setDirectoryIssueFilter("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    directoryIssueFilter === "all"
                      ? "bg-red-500/20 text-red-300 border border-red-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-red-500/30"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setDirectoryIssueFilter("sensitive")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    directoryIssueFilter === "sensitive"
                      ? "bg-red-500/20 text-red-300 border border-red-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-red-500/30"
                  }`}
                >
                  Sensitive
                </button>
                <button
                  onClick={() => setDirectoryIssueFilter("exposed")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    directoryIssueFilter === "exposed"
                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-orange-500/30"
                  }`}
                >
                  Exposed
                </button>
                <button
                  onClick={() => setDirectoryIssueFilter("admin")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    directoryIssueFilter === "admin"
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
                      : "bg-black/40 text-gray-400 border border-white/10 hover:border-yellow-500/30"
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Showing {getFilteredDirectories().length} of {scan.directory_findings?.length || 0} directory findings
            </p>
          </div>

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
                {getFilteredDirectories().length > 0 ? (
                  getFilteredDirectories().map((finding, idx) => (
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
