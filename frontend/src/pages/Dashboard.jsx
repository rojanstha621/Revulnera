// src/pages/Dashboard.jsx
import React, { useEffect, useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Zap, TrendingUp, Clock, ArrowRight, Crown } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { getUserScans, getUserSubscription } from "../api/api";
import LoadingScreen from "../components/LoadingScreen";

export default function Dashboard() {
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [lastScan, setLastScan] = useState(null);
  const [scans, setScans] = useState([]);
  const [stats, setStats] = useState({ totalScans: 0, totalSubdomains: 0 });
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadScans = async () => {
      try {
        setLoading(true);
        const [data, subscriptionData] = await Promise.all([
          getUserScans(),
          getUserSubscription(),
        ]);

        if (subscriptionData?.plan) {
          setSubscription(subscriptionData);
        }
        
        if (Array.isArray(data)) {
          setScans(data);
          
          if (data.length > 0) {
            // Get latest scan
            setLastScan(data[0]);
            
            // Calculate stats
            const totalScans = data.length;
            const totalSubdomains = data.reduce((sum, scan) => sum + (scan.subdomain_count || 0), 0);
            setStats({ totalScans, totalSubdomains });
          }
        } else {
          setError("Failed to load scans");
        }
      } catch (err) {
        console.error("Error loading scans:", err);
        setError("Failed to fetch scan data");
      } finally {
        setLoading(false);
      }
    };

    loadScans();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-3">
        <div>
          <h1 className="text-5xl font-bold text-cyan-300 tracking-tight">
            Welcome back, {auth?.user?.full_name?.split(" ")[0] || "Scanner"}
          </h1>
          <p className="text-gray-400 mt-3 text-lg">
            Real-time reconnaissance and vulnerability assessment dashboard
          </p>

          {subscription?.plan && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-200">
              <Crown className="w-4 h-4" />
              Current Plan: {subscription.plan.display_name}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Scans Card */}
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Scans</p>
              <h3 className="text-4xl font-bold text-white mt-2">
                {stats.totalScans}
              </h3>
              <p className="text-cyan-300 text-sm mt-3 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Reconnaissance data collected
              </p>
            </div>
            <Activity className="w-12 h-12 text-cyan-500/30" />
          </div>
        </div>

        {/* Total Subdomains Card */}
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Subdomains Found</p>
              <h3 className="text-4xl font-bold text-white mt-2">
                {stats.totalSubdomains}
              </h3>
              <p className="text-green-400 text-sm mt-3 flex items-center">
                <Zap className="w-4 h-4 mr-1" />
                Unique assets discovered
              </p>
            </div>
            <Zap className="w-12 h-12 text-green-500/30" />
          </div>
        </div>

        {/* Quick Action Card */}
        <div className="card border border-slate-700">
          <div>
            <p className="text-gray-300 text-sm font-medium">Quick Action</p>
            <p className="text-gray-400 mt-2 text-sm">
              Launch a new subdomain reconnaissance scan
            </p>
            <Link 
              to="/scanners" 
              className="btn-primary w-full text-center block mt-4 flex items-center justify-center gap-2"
            >
              Start Scanner
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Last Scan & Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Last Scan Card */}
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Last Scan</h2>
              <p className="text-gray-400 text-sm">Recent reconnaissance results</p>
            </div>
            <Clock className="w-6 h-6 text-cyan-300/60" />
          </div>
          {lastScan ? (
            <div className="space-y-4 bg-black/20 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-400 text-sm">Target</p>
                  <p className="text-white font-mono text-lg font-semibold">{lastScan.target}</p>
                </div>
                <div className={`badge-${lastScan.status === "COMPLETED" ? "success" : lastScan.status === "RUNNING" ? "warning" : "info"}`}>
                  {lastScan.status}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                  <p className="text-gray-400 text-xs">Subdomains</p>
                  <p className="text-2xl font-bold text-cyan-300">{lastScan.subdomain_count}</p>
                  <p className="text-xs text-cyan-400 mt-1">Alive: {lastScan.alive_count}</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                  <p className="text-gray-400 text-xs">Endpoints</p>
                  <p className="text-2xl font-bold text-slate-200">{lastScan.endpoint_count}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-right">
                {new Date(lastScan.created_at).toLocaleString()}
              </p>
              <Link 
                to={`/scan/${lastScan.id}`}
                className="btn-secondary w-full text-center block text-sm"
              >
                View Detailed Results
              </Link>
            </div>
          ) : (
            <div className="bg-black/30 rounded-xl p-6 border border-white/5 text-center">
              <Activity className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                No scans yet. Run your first scan to see results here.
              </p>
              <Link to="/scanners" className="btn-secondary mt-4 mx-auto">
                Start Your First Scan
              </Link>
            </div>
          )}
        </div>

        {/* Recent Scans Card */}
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Recent Scans</h2>
              <p className="text-gray-400 text-sm">Your latest reconnaissance activity</p>
            </div>
            <TrendingUp className="w-6 h-6 text-cyan-300/60" />
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {scans.length > 0 ? (
              scans.slice(0, 5).map((scan) => (
                <div 
                  key={scan.id} 
                  onClick={() => navigate(`/scan/${scan.id}`)}
                  className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg hover:bg-slate-900 border border-slate-800 cursor-pointer"
                >
                  <div className="flex-1">
                    <p className="text-white font-mono text-sm font-semibold">{scan.target}</p>
                    <p className="text-gray-400 text-xs">
                      {scan.subdomain_count} subdomains • {scan.endpoint_count} endpoints
                    </p>
                    <p className="text-gray-500 text-xs">
                      {new Date(scan.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`badge-${scan.status === "COMPLETED" ? "success" : scan.status === "RUNNING" ? "warning" : "info"} text-xs`}>
                    {scan.status}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-6">No scans yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="card border border-slate-700 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">Compute Power Allocation</h3>
            <p className="text-gray-400 text-sm mt-1">
              All plans include full scanning modules. Your tier changes execution power.
            </p>
          </div>
          <Link to="/plans" className="btn-secondary text-sm">
            Compare Power Tiers
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <p className="text-gray-400 text-xs">Worker cores</p>
            <p className="text-white font-semibold mt-2">
              {subscription?.plan?.worker_count ?? 1}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <p className="text-gray-400 text-xs">Queue priority</p>
            <p className="text-white font-semibold mt-2">
              {subscription?.plan?.scan_queue_priority ?? 1}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <p className="text-gray-400 text-xs">Concurrent Scans</p>
            <p className="text-white font-semibold mt-2">
              {subscription?.plan?.max_concurrent_scans ?? 1}
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="rounded-2xl p-8 bg-slate-900/80 border border-slate-700">
        <div>
          <h3 className="text-2xl font-bold text-white mb-3">
            Ready to discover vulnerabilities?
          </h3>
          <p className="text-gray-300 mb-6">
            Launch a comprehensive scan to identify subdomains, endpoints, and potential security issues.
          </p>
          <Link to="/scanners" className="btn-primary inline-flex items-center gap-2">
            Launch Full Scan
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
