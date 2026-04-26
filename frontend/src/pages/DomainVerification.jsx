import React, { useEffect, useMemo, useState } from "react";
import {
  createDomainVerification,
  getBugBountyScopes,
  getDomainVerifications,
  submitDomainManualProof,
  verifyDomainChallenge,
} from "../api/api";
import LoadingScreen from "../components/LoadingScreen";

function statusClass(status) {
  if (status === "VERIFIED") return "bg-green-600/20 text-green-300 border-green-600/30";
  if (status === "PENDING") return "bg-yellow-600/20 text-yellow-300 border-yellow-600/30";
  if (status === "REVOKED") return "bg-red-600/20 text-red-300 border-red-600/30";
  if (status === "EXPIRED") return "bg-slate-600/20 text-slate-300 border-slate-600/30";
  if (status === "APPROVED") return "bg-green-600/20 text-green-300 border-green-600/30";
  if (status === "REJECTED") return "bg-red-600/20 text-red-300 border-red-600/30";
  if (status === "NONE") return "bg-slate-600/20 text-slate-300 border-slate-600/30";
  return "bg-slate-600/20 text-slate-300 border-slate-600/30";
}

export default function DomainVerification() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState({});
  const [uploading, setUploading] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [domain, setDomain] = useState("");
  const [domainVerifications, setDomainVerifications] = useState([]);
  const [bugBountyScopes, setBugBountyScopes] = useState([]);

  const [proofFiles, setProofFiles] = useState({});
  const [proofNotes, setProofNotes] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [verificationData, scopeData] = await Promise.all([
        getDomainVerifications(),
        getBugBountyScopes(),
      ]);

      if (verificationData?._status) {
        setError(verificationData.detail || "Failed to load domain verifications");
      } else {
        setDomainVerifications(Array.isArray(verificationData) ? verificationData : []);
      }

      if (!scopeData?._status) {
        setBugBountyScopes(Array.isArray(scopeData) ? scopeData : []);
      }
    } catch {
      setError("Failed to load domain authorization data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDomain = async (e) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const res = await createDomainVerification({ domain: domain.trim() });
    if (res?._status) {
      setError(res.detail || "Failed to create domain verification");
      setSaving(false);
      return;
    }

    setSuccess("Domain challenge created. Publish the TXT record and click Verify.");
    setDomain("");
    setSaving(false);
    await loadData();
  };

  const handleVerifyDns = async (verificationId) => {
    setVerifying((prev) => ({ ...prev, [verificationId]: true }));
    setError("");
    setSuccess("");

    const res = await verifyDomainChallenge(verificationId);
    if (res?._status) {
      setError(res.detail || res.error || "DNS verification failed");
    } else {
      setSuccess("DNS verification successful.");
    }

    setVerifying((prev) => ({ ...prev, [verificationId]: false }));
    await loadData();
  };

  const handleSubmitManualProof = async (verificationId) => {
    const file = proofFiles[verificationId];
    const note = proofNotes[verificationId] || "";

    if (!file) {
      setError("Please select an image before submitting manual proof.");
      return;
    }

    setUploading((prev) => ({ ...prev, [verificationId]: true }));
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("manual_proof_image", file);
    formData.append("manual_proof_note", note);

    const res = await submitDomainManualProof(verificationId, formData);
    if (res?._status) {
      setError(res.detail || "Failed to submit manual proof");
    } else {
      setSuccess("Manual proof submitted. Please wait for admin review.");
    }

    setUploading((prev) => ({ ...prev, [verificationId]: false }));
    await loadData();
  };

  const activeScopeCount = useMemo(() => bugBountyScopes.length, [bugBountyScopes]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-cyan-300">Domain Access Verification</h1>
        <p className="text-gray-400 mt-2">
          Verify target ownership with DNS. If DNS is not possible and target is not in bug bounty scope,
          submit screenshot proof for manual admin approval.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 text-green-300">
          {success}
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-xl font-semibold text-white mb-4">1. Create Domain Verification</h2>
        <form onSubmit={handleCreateDomain} className="flex flex-col md:flex-row gap-3">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            type="text"
            placeholder="example.com"
            className="input-premium flex-1"
          />
          <button type="submit" disabled={saving} className="btn-primary min-w-44">
            {saving ? "Creating..." : "Create Challenge"}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold text-white mb-4">2. Your Domain Verifications</h2>
        {domainVerifications.length === 0 ? (
          <p className="text-gray-400">No domain verification records yet.</p>
        ) : (
          <div className="space-y-5">
            {domainVerifications.map((item) => (
              <div key={item.id} className="border border-gray-700/50 rounded-lg p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="text-white font-semibold">{item.domain}</p>
                    <p className="text-sm text-gray-400">Created {new Date(item.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${statusClass(item.status)}`}>
                      DNS: {item.status}
                    </span>
                    <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${statusClass(item.manual_proof_status)}`}>
                      Manual: {item.manual_proof_status}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-900/60 border border-gray-700/60 rounded p-3 text-sm space-y-1">
                  <p className="text-gray-300">
                    TXT Name: <span className="text-cyan-300">{item.challenge_record_name}</span>
                  </p>
                  <p className="text-gray-300 break-all">
                    TXT Value: <span className="text-cyan-300">{item.challenge_record_value}</span>
                  </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                  <button
                    onClick={() => handleVerifyDns(item.id)}
                    disabled={!!verifying[item.id]}
                    className="btn-secondary"
                  >
                    {verifying[item.id] ? "Verifying..." : "Verify DNS"}
                  </button>
                  <p className="text-xs text-gray-400">
                    Use this after publishing TXT record in your DNS.
                  </p>
                </div>

                {item.status !== "VERIFIED" && item.manual_proof_status !== "APPROVED" && (
                  <div className="border-t border-gray-700/50 pt-4 space-y-3">
                    <p className="text-sm text-gray-300 font-medium">
                      Manual fallback: upload screenshot/proof for admin review
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setProofFiles((prev) => ({ ...prev, [item.id]: file }));
                      }}
                      className="text-sm text-gray-300"
                    />
                    <textarea
                      value={proofNotes[item.id] || ""}
                      onChange={(e) => setProofNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      className="input-premium w-full"
                      rows={3}
                      placeholder="Explain the evidence of your authorized access to this domain"
                    />
                    <button
                      onClick={() => handleSubmitManualProof(item.id)}
                      disabled={!!uploading[item.id]}
                      className="btn-primary"
                    >
                      {uploading[item.id] ? "Submitting..." : "Submit Manual Proof"}
                    </button>
                    {item.manual_review_note && (
                      <p className="text-xs text-gray-400">Admin note: {item.manual_review_note}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold text-white mb-2">3. Active Bug Bounty Scopes</h2>
        <p className="text-sm text-gray-400 mb-4">
          If your target is already in active bug bounty scope, scanning is allowed without DNS ownership proof.
        </p>
        <p className="text-cyan-300 font-medium mb-3">Active scope entries: {activeScopeCount}</p>
        <div className="max-h-64 overflow-y-auto border border-gray-700/50 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/60">
              <tr>
                <th className="px-3 py-2 text-left text-gray-300">Platform</th>
                <th className="px-3 py-2 text-left text-gray-300">Program</th>
                <th className="px-3 py-2 text-left text-gray-300">Scope</th>
                <th className="px-3 py-2 text-left text-gray-300">Mode</th>
              </tr>
            </thead>
            <tbody>
              {bugBountyScopes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-gray-400 text-center">
                    No active bug bounty scopes visible.
                  </td>
                </tr>
              ) : (
                bugBountyScopes.map((scope) => (
                  <tr key={scope.id} className="border-t border-gray-800/80">
                    <td className="px-3 py-2 text-gray-200">{scope.platform}</td>
                    <td className="px-3 py-2 text-gray-200">{scope.program_name}</td>
                    <td className="px-3 py-2 text-slate-300">{scope.scope_pattern}</td>
                    <td className="px-3 py-2 text-slate-300">{scope.match_mode}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
