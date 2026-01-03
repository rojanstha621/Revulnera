// src/pages/AdminScanDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { ArrowLeft, BarChart3 } from "lucide-react";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";

export default function AdminScanDetail() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchScanDetail();
  }, [scanId]);

  const fetchScanDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminApi.getScanDetail(scanId);
      if (result._status) {
        setError(result.detail || "Failed to load scan");
      } else {
        setScan(result);
      }
    } catch (err) {
      setError("Failed to load scan details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/admin/scans")}
          className="flex items-center space-x-2 text-purple-400 hover:text-purple-300"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Scans
        </button>
        <ErrorAlert message={error} onDismiss={() => navigate("/admin/scans")} />
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-900/40 text-green-300";
      case "RUNNING":
        return "bg-blue-900/40 text-blue-300";
      case "FAILED":
        return "bg-red-900/40 text-red-300";
      case "PENDING":
        return "bg-yellow-900/40 text-yellow-300";
      default:
        return "bg-gray-700/40 text-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate("/admin/scans")}
        className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Scans
      </button>

      {/* Scan Header */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Scan #{scan.id}</h1>
            <p className="text-gray-400 mt-2 text-lg">{scan.target}</p>
            <p className="text-gray-500 text-sm mt-1">By: {scan.created_by_email}</p>
          </div>
          <span className={`px-4 py-2 rounded-full font-semibold ${getStatusColor(scan.status)}`}>
            {scan.status}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-2">Created</p>
          <p className="text-lg font-semibold text-white">
            {new Date(scan.created_at).toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-2">Updated</p>
          <p className="text-lg font-semibold text-white">
            {new Date(scan.updated_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Scan Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Subdomains */}
          <div>
            <p className="text-gray-400 text-sm mb-4">Subdomains</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total Found</span>
                <span className="text-2xl font-bold text-blue-400">{scan.stats.subdomains_discovered}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Alive</span>
                <span className="text-2xl font-bold text-green-400">{scan.stats.subdomains_alive}</span>
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div>
            <p className="text-gray-400 text-sm mb-4">Endpoints</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total Found</span>
                <span className="text-2xl font-bold text-orange-400">{scan.stats.endpoints_found}</span>
              </div>
            </div>
          </div>

          {/* HTTP Responses */}
          <div>
            <p className="text-gray-400 text-sm mb-4">HTTP Responses</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">2xx</span>
                <span className="text-green-400 font-semibold">{scan.stats["2xx_responses"]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">3xx</span>
                <span className="text-blue-400 font-semibold">{scan.stats["3xx_responses"]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">4xx</span>
                <span className="text-yellow-400 font-semibold">{scan.stats["4xx_responses"]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">5xx</span>
                <span className="text-red-400 font-semibold">{scan.stats["5xx_responses"]}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subdomains Overview */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Subdomains Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900/50 rounded p-4 text-center">
            <p className="text-gray-400 text-sm mb-2">Total</p>
            <p className="text-3xl font-bold text-white">{scan.subdomains.total}</p>
          </div>
          <div className="bg-gray-900/50 rounded p-4 text-center">
            <p className="text-gray-400 text-sm mb-2">Alive</p>
            <p className="text-3xl font-bold text-green-400">{scan.subdomains.alive}</p>
          </div>
          <div className="bg-gray-900/50 rounded p-4 text-center">
            <p className="text-gray-400 text-sm mb-2">Dead</p>
            <p className="text-3xl font-bold text-gray-400">{scan.subdomains.dead}</p>
          </div>
        </div>
      </div>

      {/* Endpoints Overview */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Endpoints Summary</h2>
        <div className="bg-gray-900/50 rounded p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400">Total Endpoints</span>
            <span className="text-3xl font-bold text-orange-400">{scan.endpoints.total}</span>
          </div>
          {Object.keys(scan.endpoints.by_status_code || {}).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700/30">
              <p className="text-gray-400 text-sm mb-3">Status Code Distribution</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(scan.endpoints.by_status_code).map(([code, count]) => (
                  <div key={code} className="bg-gray-800/50 rounded p-2 text-center">
                    <div className="text-sm text-gray-400">HTTP {code}</div>
                    <div className="text-lg font-bold text-purple-400">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
