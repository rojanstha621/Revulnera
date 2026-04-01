import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getKYCStatus, submitKYC } from "../api/api";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";

export default function AccountVerification() {
  const location = useLocation();
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [docType, setDocType] = useState("CITIZENSHIP");
  const [docFront, setDocFront] = useState(null);
  const [docBack, setDocBack] = useState(null);
  const [selfie, setSelfie] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (loading) return;
    const hash = location.hash?.replace("#", "");
    if (!hash) return;

    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, location.hash, statusData?.status]);

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    const data = await getKYCStatus();
    if (data?._status) {
      setError(data.detail || "Failed to load verification status.");
    } else {
      setStatusData(data);
      const cacheKey = `kyc_status_${localStorage.getItem("access") ? "" : "unknown"}`;
      // Cache by token email when available from JWT payload in localStorage-backed auth state.
      try {
        const token = localStorage.getItem("access");
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1] || ""));
          const email = payload?.email || "unknown";
          sessionStorage.setItem(`kyc_status_${email}`, JSON.stringify({ status: data.status }));
        } else {
          sessionStorage.setItem(cacheKey, JSON.stringify({ status: data.status }));
        }
      } catch {
        // If token parsing fails, skip cache write safely.
      }
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!docFront) {
      setError("Document front image is required.");
      return;
    }
    if (!selfie) {
      setError("Selfie image is required.");
      return;
    }

    const formData = new FormData();
    formData.append("doc_type", docType);
    formData.append("doc_front", docFront);
    if (docBack) formData.append("doc_back", docBack);
    formData.append("selfie", selfie);

    setSubmitting(true);
    const res = await submitKYC(formData);
    setSubmitting(false);

    if (res?._status) {
      setError(res.detail || "Failed to submit KYC documents.");
      return;
    }

    setSuccess("KYC submitted successfully. Please wait for admin review.");
    setDocFront(null);
    setDocBack(null);
    setSelfie(null);
    await loadStatus();
  };

  if (loading) return <LoadingSpinner />;

  const status = statusData?.status || "NOT_SUBMITTED";
  const canSubmit = status === "NOT_SUBMITTED" || status === "REJECTED";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white">Account Verification</h1>
        <p className="text-gray-400 mt-1">
          Submit your identity documents for manual admin review to unlock vulnerability detection.
        </p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}
      {success && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-green-200 text-sm">
          {success}
        </div>
      )}

      <div id="status" className="card p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Current Status</h2>
        <div className="space-y-2 text-sm">
          <p className="text-gray-300">
            Status: <span className="font-semibold text-white">{status}</span>
          </p>
          {statusData?.submitted_at && (
            <p className="text-gray-300">
              Submitted At: <span className="font-semibold text-white">{new Date(statusData.submitted_at).toLocaleString()}</span>
            </p>
          )}
          {status === "REJECTED" && statusData?.rejection_reason && (
            <p className="text-red-300">Reason: {statusData.rejection_reason}</p>
          )}
          {status === "PENDING" && (
            <p className="text-yellow-300">Your submission is under review.</p>
          )}
          {status === "APPROVED" && (
            <p className="text-green-300">Your account is verified and approved.</p>
          )}
        </div>
      </div>

      {canSubmit && (
        <form id="submit" onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Submit Documents</h2>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
            >
              <option value="CITIZENSHIP">Citizenship</option>
              <option value="PASSPORT">Passport</option>
              <option value="LICENSE">License</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Document Front (required)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setDocFront(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-300"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Document Back (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setDocBack(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Selfie (required)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelfie(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-300"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Verification"}
          </button>
        </form>
      )}
    </div>
  );
}
