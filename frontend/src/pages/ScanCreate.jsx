import React, { useState } from "react";
import { postJSON } from "../api/api";
import { useNavigate } from "react-router-dom";

export default function ScanCreate() {
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function startScan(e) {
    e.preventDefault();
    setErr("");

    const token = localStorage.getItem("access");
    if (!token) {
      setErr("You must login first.");
      return;
    }
    if (!target.trim()) {
      setErr("Please enter a domain (example.com).");
      return;
    }

    setLoading(true);
    try {
      const res = await postJSON("/recon/scans/start/", { target: target.trim() }, token);

      if (res?.detail) {
        setErr(res.detail);
        return;
      }

      // res should be ScanSerializer: {id, target, status,...}
      if (!res?.id) {
        setErr("Scan start failed (no scan id).");
        return;
      }

      navigate(`/scans/${res.id}`);
    } catch (e2) {
      setErr(String(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 20 }}>
      <h2>Start Recon Scan</h2>

      <form onSubmit={startScan} style={{ display: "flex", gap: 10 }}>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="example.com"
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit" disabled={loading} style={{ padding: "10px 14px" }}>
          {loading ? "Starting..." : "Start"}
        </button>
      </form>

      {err && <p style={{ marginTop: 12, color: "tomato" }}>{err}</p>}

      <p style={{ marginTop: 12, opacity: 0.8 }}>
        This will stream subdomains + endpoints live in the next page.
      </p>
    </div>
  );
}
