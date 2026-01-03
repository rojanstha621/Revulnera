// src/pages/AdminDashboard.jsx
import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { adminApi } from "../api/adminApi";
import { TrendingUp, Users, BarChart3, AlertCircle } from "lucide-react";
import StatCard from "../components/admin/StatCard";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";

export default function AdminDashboard() {
  const { auth } = useContext(AuthContext);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getDashboard();
      if (data._status) {
        setError(data.detail || "Failed to load dashboard");
      } else {
        setDashboard(data);
      }
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 mt-1">Monitor users, scans, and system health</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
        >
          Refresh
        </button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {dashboard && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Users className="w-6 h-6" />}
              label="Total Users"
              value={dashboard.users.total}
              color="blue"
            />
            <StatCard
              icon={<Users className="w-6 h-6" />}
              label="Active Users"
              value={dashboard.users.active}
              color="green"
            />
            <StatCard
              icon={<BarChart3 className="w-6 h-6" />}
              label="Total Scans"
              value={dashboard.scans.total}
              color="purple"
            />
            <StatCard
              icon={<TrendingUp className="w-6 h-6" />}
              label="Scans (7 Days)"
              value={dashboard.scans.scans_7d}
              color="orange"
            />
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Stats */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">User Statistics</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-700/30">
                  <span className="text-gray-300">New Users (7 Days)</span>
                  <span className="font-semibold text-purple-400">{dashboard.users.new_7d}</span>
                </div>
                <div className="pt-3 space-y-2">
                  {Object.entries(dashboard.users.by_role || {}).map(([role, count]) => (
                    <div key={role} className="flex justify-between items-center">
                      <span className="text-gray-400 capitalize">{role} Users</span>
                      <span className="font-semibold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scan Stats */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Scan Statistics</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-700/30">
                  <span className="text-gray-300">Scans (30 Days)</span>
                  <span className="font-semibold text-purple-400">{dashboard.scans.scans_30d}</span>
                </div>
                <div className="pt-3 space-y-2">
                  {Object.entries(dashboard.scans.status_breakdown || {}).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-gray-400 capitalize">{status}</span>
                      <span className="font-semibold text-white">{count}</span>
                    </div>
                  ))}
                </div>
                {dashboard.scans.avg_duration_seconds && (
                  <div className="flex justify-between items-center pt-3 border-t border-gray-700/30">
                    <span className="text-gray-300">Avg Duration</span>
                    <span className="font-semibold text-orange-400">
                      {dashboard.scans.avg_duration_seconds.toFixed(2)}s
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Discovery */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StatCard
              icon={<BarChart3 className="w-6 h-6" />}
              label="Subdomains Found"
              value={dashboard.data.total_subdomains}
              color="blue"
            />
            <StatCard
              icon={<TrendingUp className="w-6 h-6" />}
              label="Alive Subdomains"
              value={dashboard.data.alive_subdomains}
              color="green"
            />
            <StatCard
              icon={<AlertCircle className="w-6 h-6" />}
              label="Endpoints Found"
              value={dashboard.data.total_endpoints}
              color="red"
            />
          </div>

          {/* HTTP Status Distribution */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">HTTP Status Distribution</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(dashboard.data.http_status_distribution || {}).map(([code, count]) => (
                <div key={code} className="bg-gray-900/50 rounded p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{count}</div>
                  <div className="text-sm text-gray-400">HTTP {code}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
