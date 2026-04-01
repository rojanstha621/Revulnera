// src/pages/AdminUserDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { ArrowLeft, Mail, Calendar, BarChart3 } from "lucide-react";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    role: "user",
    is_active: true,
    can_run_vulnerability_scans: false,
  });

  useEffect(() => {
    fetchUserDetail();
  }, [userId]);

  const fetchUserDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminApi.getUserDetail(userId);
      if (result._status) {
        setError(result.detail || "Failed to load user");
      } else {
        setData(result);
        setForm({
          full_name: result?.user?.full_name || "",
          role: result?.user?.role || "user",
          is_active: !!result?.user?.is_active,
          can_run_vulnerability_scans: !!result?.user?.can_run_vulnerability_scans,
        });
      }
    } catch (err) {
      setError("Failed to load user details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/admin/users")}
          className="flex items-center space-x-2 text-slate-400 hover:text-slate-300"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Users
        </button>
        <ErrorAlert message={error} onDismiss={() => navigate("/admin/users")} />
      </div>
    );
  }

  const user = data?.user;
  const stats = data?.scan_statistics;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await adminApi.updateUser(userId, form);
    if (result?._status) {
      setError(result.detail || "Failed to update user");
      setSaving(false);
      return;
    }

    await fetchUserDetail();
    setSaving(false);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this user? This action cannot be undone.");
    if (!confirmed) return;

    setError(null);
    const result = await adminApi.deleteUser(userId);
    if (result?._status && result._status !== 204) {
      setError(result.detail || "Failed to delete user");
      return;
    }
    navigate("/admin/users");
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate("/admin/users")}
        className="flex items-center space-x-2 text-slate-400 hover:text-slate-300 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Users
      </button>

      {/* User Header */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{user?.full_name || user?.email}</h1>
            <p className="text-gray-400 mt-2 flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>{user?.email}</span>
            </p>
          </div>
          <div className="text-right">
            <span className={`px-4 py-2 rounded-full font-semibold inline-block ${
              user?.role === "admin" ? "bg-red-900/40 text-red-300" :
              user?.role === "analyst" ? "bg-blue-900/40 text-blue-300" :
              "bg-gray-700/40 text-gray-300"
            }`}>
              {user?.role?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-white">Edit User</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Full name"
            className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
          >
            <option value="user">User</option>
            <option value="analyst">Analyst</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.can_run_vulnerability_scans}
              onChange={(e) => setForm((f) => ({ ...f, can_run_vulnerability_scans: e.target.checked }))}
            />
            Vulnerability access approved
          </label>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white"
          >
            Delete User
          </button>
        </div>
      </form>

      {/* User Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-gray-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Joined</span>
          </div>
          <p className="text-lg font-semibold text-white">
            {new Date(user?.date_joined).toLocaleDateString()}
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-gray-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Last Login</span>
          </div>
          <p className="text-lg font-semibold text-white">
            {user?.last_login ? new Date(user.last_login).toLocaleDateString() : "Never"}
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-gray-400 mb-2">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm">Status</span>
          </div>
          <span className={`text-lg font-semibold inline-block ${
            user?.is_active ? "text-green-400" : "text-gray-400"
          }`}>
            {user?.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Scan Statistics */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Scan Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900/50 rounded p-4">
            <p className="text-gray-400 text-sm mb-2">Total Scans</p>
            <p className="text-3xl font-bold text-slate-400">{stats?.total_scans}</p>
          </div>
          <div className="bg-gray-900/50 rounded p-4">
            <p className="text-gray-400 text-sm mb-2">Total Subdomains</p>
            <p className="text-3xl font-bold text-blue-400">{stats?.total_subdomains}</p>
          </div>
          <div className="bg-gray-900/50 rounded p-4">
            <p className="text-gray-400 text-sm mb-2">Total Endpoints</p>
            <p className="text-3xl font-bold text-slate-400">{stats?.total_endpoints}</p>
          </div>
          <div className="bg-gray-900/50 rounded p-4">
            <p className="text-gray-400 text-sm mb-2">Scans by Status</p>
            <div className="space-y-1">
              {Object.entries(stats?.scans_by_status || {}).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span className="text-gray-400 capitalize">{status}</span>
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Scans */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Scans</h2>
        {data?.recent_scans && data.recent_scans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/50 border-b border-gray-700/30">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-300">Target</th>
                  <th className="px-4 py-3 text-left text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-gray-300">Subdomains</th>
                  <th className="px-4 py-3 text-left text-gray-300">Endpoints</th>
                  <th className="px-4 py-3 text-left text-gray-300">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {data.recent_scans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-gray-700/20 transition">
                    <td className="px-4 py-3 text-white">{scan.target}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        scan.status === "COMPLETED" ? "bg-green-900/40 text-green-300" :
                        scan.status === "RUNNING" ? "bg-blue-900/40 text-blue-300" :
                        scan.status === "FAILED" ? "bg-red-900/40 text-red-300" :
                        "bg-gray-700/40 text-gray-300"
                      }`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{scan.subdomain_count}</td>
                    <td className="px-4 py-3 text-gray-300">{scan.endpoint_count}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(scan.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No scans found for this user</p>
        )}
      </div>
    </div>
  );
}
