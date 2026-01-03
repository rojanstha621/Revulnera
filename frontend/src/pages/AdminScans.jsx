// src/pages/AdminScans.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { Search, Filter } from "lucide-react";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";
import Pagination from "../components/admin/Pagination";

export default function AdminScans() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchScans();
  }, [page, search, statusFilter]);

  const fetchScans = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getScans({
        page,
        page_size: 20,
        search,
        status: statusFilter,
      });
      if (data._status) {
        setError(data.detail || "Failed to load scans");
      } else {
        setScans(data.results || []);
        setTotalPages(data.total_pages || 1);
      }
    } catch (err) {
      setError("Failed to load scans");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Scans Monitor</h1>
        <p className="text-gray-400 mt-1">Track all scans and their results</p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Filters */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by target..."
              value={search}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="overflow-x-auto border border-gray-700/50 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Target</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">User</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Subdomains</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Endpoints</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {scans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-gray-800/50 transition">
                    <td className="px-6 py-4 text-sm text-purple-400 font-mono">#{scan.id}</td>
                    <td className="px-6 py-4 text-sm text-white font-medium">{scan.target}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{scan.created_by_email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(scan.status)}`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 font-semibold">{scan.subdomain_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-300 font-semibold">{scan.endpoint_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-400 text-xs">
                      {new Date(scan.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        to={`/admin/scans/${scan.id}`}
                        className="text-purple-400 hover:text-purple-300 transition"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {scans.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No scans found</p>
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
