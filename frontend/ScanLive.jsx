import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { WS_ROOT } from "../api/api";

export default function ScanLive() {
  const { scanId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("CONNECTING");
  const [error, setError] = useState("");
  const [subdomains, setSubdomains] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [currentTest, setCurrentTest] = useState("Initializing scan...");
  const [startTime, setStartTime] = useState(Date.now());
  const [radarAngle, setRadarAngle] = useState(0);

  const subSeen = useRef(new Set());
  const epSeen = useRef(new Set());
  const wsRef = useRef(null);
  const canvasRef = useRef(null);

  // Stats counters
  const requestsSent = useMemo(() => endpoints.length, [endpoints]);
  const urlsCrawled = useMemo(() => new Set(endpoints.map(e => e?.url)).size, [endpoints]);
  const aliveCount = useMemo(() => subdomains.filter((s) => s?.alive).length, [subdomains]);

  // Elapsed time
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
  };

  // Radar animation
  useEffect(() => {
    const speed = status === "COMPLETED" || status === "FAILED" ? 0.5 : 3;
    const timer = setInterval(() => {
      setRadarAngle(prev => (prev + speed) % 360);
    }, 50);
    return () => clearInterval(timer);
  }, [status]);

  // Add activity to feed
  const addActivity = (message, type = "info") => {
    setActivityFeed(prev => [{
      id: Date.now() + Math.random(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 50));
  };

  useEffect(() => {
    setError("");
    setSubdomains([]);
    setEndpoints([]);
    setActivityFeed([]);
    subSeen.current = new Set();
    epSeen.current = new Set();
    setStartTime(Date.now());

    const url = `${WS_ROOT}/ws/scans/${scanId}/`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      addActivity("WebSocket connected", "success");
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.type === "scan_status") {
        setStatus(msg.status || "RUNNING");
        if (msg.error) {
          setError(msg.error);
          addActivity(`Error: ${msg.error}`, "error");
        }
        if (msg.status === "COMPLETED") {
          addActivity("Scan completed successfully", "success");
        }
      }

      if (msg.type === "subdomains_chunk") {
        const items = Array.isArray(msg.data) ? msg.data : [];
        setSubdomains((prev) => {
          const next = [...prev];
          for (const it of items) {
            const key = it?.name;
            if (!key || subSeen.current.has(key)) continue;
            subSeen.current.add(key);
            next.push(it);
            addActivity(`Found subdomain: ${key}`, "info");
            setCurrentTest(`Enumerating subdomains...`);
          }
          return next;
        });
      }

      if (msg.type === "endpoints_chunk") {
        const items = Array.isArray(msg.data) ? msg.data : [];
        setEndpoints((prev) => {
          const next = [...prev];
          for (const it of items) {
            const key = it?.url;
            if (!key || epSeen.current.has(key)) continue;
            epSeen.current.add(key);
            next.push(it);
            addActivity(`Crawling ${key}`, "info");
            setCurrentTest(`Probing endpoints...`);
          }
          return next;
        });
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
      addActivity("WebSocket error occurred", "error");
    };

    ws.onclose = () => {
      addActivity("WebSocket connection closed", "warning");
    };

    return () => {
      try { ws.close(); } catch {}
    };
  }, [scanId]);

  // Draw radar canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 20;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, size, size);

    // Draw radar circles
    ctx.strokeStyle = '#1a4d2e';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(center, center, (radius / 4) * i, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw radar cross
    ctx.beginPath();
    ctx.moveTo(center, center - radius);
    ctx.lineTo(center, center + radius);
    ctx.moveTo(center - radius, center);
    ctx.lineTo(center + radius, center);
    ctx.stroke();

    // Draw sweeping line
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((radarAngle * Math.PI) / 180);
    
    const gradient = ctx.createLinearGradient(0, 0, 0, -radius);
    gradient.addColorStop(0, 'rgba(0, 255, 100, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 100, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 255, 100, 0.8)');
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -radius);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, [radarAngle]);

  const getActivityIcon = (type) => {
    switch(type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      default:
        return '→';
    }
  };

  const scanProgress = status === "COMPLETED" ? 100 : Math.min((elapsedTime / 300) * 100, 95);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          <Activity size={28} style={{ marginRight: 12 }} />
          Vulnerability Scanner - Scan #{scanId}
        </h1>
        <div style={styles.statusBadge}>
          <div style={{
            ...styles.statusDot,
            backgroundColor: status === "COMPLETED" ? "#00ff88" : status === "FAILED" ? "#ff0044" : "#ffaa00"
          }} />
          {status}
        </div>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div style={styles.mainGrid}>
        {/* Left Panel - Activity Feed */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>
            <Activity size={18} />
            Live Activity
          </h3>
          <div style={styles.activityFeed}>
            {activityFeed.map(activity => (
              <div key={activity.id} style={styles.activityItem}>
                <span style={styles.activityIcon}>{getActivityIcon(activity.type)}</span>
                <span style={styles.activityTime}>{activity.timestamp}</span>
                <span style={styles.activityMessage}>{activity.message}</span>
              </div>
            ))}
            {activityFeed.length === 0 && (
              <div style={styles.emptyState}>Waiting for scan activity...</div>
            )}
          </div>
        </div>

        {/* Center - Radar */}
        <div style={styles.radarContainer}>
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            style={styles.radarCanvas}
          />
          <div style={styles.radarCenter}>
            <div style={styles.radarProgress}>{scanProgress.toFixed(0)}%</div>
            <div style={styles.radarTest}>{currentTest}</div>
          </div>
        </div>

        {/* Right Panel - Stats */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>
            <Clock size={18} />
            Live Statistics
          </h3>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{requestsSent}</div>
              <div style={styles.statLabel}>Requests Sent</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{urlsCrawled}</div>
              <div style={styles.statLabel}>URLs Crawled</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{subdomains.length}</div>
              <div style={styles.statLabel}>Subdomains</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{aliveCount}</div>
              <div style={styles.statLabel}>Alive Hosts</div>
            </div>
            <div style={{...styles.statCard, borderLeft: '3px solid #ff0044'}}>
              <div style={{...styles.statValue, color: '#ff0044'}}>{vulnsFound}</div>
              <div style={styles.statLabel}>Vulnerabilities</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{formatTime(elapsedTime)}</div>
              <div style={styles.statLabel}>Time Elapsed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Complete Summary */}
      {status === "COMPLETED" && (
        <div style={styles.completeBanner}>
          <CheckCircle size={32} style={{ color: '#00ff88' }} />
          <div style={styles.completeContent}>
            <h2 style={styles.completeTitle}>Scan Complete</h2>
            <div style={styles.completeSummary}>
              <div style={styles.completeStat}>
                <span style={{...styles.completeValue, color: '#00ff88'}}>{subdomains.length}</span>
                <span>Subdomains</span>
              </div>
              <div style={styles.completeStat}>
                <span style={{...styles.completeValue, color: '#00aaff'}}>{aliveCount}</span>
                <span>Alive Hosts</span>
              </div>
              <div style={styles.completeStat}>
                <span style={{...styles.completeValue, color: '#ff8800'}}>{endpoints.length}</span>
                <span>Endpoints</span>
              </div>
            </div>
            <button 
              style={styles.reportButton}
              onClick={() => navigate(`/scan/${scanId}`)}
            >
              View Full Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#e0e0e0',
    padding: '24px',
    fontFamily: '"JetBrains Mono", "Courier New", monospace',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #1a4d2e',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    color: '#00ff88',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 500,
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#2d0a0a',
    border: '1px solid #ff0044',
    borderRadius: '8px',
    color: '#ff6b6b',
    marginBottom: '24px',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr 300px',
    gap: '24px',
    marginBottom: '24px',
  },
  panel: {
    backgroundColor: '#111',
    border: '1px solid #1a4d2e',
    borderRadius: '12px',
    padding: '20px',
    height: '500px',
    display: 'flex',
    flexDirection: 'column',
  },
  panelTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#00ff88',
  },
  activityFeed: {
    flex: 1,
    overflowY: 'auto',
    fontSize: '12px',
  },
  activityItem: {
    display: 'flex',
    gap: '8px',
    padding: '6px 0',
    borderBottom: '1px solid #1a1a1a',
    animation: 'slideIn 0.3s ease-out',
  },
  activityIcon: {
    color: '#00ff88',
    fontWeight: 'bold',
  },
  activityTime: {
    color: '#666',
    minWidth: '70px',
  },
  activityMessage: {
    flex: 1,
    color: '#aaa',
  },
  emptyState: {
    textAlign: 'center',
    color: '#555',
    padding: '40px 20px',
  },
  radarContainer: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    border: '1px solid #1a4d2e',
    borderRadius: '12px',
    padding: '20px',
  },
  radarCanvas: {
    borderRadius: '50%',
  },
  radarCenter: {
    position: 'absolute',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  radarProgress: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#00ff88',
    textShadow: '0 0 20px #00ff88',
  },
  radarTest: {
    fontSize: '14px',
    color: '#888',
    marginTop: '8px',
    maxWidth: '200px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  statCard: {
    padding: '16px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    borderLeft: '3px solid #1a4d2e',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  vulnSection: {
    marginTop: '24px',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#ff6b6b',
  },
  vulnGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  vulnCard: {
    backgroundColor: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '16px',
    animation: 'slideUp 0.4s ease-out',
  },
  vulnHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  vulnSeverity: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  vulnTime: {
    fontSize: '11px',
    color: '#666',
  },
  vulnTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#fff',
  },
  vulnHost: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#888',
  },
  completeBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    padding: '32px',
    backgroundColor: '#0d2818',
    border: '2px solid #00ff88',
    borderRadius: '12px',
    marginTop: '24px',
  },
  completeContent: {
    flex: 1,
  },
  completeTitle: {
    margin: '0 0 16px 0',
    fontSize: '28px',
    color: '#00ff88',
  },
  completeSummary: {
    display: 'flex',
    gap: '32px',
    marginBottom: '24px',
  },
  completeStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  completeValue: {
    fontSize: '32px',
    fontWeight: 'bold',
  },
  reportButton: {
    padding: '12px 32px',
    backgroundColor: '#00ff88',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
