// src/pages/Scanners.jsx
import React, { useEffect, useRef, useState } from "react";
import { 
  Zap, Shield, Globe, Activity, Lock, FolderOpen, 
  AlertTriangle, Download, Check, TrendingUp, Network,
  Radar, Target, ChevronRight
} from "lucide-react";
import { postJSON, WS_ROOT } from "../api/api";
import { useNavigate } from "react-router-dom";

// API_ROOT for direct fetch calls
const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Scanners() {
  const navigate = useNavigate();
  const [target, setTarget] = useState("");
  const [scanId, setScanId] = useState(null);

  const [status, setStatus] = useState("IDLE");
  const [error, setError] = useState("");

  // Metrics state
  const [metrics, setMetrics] = useState({
    subdomains: 0,
    aliveSubdomains: 0,
    endpoints: 0,
    ports: 0,
    tlsIssues: 0,
    directoryIssues: 0,
  });

  // Phase tracking
  const [currentPhase, setCurrentPhase] = useState("");

  // Live feed messages
  const [liveFeed, setLiveFeed] = useState([]);
  const liveFeedRef = useRef(null);

  const wsRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const reconnectTimeoutRef = useRef(null);

  // Load active scan from localStorage on mount
  useEffect(() => {
    const savedScan = localStorage.getItem("activeScan");
    if (savedScan) {
      try {
        const scanData = JSON.parse(savedScan);
        if (scanData.scanId && scanData.status === "RUNNING") {
          setScanId(scanData.scanId);
          setTarget(scanData.target || "");
          setStatus(scanData.status);
          setMetrics(scanData.metrics || {
            subdomains: 0,
            aliveSubdomains: 0,
            endpoints: 0,
            ports: 0,
            tlsIssues: 0,
            directoryIssues: 0,
          });
          setCurrentPhase(scanData.currentPhase || "");
          setLiveFeed(scanData.liveFeed || []);
          
          // Fetch latest state from backend to sync up
          fetchScanState(scanData.scanId);
        }
      } catch (e) {
        console.error("Failed to restore scan:", e);
      }
    }
  }, []);

  // Save active scan to localStorage whenever it changes
  useEffect(() => {
    if (scanId && status === "RUNNING") {
      localStorage.setItem("activeScan", JSON.stringify({
        scanId,
        target,
        status,
        metrics,
        currentPhase,
        liveFeed: liveFeed.slice(-100), // Keep last 100 messages
      }));
    } else if (status === "COMPLETED" || status === "FAILED") {
      localStorage.removeItem("activeScan");
    }
  }, [scanId, target, status, metrics, currentPhase, liveFeed]);

  // Auto-scroll live feed to bottom
  useEffect(() => {
    if (liveFeedRef.current) {
      liveFeedRef.current.scrollTop = liveFeedRef.current.scrollHeight;
    }
  }, [liveFeed]);

  function addLogMessage(type, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    setLiveFeed(prev => [...prev, { type, message, data, timestamp }]);
  }

  function resetLiveState() {
    setMetrics({
      subdomains: 0,
      aliveSubdomains: 0,
      endpoints: 0,
      ports: 0,
      tlsIssues: 0,
      directoryIssues: 0,
    });
    setCurrentPhase("");
    setLiveFeed([]);
  }

  function cancelScan() {
    // Stop automatic reconnection
    shouldReconnectRef.current = false;
    
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    
    addLogMessage("status", "❌ Scan cancelled by user");
    localStorage.removeItem("activeScan");
    setStatus("IDLE");
    setScanId(null);
    resetLiveState();
  }

  // Fetch current scan state from backend when reconnecting
  async function fetchScanState(scanIdToFetch) {
    const token = localStorage.getItem("access");
    if (!token || !scanIdToFetch) return;

    try {
      const response = await fetch(`${API_ROOT}/api/recon/user/scans/${scanIdToFetch}/`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch scan state:", response.status);
        return;
      }

      const data = await response.json();
      
      // Update status
      setStatus(data.status || "RUNNING");
      
      // Update metrics from backend data
      setMetrics({
        subdomains: data.subdomain_count || 0,
        aliveSubdomains: data.alive_count || 0,
        endpoints: data.endpoint_count || 0,
        ports: data.port_findings_count || 0,
        tlsIssues: data.tls_results_count || 0,
        directoryIssues: data.directory_findings_count || 0,
      });

      addLogMessage("info", `🔄 Reconnected - restored scan state: ${data.subdomain_count} subdomains, ${data.endpoint_count} endpoints found so far`);
      
      // If scan is completed or failed, show final message
      if (data.status === "COMPLETED") {
        addLogMessage("status", "✅ Scan completed successfully!");
      } else if (data.status === "FAILED") {
        addLogMessage("error", "❌ Scan failed");
      }
    } catch (err) {
      console.error("Error fetching scan state:", err);
      addLogMessage("warning", "⚠️ Failed to restore scan state");
    }
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
    addLogMessage("status", `🚀 Scan initiated for target: ${t}`, { scanId: res.id });
    addLogMessage("info", `Scan ID: ${res.id}`);
  }

  useEffect(() => {
    if (!scanId) return;

    const wsUrl = `${WS_ROOT}/ws/scans/${scanId}/`;
    shouldReconnectRef.current = true;

    const connectWebSocket = () => {
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
        
        // Fetch current scan state when connecting/reconnecting
        if (status === "RUNNING") {
          fetchScanState(scanId);
        }
      };

      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        console.log("WS MSG:", msg.type, msg);

        if (msg.type === "connected") {
          addLogMessage("info", "✅ WebSocket connected - listening for scan updates");
          return;
        }

        if (msg.type === "scan_status") {
          if (msg.status) {
            setStatus(msg.status);
            if (msg.status === "COMPLETED") {
              addLogMessage("status", "✅ Scan completed successfully!");
              shouldReconnectRef.current = false; // Stop reconnecting once scan completes
              localStorage.removeItem("activeScan"); // Clear saved scan
            } else if (msg.status === "FAILED") {
              addLogMessage("error", "❌ Scan failed");
              shouldReconnectRef.current = false; // Stop reconnecting on failure
              localStorage.removeItem("activeScan");
            } else {
              addLogMessage("status", `Scan status: ${msg.status}`);
            }
          }
          if (msg.error) {
            setError(msg.error);
            addLogMessage("error", `Error: ${msg.error}`);
          }
          return;
        }

      // Scan progress logs from Go scanner
      if (msg.type === "scan_log") {
        const logMessage = msg.message || "";
        const logLevel = msg.level || "info"; // info, success, warning, error
        
        // Map log level to appropriate message type for styling
        const messageType = logLevel === "error" ? "error" : 
                          logLevel === "warning" ? "warning" :
                          logLevel === "success" ? "status" : "info";
        
        addLogMessage(messageType, logMessage);
        return;
      }

      // Subdomain enumeration phase
      if (msg.type === "subdomains_chunk") {
        const items = Array.isArray(msg.data) ? msg.data : Array.isArray(msg.items) ? msg.items : [];
        if (currentPhase !== "Subdomain Enumeration") {
          addLogMessage("status", "🔍 Phase: Subdomain Enumeration started");
        }
        setCurrentPhase("Subdomain Enumeration");
        
        // Log each subdomain individually
        items.forEach(item => {
          const status = item?.alive ? "✓ ALIVE" : "✗ offline";
          addLogMessage(
            "subdomain", 
            `${item?.name}`, 
            { ip: item?.ip, alive: item?.alive, status }
          );
        });
        
        setMetrics((prev) => ({
          ...prev,
          subdomains: prev.subdomains + items.length,
          aliveSubdomains: prev.aliveSubdomains + items.filter(s => s?.alive).length,
        }));
        return;
      }

      // Endpoint discovery phase
      if (msg.type === "endpoints_chunk") {
        const items = Array.isArray(msg.data) ? msg.data : Array.isArray(msg.items) ? msg.items : [];
        if (currentPhase !== "Endpoint Discovery") {
          addLogMessage("status", "🌐 Phase: Endpoint Discovery started");
        }
        setCurrentPhase("Endpoint Discovery");
        
        // Log each endpoint individually with detailed info
        items.forEach(item => {
          const statusCode = item?.status_code || "N/A";
          const statusClass = statusCode >= 200 && statusCode < 300 ? "success" : 
                            statusCode >= 400 ? "error" : "info";
          addLogMessage(
            "endpoint",
            `${item?.url}`,
            { 
              statusCode, 
              title: item?.title, 
              class: statusClass,
              contentLength: item?.content_length,
              fingerprints: item?.fingerprints,
              server: item?.headers?.Server
            }
          );
        });
        
        setMetrics((prev) => ({
          ...prev,
          endpoints: prev.endpoints + items.length,
        }));
        return;
      }

      // Network analysis - ports
      if (msg.type === "network_ports_chunk") {
        const items = Array.isArray(msg.data) ? msg.data : [];
        if (currentPhase !== "Port Scanning") {
          addLogMessage("status", "📡 Phase: Port Scanning started");
        }
        setCurrentPhase("Port Scanning");
        
        // Log each port individually
        items.forEach(item => {
          addLogMessage(
            "port",
            `${item?.host}:${item?.port}`,
            { service: item?.service, product: item?.product, version: item?.version }
          );
        });
        
        setMetrics((prev) => ({
          ...prev,
          ports: prev.ports + items.length,
        }));
        return;
      }

      // Network analysis - TLS
      if (msg.type === "network_tls_result") {
        const data = msg.data || {};
        if (currentPhase !== "TLS Analysis") {
          addLogMessage("status", "🔒 Phase: TLS Analysis started");
        }
        setCurrentPhase("TLS Analysis");
        
        const hasIssues = data.weak_versions && data.weak_versions.length > 0;
        addLogMessage(
          hasIssues ? "tls-warning" : "tls",
          `TLS scan: ${data.host}`,
          { 
            hasHttps: data.has_https, 
            weakVersions: data.weak_versions,
            issues: data.issues 
          }
        );
        
        if (hasIssues) {
          setMetrics((prev) => ({
            ...prev,
            tlsIssues: prev.tlsIssues + 1,
          }));
        }
        return;
      }

      // Network analysis - directories
      if (msg.type === "network_dirs_chunk") {
        const items = Array.isArray(msg.data) ? msg.data : [];
        if (currentPhase !== "Directory Analysis") {
          addLogMessage("status", "📁 Phase: Directory Analysis started");
        }
        setCurrentPhase("Directory Analysis");
        
        // Log each directory finding individually
        items.forEach(item => {
          addLogMessage(
            "directory",
            `${item?.host}${item?.path}`,
            { issueType: item?.issue_type, statusCode: item?.status_code }
          );
        });
        
        setMetrics((prev) => ({
          ...prev,
          directoryIssues: prev.directoryIssues + items.length,
        }));
        return;
      }
    };

      ws.onerror = (e) => {
        console.log("WS ERROR:", e);
        addLogMessage("warning", "⚠️ WebSocket connection issue - will automatically reconnect...");
      };

      ws.onclose = () => {
        console.log("WS CLOSE");
        
        // Only reconnect if scan is still running and we haven't explicitly stopped
        if (shouldReconnectRef.current && status === "RUNNING") {
          addLogMessage("info", "🔄 Connection lost - reconnecting in 3 seconds...");
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current && status === "RUNNING") {
              console.log("Attempting to reconnect WebSocket...");
              connectWebSocket();
            }
          }, 3000);
        } else if (status !== "RUNNING") {
          console.log("WebSocket closed - scan is not running");
        }
      };
    };

    // Initial connection
    connectWebSocket();

    return () => {
      // Prevent reconnection on cleanup
      shouldReconnectRef.current = false;
      
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Only close WebSocket if scan is completed or failed
      // If scan is still running, keep it open for background updates
      if (status === "COMPLETED" || status === "FAILED" || status === "IDLE") {
        try {
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        } catch {}
      }
    };
  }, [scanId]);

  const phases = [
    { name: "Subdomain Enumeration", icon: Shield, active: currentPhase === "Subdomain Enumeration" },
    { name: "Endpoint Discovery", icon: Globe, active: currentPhase === "Endpoint Discovery" },
    { name: "Port Scanning", icon: Network, active: currentPhase === "Port Scanning" },
    { name: "TLS Analysis", icon: Lock, active: currentPhase === "TLS Analysis" },
    { name: "Directory Analysis", icon: FolderOpen, active: currentPhase === "Directory Analysis" },
  ];

  const isScanning = status === "RUNNING" || status === "STARTING";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-4 animate-slide-up">
        <h1 className="text-5xl font-bold text-gradient">Reconnaissance Scanner</h1>
        <p className="text-gray-400 text-lg">
          Advanced security reconnaissance with real-time vulnerability detection
        </p>
        {scanId && isScanning && (
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-lg px-4 py-2 text-sm text-blue-300">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Active scan in progress - safe to navigate away</span>
          </div>
        )}
      </div>

      {/* Scan Input Card */}
      <div className="card card-hover animate-slide-up">
        <form onSubmit={startScan} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">
              Target Domain
            </label>
            <div className="relative">
              <Target className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="example.com or 192.168.1.1"
                className="input-premium w-full text-lg pl-12"
                disabled={isScanning}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 animate-slide-up">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {error}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isScanning || !target.trim()}
            className="btn-primary w-full py-4 text-lg font-bold flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
          >
            {isScanning ? (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  <div className="absolute animate-ping rounded-full h-5 w-5 border border-white opacity-20"></div>
                </div>
                Scanning in Progress...
              </>
            ) : (
              <>
                <Zap className="w-6 h-6" />
                Launch Reconnaissance Scan
              </>
            )}
          </button>

          {isScanning && (
            <button
              type="button"
              onClick={cancelScan}
              className="w-full py-3 text-sm font-semibold bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg text-red-300 transition-all"
            >
              Cancel Scan
            </button>
          )}
        </form>
      </div>

      {/* Live Feed and Scanning Animation Side by Side */}
      {scanId && isScanning && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
          {/* Live Feed Log - LEFT */}
          <div className="order-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-400 animate-pulse" />
                Live Scan Feed
                <span className="text-sm text-gray-500 font-normal">({liveFeed.length} events)</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const logText = liveFeed.map(log => 
                      `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}${
                        log.data ? ` | ${JSON.stringify(log.data)}` : ''
                      }`
                    ).join('\n');
                    const blob = new Blob([logText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `scan_${scanId}_log_${Date.now()}.txt`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-sm text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setLiveFeed([])}
                  className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                  title="Clear Log"
                >
                  Clear
                </button>
              </div>
            </div>
            
            <div className="card bg-black/40 border-green-500/20">
              <div 
                ref={liveFeedRef}
                className="h-[500px] overflow-y-auto font-mono text-xs space-y-1 p-4 bg-black/30 rounded-lg"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#374151 #1f2937'
                }}
              >
                {liveFeed.map((log, idx) => {
                  const getLogStyle = () => {
                    switch (log.type) {
                      case "subdomain":
                        return log.data?.alive 
                          ? "text-purple-300 border-l-purple-500" 
                          : "text-purple-400/50 border-l-purple-700";
                      case "endpoint":
                        return log.data?.class === "success"
                          ? "text-green-300 border-l-green-500"
                          : log.data?.class === "error"
                          ? "text-red-300 border-l-red-500"
                          : "text-blue-300 border-l-blue-500";
                      case "port":
                        return "text-cyan-300 border-l-cyan-500";
                      case "tls":
                        return "text-blue-300 border-l-blue-500";
                      case "tls-warning":
                        return "text-orange-300 border-l-orange-500";
                      case "directory":
                        return "text-yellow-300 border-l-yellow-500";
                      case "vulnerability":
                        return "text-red-300 border-l-red-500";
                      case "status":
                        return "text-green-400 border-l-green-500";
                      case "error":
                        return "text-red-400 border-l-red-500";
                      case "info":
                        return "text-gray-400 border-l-gray-500";
                      default:
                        return "text-gray-300 border-l-gray-500";
                    }
                  };

                  const getIcon = () => {
                    switch (log.type) {
                      case "subdomain":
                        return <Shield className="w-3 h-3" />;
                      case "endpoint":
                        return <Globe className="w-3 h-3" />;
                      case "port":
                        return <Network className="w-3 h-3" />;
                      case "tls":
                      case "tls-warning":
                        return <Lock className="w-3 h-3" />;
                      case "directory":
                        return <FolderOpen className="w-3 h-3" />;
                      case "vulnerability":
                        return <AlertTriangle className="w-3 h-3" />;
                      case "status":
                        return <Activity className="w-3 h-3" />;
                      default:
                        return <ChevronRight className="w-3 h-3" />;
                    }
                  };

                  return (
                    <div
                      key={idx}
                      className={`border-l-2 pl-3 py-1 ${getLogStyle()} hover:bg-white/5 transition-colors`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 text-[10px] min-w-[60px]">
                          {log.timestamp}
                        </span>
                        <div className="flex items-center gap-1 min-w-[16px]">
                          {getIcon()}
                        </div>
                        <div className="flex-1">
                          <span className="break-all">{log.message}</span>
                          {log.data && (
                            <div className="text-gray-500 text-[10px] mt-0.5">
                              {log.type === "subdomain" && (
                                <span>
                                  {log.data.ip && `[${log.data.ip}]`} {log.data.status}
                                </span>
                              )}
                              {log.type === "endpoint" && (
                                <span className="flex flex-col gap-0.5">
                                  <span>[HTTP {log.data.statusCode}] {log.data.title && `"${log.data.title}"`}</span>
                                  {log.data.contentLength && (
                                    <span className="text-gray-600">Size: {(log.data.contentLength / 1024).toFixed(1)} KB</span>
                                  )}
                                  {log.data.server && (
                                    <span className="text-blue-500/70">Server: {log.data.server}</span>
                                  )}
                                  {log.data.fingerprints && log.data.fingerprints.length > 0 && (
                                    <span className="text-purple-500/70">
                                      🏷️ {log.data.fingerprints.slice(0, 3).join(", ")}
                                      {log.data.fingerprints.length > 3 && ` +${log.data.fingerprints.length - 3} more`}
                                    </span>
                                  )}
                                </span>
                              )}
                              {log.type === "port" && (
                                <span>
                                  {log.data.service && `[${log.data.service}]`} 
                                  {log.data.product && ` ${log.data.product}`}
                                  {log.data.version && ` ${log.data.version}`}
                                </span>
                              )}
                              {log.type === "tls-warning" && log.data.weakVersions && (
                                <span>
                                  Weak: {log.data.weakVersions.join(", ")}
                                </span>
                              )}
                              {log.type === "directory" && (
                                <span>
                                  [{log.data.issueType}] HTTP {log.data.statusCode}
                                </span>
                              )}
                              {log.type === "vulnerability" && (
                                <span>
                                  [{log.data.category}] Severity: {log.data.severity} | Confidence: {log.data.confidence}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {liveFeed.length === 0 && (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                      <p>Waiting for scan data...</p>
                    </div>
                  </div>
                )}
                {liveFeed.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-500 animate-pulse py-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                    <span>Listening for updates...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scanning Animation - RIGHT */}
          <div className="order-2">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Radar className="w-6 h-6 text-purple-400" />
                Scan Status
              </h2>
            </div>
            
            <div className="card bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20 border-purple-500/30">
              <div className="flex flex-col items-center justify-center py-12 space-y-8">
                {/* Radar Animation */}
                <div className="relative">
                  {/* Outer rings */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 rounded-full border-2 border-purple-500/20 animate-pulse"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 rounded-full border-2 border-pink-500/20 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full border-2 border-blue-500/20 animate-pulse" style={{ animationDelay: '1s' }}></div>
                  </div>
                  
                  {/* Rotating radar beam */}
                  <div className="relative w-64 h-64 flex items-center justify-center">
                    <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
                      <div className="h-full w-1 bg-gradient-to-t from-transparent via-purple-500 to-transparent mx-auto"></div>
                    </div>
                    
                    {/* Center icon */}
                    <div className="relative z-10 bg-gray-900 rounded-full p-6 border-2 border-purple-500 shadow-lg shadow-purple-500/50">
                      <Radar className="w-12 h-12 text-purple-400 animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Current Phase */}
                <div className="text-center space-y-2">
                  <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
                    Current Phase
                  </p>
                  <p className="text-2xl font-bold text-white animate-pulse">
                    {currentPhase || "Initializing..."}
                  </p>
                </div>

                {/* Phase Progress */}
                <div className="w-full max-w-lg">
                  <div className="grid grid-cols-3 gap-4">
                    {phases.map((phase, idx) => {
                      const Icon = phase.icon;
                      const isActive = phase.active;
                      const isPast = phases.findIndex(p => p.active) > idx;
                      
                      return (
                        <div key={phase.name} className="flex flex-col items-center">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                              isActive
                                ? 'bg-purple-500 shadow-lg shadow-purple-500/50 scale-110'
                                : isPast
                                ? 'bg-green-500/50'
                                : 'bg-gray-700/50'
                            }`}
                          >
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <p className={`text-[10px] mt-2 text-center ${
                            isActive ? 'text-purple-300 font-semibold' : 'text-gray-500'
                          }`}>
                            {phase.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show Live Feed below when not scanning but has data */}
      {scanId && !isScanning && liveFeed.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-green-400" />
              Scan Log
              <span className="text-sm text-gray-500 font-normal">({liveFeed.length} events)</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const logText = liveFeed.map(log => 
                    `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}${
                      log.data ? ` | ${JSON.stringify(log.data)}` : ''
                    }`
                  ).join('\n');
                  const blob = new Blob([logText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `scan_${scanId}_log_${Date.now()}.txt`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Export Log
              </button>
              <button
                onClick={() => setLiveFeed([])}
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                Clear Log
              </button>
            </div>
          </div>
          
          <div className="card bg-black/40 border-green-500/20">
            <div 
              ref={liveFeedRef}
              className="h-96 overflow-y-auto font-mono text-xs space-y-1 p-4 bg-black/30 rounded-lg"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#374151 #1f2937'
              }}
            >
              {liveFeed.map((log, idx) => {
                const getLogStyle = () => {
                  switch (log.type) {
                    case "subdomain":
                      return log.data?.alive 
                        ? "text-purple-300 border-l-purple-500" 
                        : "text-purple-400/50 border-l-purple-700";
                    case "endpoint":
                      return log.data?.class === "success"
                        ? "text-green-300 border-l-green-500"
                        : log.data?.class === "error"
                        ? "text-red-300 border-l-red-500"
                        : "text-blue-300 border-l-blue-500";
                    case "port":
                      return "text-cyan-300 border-l-cyan-500";
                    case "tls":
                      return "text-blue-300 border-l-blue-500";
                    case "tls-warning":
                      return "text-orange-300 border-l-orange-500";
                    case "directory":
                      return "text-yellow-300 border-l-yellow-500";
                    case "vulnerability":
                      return "text-red-300 border-l-red-500";
                    case "status":
                      return "text-green-400 border-l-green-500";
                    case "error":
                      return "text-red-400 border-l-red-500";
                    case "info":
                      return "text-gray-400 border-l-gray-500";
                    default:
                      return "text-gray-300 border-l-gray-500";
                  }
                };

                const getIcon = () => {
                  switch (log.type) {
                    case "subdomain":
                      return <Shield className="w-3 h-3" />;
                    case "endpoint":
                      return <Globe className="w-3 h-3" />;
                    case "port":
                      return <Network className="w-3 h-3" />;
                    case "tls":
                    case "tls-warning":
                      return <Lock className="w-3 h-3" />;
                    case "directory":
                      return <FolderOpen className="w-3 h-3" />;
                    case "vulnerability":
                      return <AlertTriangle className="w-3 h-3" />;
                    case "status":
                      return <Activity className="w-3 h-3" />;
                    default:
                      return <ChevronRight className="w-3 h-3" />;
                  }
                };

                return (
                  <div
                    key={idx}
                    className={`border-l-2 pl-3 py-1 ${getLogStyle()} hover:bg-white/5 transition-colors`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-[10px] min-w-[60px]">
                        {log.timestamp}
                      </span>
                      <div className="flex items-center gap-1 min-w-[16px]">
                        {getIcon()}
                      </div>
                      <div className="flex-1">
                        <span className="break-all">{log.message}</span>
                        {log.data && (
                          <div className="text-gray-500 text-[10px] mt-0.5">
                            {log.type === "subdomain" && (
                              <span>
                                {log.data.ip && `[${log.data.ip}]`} {log.data.status}
                              </span>
                            )}
                            {log.type === "endpoint" && (
                              <span>
                                [HTTP {log.data.statusCode}] {log.data.title && `"${log.data.title}"`}
                              </span>
                            )}
                            {log.type === "port" && (
                              <span>
                                {log.data.service && `[${log.data.service}]`} 
                                {log.data.product && ` ${log.data.product}`}
                                {log.data.version && ` ${log.data.version}`}
                              </span>
                            )}
                            {log.type === "tls-warning" && log.data.weakVersions && (
                              <span>
                                Weak: {log.data.weakVersions.join(", ")}
                              </span>
                            )}
                            {log.type === "directory" && (
                              <span>
                                [{log.data.issueType}] HTTP {log.data.statusCode}
                              </span>
                            )}
                            {log.type === "vulnerability" && (
                              <span>
                                [{log.data.category}] Severity: {log.data.severity} | Confidence: {log.data.confidence}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Metrics Dashboard */}
      {scanId && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-purple-400" />
              Live Metrics
            </h2>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-sm text-gray-400">
                {isScanning ? 'Scanning' : status}
              </span>
              {scanId && (
                <button
                  onClick={() => navigate(`/scan/${scanId}`)}
                  className="ml-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  View Details
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Subdomains */}
            <div className="stat-card bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 group hover:border-purple-400/40 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Subdomains</p>
                  <p className="text-3xl font-bold text-purple-300 mt-2">
                    {metrics.subdomains}
                  </p>
                  <p className="text-xs text-purple-400 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {metrics.aliveSubdomains} alive
                  </p>
                </div>
                <Shield className="w-10 h-10 text-purple-500/30 group-hover:text-purple-400/50 transition-colors" />
              </div>
            </div>

            {/* Endpoints */}
            <div className="stat-card bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20 group hover:border-pink-400/40 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Endpoints</p>
                  <p className="text-3xl font-bold text-pink-300 mt-2">
                    {metrics.endpoints}
                  </p>
                  <p className="text-xs text-pink-400 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Mapped
                  </p>
                </div>
                <Globe className="w-10 h-10 text-pink-500/30 group-hover:text-pink-400/50 transition-colors" />
              </div>
            </div>

            {/* Open Ports */}
            <div className="stat-card bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 group hover:border-cyan-400/40 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Open Ports</p>
                  <p className="text-3xl font-bold text-cyan-300 mt-2">
                    {metrics.ports}
                  </p>
                  <p className="text-xs text-cyan-400 mt-1 flex items-center gap-1">
                    <Network className="w-3 h-3" />
                    Discovered
                  </p>
                </div>
                <Network className="w-10 h-10 text-cyan-500/30 group-hover:text-cyan-400/50 transition-colors" />
              </div>
            </div>

            {/* TLS Issues */}
            <div className="stat-card bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium">TLS Issues</p>
                  <p className="text-3xl font-bold text-orange-300 mt-2">
                    {metrics.tlsIssues}
                  </p>
                  <p className="text-xs text-orange-400 mt-1">Weak protocols</p>
                </div>
                <Lock className="w-8 h-8 text-orange-500/30" />
              </div>
            </div>

            {/* Directory Issues */}
            <div className="stat-card bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Directory Issues</p>
                  <p className="text-3xl font-bold text-yellow-300 mt-2">
                    {metrics.directoryIssues}
                  </p>
                  <p className="text-xs text-yellow-400 mt-1">Exposed paths</p>
                </div>
                <FolderOpen className="w-8 h-8 text-yellow-500/30" />
              </div>
            </div>

            {/* Scan ID */}
            <div className="stat-card col-span-2">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-2">Scan ID</p>
                <p className="text-lg font-mono text-purple-300 break-all">{scanId}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completion Message */}
      {scanId && status === "COMPLETED" && (
        <div className="card animate-slide-up bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-green-500/20 rounded-full p-3">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Scan Completed Successfully</h3>
                <p className="text-gray-400 mt-1">
                  Found {metrics.subdomains} subdomains, {metrics.endpoints} endpoints, {metrics.ports} open ports, and {metrics.directoryIssues} directory issues
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/scan/${scanId}`)}
              className="btn-primary px-6 py-3 flex items-center gap-2"
            >
              View Full Report
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Failed Message */}
      {scanId && status === "FAILED" && (
        <div className="card animate-slide-up bg-gradient-to-r from-red-900/20 to-orange-900/20 border-red-500/30">
          <div className="flex items-center gap-4">
            <div className="bg-red-500/20 rounded-full p-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Scan Failed</h3>
              <p className="text-gray-400 mt-1">
                {error || "An error occurred during the scan. Please try again."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
