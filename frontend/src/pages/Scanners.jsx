// src/pages/Scanners.jsx
import React, { useState, useEffect, useContext } from "react";
import { postJSON } from "../api/api";
import { AuthContext } from "../context/AuthContext";

export default function Scanners() {
  const [domain, setDomain] = useState("");
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const { auth } = useContext(AuthContext);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("scanHistory") || "[]");
      setHistory(stored);
    } catch {
      // ignore
    }
  }, []);

  const saveHistory = (entry) => {
    const updated = [entry, ...history].slice(0, 10); // keep last 10
    setHistory(updated);
    localStorage.setItem("scanHistory", JSON.stringify(updated));
  };

  async function scan() {
    setErr("");
    setResults([]);

    if (!domain || !domain.includes(".")) {
      setErr("Please enter a valid domain (e.g., example.com).");
      return;
    }

    setLoading(true);
    try {
      const res = await postJSON(
        "/scan/subdomains/",
        { domain },
        auth?.access || null
      );

      const subs = res.subdomains || [];
      setResults(subs);

      const entry = {
        domain,
        count: subs.length,
        date: new Date().toISOString(),
      };
      saveHistory(entry);
    } catch (e) {
      setErr("Scan failed. Check the server and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subdomain Scanner</h1>
        <p className="text-slate-300 mt-2 text-sm">
          Quickly enumerate subdomains of a target domain.
        </p>
      </div>

      {/* SCAN CARD */}
      <div className="card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value.trim())}
            className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="example.com"
          />
          <button
            onClick={scan}
            className="btn-primary px-6 py-2"
            disabled={loading}
          >
            {loading ? "Scanning..." : "Scan"}
          </button>
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>

      {/* RESULTS */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-3">
          Scan results ({results.length})
        </h2>
        {loading && (
          <p className="text-sm text-slate-300">Running scan, please wait...</p>
        )}

        {!loading && results.length === 0 && (
          <p className="text-sm text-slate-400">
            No results yet. Run a scan to see discovered subdomains.
          </p>
        )}

        {!loading && results.length > 0 && (
          <div className="max-h-64 overflow-auto mt-2 border border-white/5 rounded-lg">
            <ul className="divide-y divide-white/5">
              {results.map((sub) => (
                <li
                  key={sub}
                  className="px-3 py-2 text-sm text-slate-200 font-mono"
                >
                  {sub}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* HISTORY */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-3">
          Recent scans
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">
            No scan history yet. Your last 10 scans will appear here.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-slate-400 border-b border-white/10">
                <tr>
                  <th className="py-2 pr-4">Domain</th>
                  <th className="py-2 pr-4">Subdomains</th>
                  <th className="py-2 pr-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <tr key={`${item.domain}-${item.date}-${idx}`}>
                    <td className="py-2 pr-4 text-slate-200">
                      {item.domain}
                    </td>
                    <td className="py-2 pr-4 text-slate-200">
                      {item.count}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {new Date(item.date).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
