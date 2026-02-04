// src/pages/Scanners.jsx
import React, { useEffect, useRef, useState } from "react";
import { Zap, Shield, Globe, ChevronDown, Copy, Check, Search, Download } from "lucide-react";
import { postJSON, WS_ROOT } from "../api/api";

export default function Scanners() {
  const [target, setTarget] = useState("");
  const [scanId, setScanId] = useState(null);

  const [status, setStatus] = useState("IDLE");
  const [error, setError] = useState("");

  const [subdomains, setSubdomains] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  
  // Enhanced state for filtering and expansion
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  const [subdomainSearch, setSubdomainSearch] = useState("");
  const [endpointSearch, setEndpointSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedText, setCopiedText] = useState(null);

  const wsRef = useRef(null);

  function resetLiveState() {
    setSubdomains([]);
    setEndpoints([]);
  }

  async function startScan(e) {
    e.preventDefault();
    setError("");

    const token = localStorage.getItem("access");
    if (!token) {
      setError("Login required (no access token found).");
      return;
    }

    const t = target.trim();
    if (!t) {
      setError("Please enter a domain (example.com).");
      return;
    }

    setStatus("STARTING");
    setScanId(null);
    resetLiveState();

    // IMPORTANT:
    // Your api.js should use API_ROOT = "http://localhost:8000/api"
    // so this path must start with "/" and must NOT include "/api"
    const res = await postJSON("/api/recon/scans/start/", { target: t }, token);
    console.log("START SCAN RES:", res);

    if (res?.detail) {
      setStatus("IDLE");
      setError(res.detail);
      return;
    }

    if (!res?.id) {
      setStatus("IDLE");
      setError("Scan start failed: no scan id returned.");
      return;
    }

    setScanId(res.id);
    setStatus(res.status || "RUNNING");
  }

  useEffect(() => {
    if (!scanId) return;

    const wsUrl = `${WS_ROOT}/ws/scans/${scanId}/`;

    // close old socket if any
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WS OPEN:", wsUrl);
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      console.log("WS MSG:", msg.type, msg);

      if (msg.type === "connected") return;

      if (msg.type === "scan_status") {
        if (msg.status) setStatus(msg.status);
        if (msg.error) setError(msg.error);
        return;
      }

      if (msg.type === "subdomains_chunk") {
        const items = Array.isArray(msg.data)
          ? msg.data
          : Array.isArray(msg.items)
          ? msg.items
          : [];

        // append directly (no dedupe for now)
        setSubdomains((prev) => prev.concat(items));
        return;
      }

      if (msg.type === "endpoints_chunk") {
        const items = Array.isArray(msg.data)
          ? msg.data
          : Array.isArray(msg.items)
          ? msg.items
          : [];

        // append directly (no dedupe, no filtering)
        setEndpoints((prev) => prev.concat(items));
        return;
      }
    };

    ws.onerror = (e) => {
      console.log("WS ERROR:", e);
      setError("WebSocket error. Check Django Channels + WS_ROOT.");
    };

    ws.onclose = () => {
      console.log("WS CLOSE");
    };

    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [scanId]);

  // hard proof of state changes
  useEffect(() => {
    console.log("STATE: subdomains =", subdomains.length, "endpoints =", endpoints.length);
  }, [subdomains.length, endpoints.length]);

  const aliveCount = subdomains.filter((s) => s?.alive).length;

  // Filtered results based on search
  const filteredSubdomains = subdomains.filter(s =>
    s?.name?.toLowerCase().includes(subdomainSearch.toLowerCase())
  );

  const filteredEndpoints = endpoints.filter(e => {
    const matchesSearch = e?.url?.toLowerCase().includes(endpointSearch.toLowerCase());
    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "2xx") return matchesSearch && e?.status_code >= 200 && e?.status_code < 300;
    if (statusFilter === "4xx") return matchesSearch && e?.status_code >= 400 && e?.status_code < 500;
    if (statusFilter === "5xx") return matchesSearch && e?.status_code >= 500;
    return matchesSearch;
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const exportData = (format) => {
    let dataStr;
    let filename;

    if (format === "json") {
      dataStr = JSON.stringify({ target, subdomains, endpoints }, null, 2);
      filename = `scan_${scanId}_${new Date().getTime()}.json`;
    } else if (format === "csv") {
      let csv = "Type,Data,Status\n";
      subdomains.forEach(s => {
        csv += `Subdomain,"${s?.name || ''}","${s?.alive ? 'Alive' : 'Offline'}"\n`;
      });
      endpoints.forEach(e => {
        csv += `Endpoint,"${e?.url || ''}","${e?.status_code || 'N/A'}"\n`;
      });
      dataStr = csv;
      filename = `scan_${scanId}_${new Date().getTime()}.csv`;
    }

    const blob = new Blob([dataStr], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-4 animate-slide-up">
        <h1 className="text-5xl font-bold text-gradient">Reconnaissance Scanner</h1>
        <p className="text-gray-400 text-lg">
          Discover subdomains and map endpoints in real-time with live status updates
        </p>
      </div>

      {/* Scan Input Card */}
      <div className="card card-hover animate-slide-up">
        <form onSubmit={startScan} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">
              Target Domain
            </label>
            <div className="relative">
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="example.com"
                className="input-premium w-full text-lg"
                disabled={status === "RUNNING"}
              />
              {status === "RUNNING" && (
                <div className="absolute right-4 top-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-purple-500"></div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "RUNNING" || !target.trim()}
            className="btn-primary w-full py-4 text-lg font-bold flex items-center justify-center gap-2"
          >
            {status === "RUNNING" ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                Scanning in Progress
              </>
            ) : (
              <>
                <Zap className="w-6 h-6" />
                Start Scan
              </>
            )}
          </button>
        </form>
      </div>

      {/* Status Bar */}
      {scanId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
          <div className="stat-card group">
            <p className="text-gray-400 text-sm">Scan Status</p>
            <p className="text-2xl font-bold text-white mt-1">
              <span className={status === "RUNNING" ? "text-yellow-400 animate-pulse" : "text-green-400"}>
                {status}
              </span>
            </p>
          </div>
          <div className="stat-card">
            <p className="text-gray-400 text-sm">Subdomains Found</p>
            <p className="text-2xl font-bold text-purple-300">{subdomains.length}</p>
            <p className="text-xs text-purple-400 mt-1">Alive: {aliveCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-gray-400 text-sm">Endpoints Mapped</p>
            <p className="text-2xl font-bold text-pink-300">{endpoints.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-gray-400 text-sm">Scan ID</p>
            <p className="text-xs font-mono text-gray-300 mt-1 truncate">{scanId}</p>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
        {/* Subdomains Table */}
        <div className="card card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-400" />
              Subdomains Discovered
            </h3>
            <span className="badge-info">{subdomains.length}</span>
          </div>
          
          {/* Search Bar */}
          {subdomains.length > 0 && (
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search subdomains..."
                value={subdomainSearch}
                onChange={(e) => setSubdomainSearch(e.target.value)}
                className="input-premium w-full pl-10"
              />
            </div>
          )}
          
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="table-premium w-full text-sm">
              <thead>
                <tr>
                  <th>Domain Name</th>
                  <th>IP Address</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubdomains.length > 0 ? (
                  filteredSubdomains.map((s, idx) => (
                    <tr key={`${s?.name}-${idx}`}>
                      <td>
                        <code className="text-purple-300 font-mono text-xs">{s?.name || "-"}</code>
                      </td>
                      <td className="text-gray-300 font-mono">{s?.ip || "-"}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {s?.alive ? (
                            <span className="badge-success text-xs">Live</span>
                          ) : (
                            <span className="badge-warning text-xs">Offline</span>
                          )}
                          <button
                            onClick={() => copyToClipboard(s?.name)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                          >
                            {copiedText === s?.name ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : subdomains.length > 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8">
                      <p className="text-gray-400">No subdomains match your search</p>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-8">
                      <Zap className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400">Start a scan to discover subdomains</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Endpoints Table */}
        <div className="card card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              <Globe className="w-6 h-6 text-pink-400" />
              Endpoints Mapped
            </h3>
            <span className="badge-info">{endpoints.length}</span>
          </div>

          {/* Search & Filter */}
          {endpoints.length > 0 && (
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search endpoints..."
                  value={endpointSearch}
                  onChange={(e) => setEndpointSearch(e.target.value)}
                  className="input-premium w-full pl-10"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-premium w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer"
              >
                <option value="all">All Status Codes</option>
                <option value="2xx">2xx Success</option>
                <option value="4xx">4xx Client Error</option>
                <option value="5xx">5xx Server Error</option>
              </select>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="max-h-96 overflow-y-auto">
              <table className="table-premium w-full text-sm">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Status Code</th>
                    <th className="text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEndpoints.length > 0 ? (
                    filteredEndpoints.map((e, idx) => (
                      <React.Fragment key={`${e?.url}-${idx}`}>
                        <tr 
                          onClick={() => setExpandedEndpoint(expandedEndpoint === idx ? null : idx)}
                          className="cursor-pointer hover:bg-white/5"
                        >
                          <td>
                            {e?.url ? (
                              <a
                                href={e.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-purple-400 hover:text-purple-300 truncate inline-block max-w-xs"
                              >
                                {e.url}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            {e?.status_code && (
                              <span
                                className={
                                  e.status_code >= 200 && e.status_code < 300
                                    ? "badge-success"
                                    : e.status_code >= 400 && e.status_code < 500
                                    ? "badge-warning"
                                    : e.status_code >= 500
                                    ? "badge-error"
                                    : "badge-info"
                                }
                              >
                                {e.status_code}
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            <ChevronDown
                              className={`w-4 h-4 inline-block transition-transform ${
                                expandedEndpoint === idx ? "rotate-180" : ""
                              }`}
                            />
                          </td>
                        </tr>
                        {expandedEndpoint === idx && (
                          <tr className="bg-white/5">
                            <td colSpan={3} className="p-4">
                              <div className="space-y-3 text-sm">
                                {e?.title && (
                                  <div>
                                    <p className="text-gray-400 text-xs font-semibold mb-1">Title</p>
                                    <p className="text-gray-300">{e.title}</p>
                                  </div>
                                )}
                                {e?.headers && Object.keys(e.headers).length > 0 && (
                                  <div>
                                    <p className="text-gray-400 text-xs font-semibold mb-1">Headers</p>
                                    <div className="bg-black/30 rounded p-2 font-mono text-xs max-h-32 overflow-y-auto">
                                      {Object.entries(e.headers).map(([key, val]) => (
                                        <div key={key} className="text-gray-300">
                                          <span className="text-purple-300">{key}:</span> {val}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {e?.fingerprints && e.fingerprints.length > 0 && (
                                  <div>
                                    <p className="text-gray-400 text-xs font-semibold mb-1">Fingerprints</p>
                                    <div className="flex flex-wrap gap-2">
                                      {e.fingerprints.map((fp, i) => (
                                        <span key={i} className="badge-info text-xs">
                                          {fp}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    copyToClipboard(e?.url);
                                  }}
                                  className="mt-2 px-3 py-1 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-xs font-semibold flex items-center gap-2 w-fit transition-colors"
                                >
                                  {copiedText === e?.url ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      Copy URL
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : endpoints.length > 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8">
                        <p className="text-gray-400">No endpoints match your filters</p>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center py-8">
                        <Globe className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-400">Endpoints will appear here</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Export Section */}
      {scanId && (subdomains.length > 0 || endpoints.length > 0) && (
        <div className="card card-hover animate-slide-up">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-green-400" />
            Export Results
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => exportData("json")}
              className="btn-secondary text-sm py-2 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
            <button
              onClick={() => exportData("csv")}
              className="btn-secondary text-sm py-2 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
