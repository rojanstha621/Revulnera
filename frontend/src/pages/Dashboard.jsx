// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [lastScan, setLastScan] = useState(null);

  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem("scanHistory") || "[]");
      if (history.length > 0) {
        setLastScan(history[0]); // latest entry
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-300 mt-2">
          Welcome to Revulnera. Run scans and keep track of findings in one
          place.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">
            Quick action
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Start a subdomain scan for your target.
          </p>
          <Link to="/scanners" className="btn-primary w-full text-center block">
            Go to Scanners
          </Link>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">
            Last scan
          </h2>
          {lastScan ? (
            <div className="text-sm text-slate-300 space-y-1">
              <p>
                <span className="text-slate-400">Domain: </span>
                {lastScan.domain}
              </p>
              <p>
                <span className="text-slate-400">Subdomains found: </span>
                {lastScan.count}
              </p>
              <p className="text-slate-400 text-xs">
                {new Date(lastScan.date).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No scans yet. Run your first scan to see stats here.
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">
            Coming soon
          </h2>
          <ul className="text-sm text-slate-400 list-disc pl-4 space-y-1">
            <li>Automated scheduled scans</li>
            <li>Detailed vulnerability reports</li>
            <li>Export to PDF / JSON</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
