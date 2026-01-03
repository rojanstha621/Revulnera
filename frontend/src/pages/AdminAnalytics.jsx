// src/pages/AdminAnalytics.jsx
import React, { useEffect, useState } from "react";
import { adminApi } from "../api/adminApi";
import { TrendingUp, Target, Users } from "lucide-react";
import LoadingSpinner from "../components/admin/LoadingSpinner";
import ErrorAlert from "../components/admin/ErrorAlert";

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getAnalytics(period);
      if (data._status) {
        setError(data.detail || "Failed to load analytics");
      } else {
        setAnalytics(data);
      }
    } catch (err) {
      setError("Failed to load analytics data");
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
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Advanced insights and trends</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
        >
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {analytics && (
        <>
          {/* Scan Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Scans</p>
                  <p className="text-3xl font-bold text-white mt-2">{analytics.scan_metrics.total_scans}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-400 opacity-20" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Completed</p>
                  <p className="text-3xl font-bold text-green-400 mt-2">{analytics.scan_metrics.completed}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400 opacity-20" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Failed</p>
                  <p className="text-3xl font-bold text-red-400 mt-2">{analytics.scan_metrics.failed}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-red-400 opacity-20" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Success Rate</p>
                  <p className="text-3xl font-bold text-blue-400 mt-2">{analytics.scan_metrics.success_rate_percent}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-400 opacity-20" />
              </div>
            </div>
          </div>

          {/* Average Findings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Average Findings Per Scan</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-gray-700/30">
                  <span className="text-gray-300">Endpoints</span>
                  <span className="text-2xl font-bold text-orange-400">
                    {analytics.average_findings.endpoints_per_scan}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Subdomains</span>
                  <span className="text-2xl font-bold text-blue-400">
                    {analytics.average_findings.subdomains_per_scan}
                  </span>
                </div>
              </div>
            </div>

            {/* Most Active Users */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Top Active Users</h2>
              <div className="space-y-3">
                {analytics.most_active_users.map((user, idx) => (
                  <div key={idx} className="flex items-center justify-between pb-3 border-b border-gray-700/30 last:border-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-purple-900/40 flex items-center justify-center">
                        <Users className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-gray-300 truncate">{user.email}</span>
                    </div>
                    <span className="font-semibold text-purple-400">{user.scans}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Targets */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Top Targets</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/50 border-b border-gray-700/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-300">Rank</th>
                    <th className="px-4 py-3 text-left text-gray-300">Target</th>
                    <th className="px-4 py-3 text-left text-gray-300">Scans</th>
                    <th className="px-4 py-3 text-left text-gray-300">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {analytics.top_targets.map((target, idx) => {
                    const percentage = analytics.scan_metrics.total_scans > 0 
                      ? ((target.count / analytics.scan_metrics.total_scans) * 100).toFixed(1)
                      : 0;
                    return (
                      <tr key={idx} className="hover:bg-gray-700/20 transition">
                        <td className="px-4 py-3 text-purple-400 font-semibold">#{idx + 1}</td>
                        <td className="px-4 py-3 text-white">{target.target}</td>
                        <td className="px-4 py-3 text-gray-300 font-semibold">{target.count}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-24 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-600 to-purple-400"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-gray-400 text-xs w-10">{percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scans Per Day Chart */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Scans Per Day</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {Object.entries(analytics.scans_per_day || {})
                .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                .slice(0, 30)
                .map(([date, count]) => {
                  const maxCount = Math.max(...Object.values(analytics.scans_per_day || {}), 1);
                  const percentage = (count / maxCount) * 100;
                  return (
                    <div key={date} className="flex items-center space-x-4">
                      <span className="text-gray-400 text-sm w-24">{date}</span>
                      <div className="flex-1 h-8 bg-gray-700/30 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-lg transition-all"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-gray-300 font-semibold w-12 text-right">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
