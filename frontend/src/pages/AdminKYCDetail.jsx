import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { adminApi } from "../api/adminApi";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";

export default function AdminKYCDetail() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [imageUrls, setImageUrls] = useState({ doc_front: null, doc_back: null, selfie: null });

  useEffect(() => {
    fetchDetail();
    return () => {
      ["doc_front", "doc_back", "selfie"].forEach((key) => {
        if (imageUrls[key]) URL.revokeObjectURL(imageUrls[key]);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getKYCDetail(submissionId);
      if (data?._status) {
        setError(data.detail || "Failed to load KYC submission");
        return;
      }
      setSubmission(data);

      const nextUrls = { doc_front: null, doc_back: null, selfie: null };
      for (const key of ["doc_front", "doc_back", "selfie"]) {
        const result = await adminApi.getKYCFileBlobUrl(submissionId, key);
        if (!result.error) nextUrls[key] = result.url;
      }
      setImageUrls(nextUrls);
    } catch {
      setError("Failed to load KYC submission");
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = useMemo(() => {
    if (!submission) return "";
    if (submission.status === "APPROVED") return "bg-green-900/40 text-green-300";
    if (submission.status === "REJECTED") return "bg-red-900/40 text-red-300";
    return "bg-yellow-900/40 text-yellow-300";
  }, [submission]);

  const handleApprove = async () => {
    try {
      setProcessing(true);
      const result = await adminApi.approveKYC(submissionId);
      if (result?._status) {
        setError(result.detail || "Failed to approve KYC");
        return;
      }
      navigate("/admin/kyc");
    } catch {
      setError("Failed to approve KYC");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }

    try {
      setProcessing(true);
      const result = await adminApi.rejectKYC(submissionId, rejectionReason.trim());
      if (result?._status) {
        setError(result.detail || "Failed to reject KYC");
        return;
      }
      navigate("/admin/kyc");
    } catch {
      setError("Failed to reject KYC");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/admin/kyc")}
        className="flex items-center space-x-2 text-slate-400 hover:text-slate-300 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to KYC Queue
      </button>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {submission && (
        <>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">KYC Submission #{submission.id}</h1>
                <p className="text-gray-400 mt-1">{submission.user_email}</p>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusBadge}`}>
                {submission.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-sm">
              <div>
                <p className="text-gray-400">Document Type</p>
                <p className="text-white font-semibold">{submission.doc_type}</p>
              </div>
              <div>
                <p className="text-gray-400">Submitted At</p>
                <p className="text-white font-semibold">{new Date(submission.submitted_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Full Name</p>
                <p className="text-white font-semibold">{submission.user_full_name || "-"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
              <p className="text-gray-300 font-semibold mb-3">Document Front</p>
              {imageUrls.doc_front ? (
                <img src={imageUrls.doc_front} alt="Document front" className="w-full rounded border border-gray-700" />
              ) : (
                <p className="text-gray-400 text-sm">Not available</p>
              )}
            </div>

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
              <p className="text-gray-300 font-semibold mb-3">Document Back</p>
              {imageUrls.doc_back ? (
                <img src={imageUrls.doc_back} alt="Document back" className="w-full rounded border border-gray-700" />
              ) : (
                <p className="text-gray-400 text-sm">Not provided</p>
              )}
            </div>

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
              <p className="text-gray-300 font-semibold mb-3">Selfie</p>
              {imageUrls.selfie ? (
                <img src={imageUrls.selfie} alt="Selfie" className="w-full rounded border border-gray-700" />
              ) : (
                <p className="text-gray-400 text-sm">Not available</p>
              )}
            </div>
          </div>

          {submission.status === "PENDING" && (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold text-white">Review Decision</h2>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Add reason if rejecting this submission"
                className="w-full min-h-[120px] px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-slate-500"
              />

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
          )}

          {submission.status === "REJECTED" && submission.rejection_reason && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
              <p className="text-red-200 text-sm">Rejection reason: {submission.rejection_reason}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
