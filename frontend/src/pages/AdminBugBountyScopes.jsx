import React, { useEffect, useState } from "react";
import { adminApi } from "../api/adminApi";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";

export default function AdminBugBountyScopes() {
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState("");

  const [platform, setPlatform] = useState("hackerone");
  const [programName, setProgramName] = useState("");
  const [domain, setDomain] = useState("");

  useEffect(() => {
    fetchScopes();
  }, []);

  const fetchScopes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getBugBountyScopes();
      if (data?._status) {
        setError(data.detail || "Failed to load bug bounty scopes");
        return;
      }
      setScopes(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load bug bounty scopes");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess("");

    if (!programName.trim()) {
      setError("Program name is required");
      return;
    }

    if (!domain.trim()) {
      setError("Domain is required");
      return;
    }

    setSubmitting(true);

    const importPayload = {
      platform,
      program_name: programName.trim(),
      domain: domain.trim(),
    };

    const result = await adminApi.importBugBountyScopes(importPayload);
    if (result?._status) {
      setError(result.detail || "Import failed");
      setSubmitting(false);
      return;
    }

    setSuccess(`Import complete: created ${result.created}, updated ${result.updated}, skipped ${result.skipped}`);
    setSubmitting(false);
    await fetchScopes();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Bug Bounty Scope Import</h1>
        <p className="text-gray-400 mt-1">Import active scope data to allow authorized scanning on public programs</p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
      {success && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 text-green-300">
          {success}
        </div>
      )}

      <form onSubmit={handleImport} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input-premium w-full">
              <option value="hackerone">hackerone</option>
              <option value="bugcrowd">bugcrowd</option>
              <option value="intigriti">intigriti</option>
              <option value="yeswehack">yeswehack</option>
              <option value="other">other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Program Name</label>
            <input
              type="text"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              className="input-premium w-full"
              placeholder="Example Program"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Domain</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="input-premium w-full"
            placeholder="example.com"
          />
          <p className="mt-2 text-xs text-gray-400">
            Enter one domain or URL only.
          </p>
        </div>

        <button disabled={submitting} type="submit" className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white disabled:opacity-60">
          {submitting ? "Importing..." : "Import Scopes"}
        </button>
      </form>

      <div className="overflow-x-auto border border-gray-700/50 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-900/50 border-b border-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Platform</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Program</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Scope</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {scopes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                  No active scopes imported.
                </td>
              </tr>
            )}
            {scopes.map((scope) => (
              <tr key={scope.id} className="hover:bg-gray-800/50 transition">
                <td className="px-6 py-4 text-sm text-white">{scope.platform}</td>
                <td className="px-6 py-4 text-sm text-gray-300">{scope.program_name}</td>
                <td className="px-6 py-4 text-sm text-gray-300">{scope.scope_pattern}</td>
                <td className="px-6 py-4 text-sm text-gray-400">{scope.match_mode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
