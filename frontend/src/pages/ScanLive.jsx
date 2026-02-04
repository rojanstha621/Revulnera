import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { WS_ROOT } from "../api/api";

export default function ScanLive() {
  const { scanId } = useParams();

  const [status, setStatus] = useState("CONNECTING");
  const [error, setError] = useState("");
  const [subdomains, setSubdomains] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [vulnerabilities, setVulnerabilities] = useState([]);

  const subSeen = useRef(new Set());
  const epSeen = useRef(new Set());
  const vulnSeen = useRef(new Set());
  const wsRef = useRef(null);

  useEffect(() => {
    setError("");
    setSubdomains([]);
    setEndpoints([]);
    setVulnerabilities([]);
    subSeen.current = new Set();
    epSeen.current = new Set();
    vulnSeen.current = new Set();

    const url = `${WS_ROOT}/ws/scans/${scanId}/`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.type === "scan_status") {
        setStatus(msg.status || "RUNNING");
        if (msg.error) setError(msg.error);
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
          }
          return next;
      if (msg.type === "vulnerability_chunk") {
        const items = Array.isArray(msg.data) ? msg.data : [];
        setVulnerabilities((prev) => {
          const next = [...prev];
          for (const it of items) {
            const key = `${it?.host}_${it?.url}_${it?.owasp_category}`;
            if (!key || vulnSeen.current.has(key)) continue;
            vulnSeen.current.add(key);
            next.push(it);
  const criticalVulns = useMemo(() => vulnerabilities.filter((v) => v.severity === "High").length, [vulnerabilities]);
          }
          return next;
        });
      }
        });
      }
    };
  <span>Vulnerabilities: <b>{vulnerabilities.length}</b> (critical: <b style={{ color: criticalVulns > 0 ? "tomato" : "inherit" }}>{criticalVulns}</b>)</span>
      </div>
      {error && <p style={{ color: "tomato" }}>{error}</p>}

      <pre style={{ marginTop: 14, padding: 12, border: "1px solid #2a2a2a", borderRadius: 12, overflow: "auto" }}>
        Latest endpoints:\n
        {JSON.stringify(endpoints.slice(-5), null, 2)}
      </pre>

      {vulnerabilities.length > 0 && (
        <pre style={{ marginTop: 14, padding: 12, border: "1px solid tomato", borderRadius: 12, overflow: "auto", backgroundColor: "rgba(255, 99, 71, 0.05)" }}>
          Latest vulnerabilities:\n
          {JSON.stringify(vulnerabilities.slice(-10), null, 2)}
        </pre>
      )}
  const aliveCount = useMemo(() => subdomains.filter((s) => s.alive).length, [subdomains]);

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Scan #{scanId}</h2>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", opacity: 0.9 }}>
        <span>Status: <b>{status}</b></span>
        <span>Subdomains: <b>{subdomains.length}</b> (alive: <b>{aliveCount}</b>)</span>
        <span>Endpoints: <b>{endpoints.length}</b></span>
      </div>
      {error && <p style={{ color: "tomato" }}>{error}</p>}

      <pre style={{ marginTop: 14, padding: 12, border: "1px solid #2a2a2a", borderRadius: 12, overflow: "auto" }}>
        Latest endpoints:\n
        {JSON.stringify(endpoints.slice(-5), null, 2)}
      </pre>
    </div>
  );
}
