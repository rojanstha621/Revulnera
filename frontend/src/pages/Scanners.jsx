// src/pages/Scanners.jsx
import React, { useEffect, useRef, useState } from "react";
import { postJSON, WS_ROOT } from "../api/api";

export default function Scanners() {
  const [target, setTarget] = useState("");
  const [scanId, setScanId] = useState(null);

  const [status, setStatus] = useState("IDLE");
  const [error, setError] = useState("");

  const [subdomains, setSubdomains] = useState([]);
  const [endpoints, setEndpoints] = useState([]);

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

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto", color: "#fff" }}>
      <h2 style={{ marginTop: 0 }}>Recon Scanner</h2>

      <form onSubmit={startScan} style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="example.com"
          style={{
            flex: 1,
            padding: 10,
            background: "#0f0f0f",
            border: "1px solid #2a2a2a",
            borderRadius: 10,
            color: "#fff",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            background: "#1d4ed8",
            border: "1px solid #1d4ed8",
            borderRadius: 10,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Start Scan
        </button>
      </form>

      <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap", opacity: 0.95 }}>
        <span>Scan ID: <b>{scanId || "-"}</b></span>
        <span>Status: <b>{status}</b></span>
        <span>Subdomains: <b>{subdomains.length}</b> (alive: <b>{aliveCount}</b>)</span>
        <span>Endpoints: <b>{endpoints.length}</b></span>
      </div>

      {error && <p style={{ color: "tomato", marginTop: 10 }}>{error}</p>}

      {/* debug panel: if this shows an object, your endpoints state is NOT empty */}
      <div style={{ background: "#111", border: "1px solid #2a2a2a", padding: 10, borderRadius: 10, marginTop: 12 }}>
        <div>
          debug endpoints length: <b>{endpoints.length}</b>
        </div>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
          {JSON.stringify(endpoints[0] || null, null, 2)}
        </pre>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Subdomains (live)</h3>
          <div style={{ maxHeight: 520, overflow: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>IP</th>
                  <th style={th}>Alive</th>
                </tr>
              </thead>
              <tbody>
                {subdomains.map((s, idx) => (
                  <tr key={`${s?.name || "no-name"}-${idx}`}>
                    <td style={td}>{s?.name || "-"}</td>
                    <td style={td}>{s?.ip || "-"}</td>
                    <td style={td}>{s?.alive ? "yes" : "no"}</td>
                  </tr>
                ))}
                {subdomains.length === 0 && (
                  <tr>
                    <td style={td} colSpan={3}>No data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Endpoints (live)</h3>
          <div style={{ maxHeight: 520, overflow: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>URL</th>
                  <th style={th}>Code</th>
                  <th style={th}>Title</th>
                  <th style={th}>Fingerprints</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((e, idx) => (
                  <tr key={`${e?.url || "no-url"}-${idx}`}>
                    <td style={td}>
                      {e?.url ? (
                        <a href={e.url} target="_blank" rel="noreferrer" style={{ color: "#5ab3ff" }}>
                          {e.url}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={td}>{e?.status_code ?? "-"}</td>
                    <td style={td}>{e?.title || "-"}</td>
                    <td style={td}>{Array.isArray(e?.fingerprints) ? e.fingerprints.join(", ") : "-"}</td>
                  </tr>
                ))}
                {endpoints.length === 0 && (
                  <tr>
                    <td style={td} colSpan={4}>No data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const card = {
  background: "#0f0f0f",
  border: "1px solid #2a2a2a",
  borderRadius: 12,
  padding: 12,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  color: "#fff",
  textAlign: "left",
  borderBottom: "1px solid #444",
  padding: "8px 6px",
  fontWeight: 600,
};

const td = {
  color: "#fff",
  borderBottom: "1px solid #222",
  padding: "8px 6px",
  verticalAlign: "top",
};
