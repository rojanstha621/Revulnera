import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";

export default function AdminKYCQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getKYCQueue();
      if (data?._status) {
        setError(data.detail || "Failed to load KYC queue");
        return;
      }
      setQueue(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load KYC queue");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">KYC Queue</h1>
          <p className="text-gray-400 mt-1">Pending identity submissions for manual review</p>
        </div>
        <button
          onClick={fetchQueue}
          className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg text-white transition"
        >
          Refresh
        </button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="overflow-x-auto border border-gray-700/50 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-900/50 border-b border-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">User Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Document Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Submitted At</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {queue.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                  No pending KYC submissions.
                </td>
              </tr>
            )}
            {queue.map((item) => (
              <tr key={item.id} className="hover:bg-gray-800/50 transition">
                <td className="px-6 py-4 text-sm text-white">{item.user_email}</td>
                <td className="px-6 py-4 text-sm text-gray-300">{item.doc_type}</td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {new Date(item.submitted_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <Link
                    to={`/admin/kyc/${item.id}`}
                    className="text-slate-400 hover:text-slate-300 transition"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
