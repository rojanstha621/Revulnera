import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getKYCStatus, submitKYC } from "../api/api";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";
import { emitErrorToast } from "../utils/errorUtils";

export default function AccountVerification() {
  const location = useLocation();
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (error) {
      emitErrorToast(error);
    }
  }, [error]);

  const [docType, setDocType] = useState("CITIZENSHIP");
  const [docFront, setDocFront] = useState(null);
  const [docBack, setDocBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const selfiePreviewRef = useRef("");

  const stopCamera = () => {
    if (!cameraStreamRef.current) {
      setCameraActive(false);
      setCameraReady(false);
      return;
    }
    cameraStreamRef.current.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraReady(false);
  };

  const setSelfieWithPreview = (file) => {
    if (selfiePreviewRef.current) {
      URL.revokeObjectURL(selfiePreviewRef.current);
      selfiePreviewRef.current = "";
    }

    setSelfie(file);

    if (!file) {
      setSelfiePreviewUrl("");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    selfiePreviewRef.current = nextUrl;
    setSelfiePreviewUrl(nextUrl);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (selfiePreviewRef.current) {
        URL.revokeObjectURL(selfiePreviewRef.current);
      }
    };
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

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !cameraStreamRef.current) return;

    const video = videoRef.current;
    video.srcObject = cameraStreamRef.current;

    const startPlayback = async () => {
      try {
        await video.play();
      } catch {
        // Some browsers delay playback until enough data is available.
      }
    };

    startPlayback();
  }, [cameraActive]);

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
      setError("Selfie capture from camera is required.");
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
    setSelfieWithPreview(null);
    await loadStatus();
  };

  const startCamera = async () => {
    setError("");
    setCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported in this browser. Please use a compatible browser/device.");
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraActive(true);
    } catch {
      setError("Camera permission was denied or camera is unavailable. Please allow camera access and try again.");
      stopCamera();
    }
  };

  const captureSelfie = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !cameraStreamRef.current) {
      setError("Camera is not active. Please start the camera first.");
      return;
    }

    if (!cameraReady || video.readyState < 2) {
      setError("Camera feed is still loading. Please wait a moment and try again.");
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Failed to capture selfie. Please try again.");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    const file = await new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          resolve(new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92
      );
    });

    if (!file) {
      setError("Failed to capture selfie. Please try again.");
      return;
    }

    setSelfieWithPreview(file);
    stopCamera();
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
            <label className="block text-sm text-gray-300 mb-2">Selfie From Camera (required)</label>

            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Camera permission is required. Please allow access when your browser asks.
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
                >
                  {cameraActive ? "Restart Camera" : "Take Selfie From Camera"}
                </button>
                {cameraActive && (
                  <button
                    type="button"
                    onClick={captureSelfie}
                    disabled={!cameraReady}
                    className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Capture Selfie
                  </button>
                )}
                {cameraActive && (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm"
                  >
                    Cancel Camera
                  </button>
                )}
              </div>

              {cameraActive && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => setCameraReady(true)}
                  onCanPlay={() => setCameraReady(true)}
                  className="w-full max-w-md aspect-video object-cover rounded-lg border border-gray-600 bg-black"
                />
              )}

              {cameraActive && !cameraReady && (
                <p className="text-xs text-yellow-300">Starting camera feed, please wait...</p>
              )}

              <canvas ref={canvasRef} className="hidden" />

              <p className="text-xs text-gray-400">
                Manual upload is disabled. You must capture a selfie using your camera.
              </p>

              {selfiePreviewUrl && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Selfie preview</p>
                  <img
                    src={selfiePreviewUrl}
                    alt="Selfie preview"
                    className="w-full max-w-md rounded-lg border border-gray-600"
                  />
                </div>
              )}
            </div>
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
