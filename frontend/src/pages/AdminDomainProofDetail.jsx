import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { adminApi } from "../api/adminApi";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";

export default function AdminDomainProofDetail() {
  const { verificationId } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    loadData();
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [verificationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const detail = await adminApi.getDomainProofDetail(verificationId);
      if (detail?._status) {
        setError(detail.detail || "Failed to load domain proof detail");
        return;
      }
      setItem(detail);

      const blobRes = await adminApi.getDomainProofFileBlobUrl(verificationId);
      if (!blobRes.error) {
        setImageUrl(blobRes.url);
      }
    } catch {
      setError("Failed to load domain proof detail");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setProcessing(true);
      const res = await adminApi.approveDomainProof(verificationId, reviewNote.trim());
      if (res?._status) {
        setError(res.detail || "Failed to approve domain proof");
        return;
      }
      navigate("/admin/domain-proofs");
    } catch {
      setError("Failed to approve domain proof");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!reviewNote.trim()) {
      setError("Review note is required to reject proof.");
      return;
    }

    try {
      setProcessing(true);
      const res = await adminApi.rejectDomainProof(verificationId, reviewNote.trim());
      if (res?._status) {
        setError(res.detail || "Failed to reject domain proof");
        return;
      }
      navigate("/admin/domain-proofs");
    } catch {
      setError("Failed to reject domain proof");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/admin/domain-proofs")}
        className="flex items-center space-x-2 text-slate-400 hover:text-slate-300 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Domain Proof Queue
      </button>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {item && (
        <>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Domain Proof #{item.id}</h1>
                <p className="text-gray-400 mt-1">{item.user_email}</p>
              </div>
              <span className="px-4 py-2 rounded-full text-sm font-semibold bg-yellow-900/40 text-yellow-300">
                {item.manual_proof_status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-sm">
              <div>
                <p className="text-gray-400">Domain</p>
                <p className="text-white font-semibold">{item.domain}</p>
              </div>
              <div>
                <p className="text-gray-400">Submitted At</p>
                <p className="text-white font-semibold">
                  {item.manual_proof_submitted_at ? new Date(item.manual_proof_submitted_at).toLocaleString() : "-"}
                </p>
              </div>
              <div>
                <p className="text-gray-400">DNS Status</p>
                <p className="text-white font-semibold">{item.status}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
              <p className="text-gray-300 font-semibold mb-3">Uploaded Proof</p>
              {imageUrl ? (
                <img src={imageUrl} alt="Domain proof" className="w-full rounded border border-gray-700" />
              ) : (
                <p className="text-gray-400 text-sm">Proof image not available</p>
              )}
            </div>

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-4">
              <div>
                <p className="text-gray-300 font-semibold">User Note</p>
                <p className="text-gray-400 text-sm mt-1">{item.manual_proof_note || "-"}</p>
              </div>

              <div>
                <p className="text-gray-300 font-semibold mb-2">Review Note</p>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Add approval/rejection note"
                  className="w-full min-h-[140px] px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white disabled:opacity-50"
                >
                  {processing ? "Processing..." : "Approve"}
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white disabled:opacity-50"
                >
                  {processing ? "Processing..." : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
