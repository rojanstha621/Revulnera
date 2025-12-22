import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

function getWsBase() {
  // Your Django backend is on 8000 in dev:
  // If you later set VITE_API_URL, this can be made dynamic.
  return "ws://localhost:8000";
}

export default function ScanLive() {
  const { scanId } = useParams();

  const [status, setStatus] = useState("CONNECTING");
  const [error, setError] = useState("");
  const [subdomains, setSubdomains] = useState([]);
  const [endpoints, setEndpoints] = useState([]);

  // Dedup maps to prevent repeated rows
  const subSeen = useRef(new Set());
  const epSeen = useRef(new Set());

  const wsRef = useRef(null);

  useEffect(() => {
    setError("");
    setStatus("CONNECTING");
    setSubdomains([]);
    setEndpoints([]);
    subSeen.current = new Set();
    epSeen.current = new Set();

    const wsUrl = `${getWsBase()}/ws/scans/${scanId}/`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("CONNECTED");
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        if (msg.type === "scan_status") {
          setStatus(msg.status || "RUNNING");
          if (msg.error) setError(msg.error);
          return;
        }

        if (msg.type === "subdomains_chunk") {
          const items = msg.data || [];
          setSubdomains((prev) => {
            const next = [...prev];
            for (const it of items) {
              const key = it.name;
              if (!key || subSeen.current.has(key)) continue;
              subSeen.current.add(key);
              next.push(it);
            }
            return next;
          });
          return;
        }

        if (msg.type === "endpoints_chunk") {
          const items = msg.data || [];
          setEndpoints((prev) => {
            const next = [...prev];
            for (const it of items) {
              const key = it.url;
              if (!key || epSeen.current.has(key)) continue;
              epSeen.current.add(key);
              next.push(it);
            }
            return next;
          });
          return;
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setError("WebSocket error (is Django Channels running?)");
    };

    ws.onclose = () => {
      // If scan completed, Django might keep socket open anyway; for dev we just show disconnected.
      // You can auto-reconnect later if you want.
      setStatus((s) => (s === "COMPLETED" ? "COMPLETED" : "DISCONNECTED"));
    };

    return () => {
      ws.close();
    };
  }, [scanId]);

  const liveSubCount = subdomains.length;
  const liveEpCount = endpoints.length;

  const aliveCount = useMemo(() => {
    let c = 0;
    for (const s of subdomains) if (s.alive) c++;
    return c;
  }, [subdomains]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <h2 style={{ margin: 0 }}>Scan #{scanId}</h2>
        <span style={{ opacity: 0.8 }}>Status: <b>{status}</b></span>
        <span style={{ opacity: 0.8 }}>Subdomains: <b>{liveSubCount}</b> (alive: <b>{aliveCount}</b>)</span>
        <span style={{ opacity: 0.8 }}>Endpoints: <b>{liveEpCount}</b></span>
      </div>

      {error && <p style={{ color: "tomato", marginTop: 10 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <section style={{ border: "1px solid #333", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Subdomains (live)</h3>

          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>IP</th>
                  <th style={th}>Alive</th>
                </tr>
              </thead>
              <tbody>
                {subdomains.map((s) => (
                  <tr key={s.name}>
                    <td style={td}>{s.name}</td>
                    <td style={td}>{s.ip || "-"}</td>
                    <td style={td}>{s.alive ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: "1px solid #333", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Endpoints (filtered)</h3>

          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>URL</th>
                  <th style={th}>Code</th>
                  <th style={th}>Title</th>
                  <th style={th}>Fingerprints</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((e) => (
                  <tr key={e.url}>
                    <td style={td}>
                      <a href={e.url} target="_blank" rel="noreferrer" style={{ color: "#7cc7ff" }}>
                        {e.url}
                      </a>
                    </td>
                    <td style={td}>{e.status_code}</td>
                    <td style={td}>{e.title || "-"}</td>
                    <td style={td}>
                      {(e.fingerprints || []).join(", ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  borderBottom: "1px solid #444",
  padding: "8px 6px",
  fontWeight: 600,
};

const td = {
  borderBottom: "1px solid #222",
  padding: "8px 6px",
  verticalAlign: "top",
};
