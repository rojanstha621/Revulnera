// src/pages/Dashboard.jsx
import React, { useEffect, useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Zap, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { getUserScans } from "../api/api";
import LoadingScreen from "../components/LoadingScreen";

export default function Dashboard() {
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [lastScan, setLastScan] = useState(null);
  const [scans, setScans] = useState([]);
  const [stats, setStats] = useState({ totalScans: 0, totalSubdomains: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadScans = async () => {
      try {
        setLoading(true);
        const data = await getUserScans();
        
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
      <div className="space-y-3 animate-slide-up">
        <div>
          <h1 className="text-5xl font-bold text-gradient">
            Welcome back, {auth?.user?.full_name?.split(" ")[0] || "Scanner"}
          </h1>
          <p className="text-gray-400 mt-3 text-lg">
            Real-time reconnaissance and vulnerability assessment dashboard
          </p>
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
        <div className="stat-card card-hover animate-slide-up group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Scans</p>
              <h3 className="text-4xl font-bold text-white mt-2">
                {stats.totalScans}
              </h3>
              <p className="text-purple-400 text-sm mt-3 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Reconnaissance data collected
              </p>
            </div>
            <Activity className="w-12 h-12 text-purple-500/30 group-hover:text-purple-400 transition-colors" />
          </div>
        </div>

        {/* Total Subdomains Card */}
        <div className="stat-card card-hover animate-slide-up group">
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
            <Zap className="w-12 h-12 text-green-500/30 group-hover:text-green-400 transition-colors" />
          </div>
        </div>

        {/* Quick Action Card */}
        <div className="card card-hover animate-slide-up bg-gradient-to-br from-purple-600/40 to-pink-600/40 border border-purple-400/50 group">
          <div>
            <p className="text-gray-300 text-sm font-medium">Quick Action</p>
            <p className="text-gray-400 mt-2 text-sm">
              Launch a new subdomain reconnaissance scan
            </p>
            <Link 
              to="/scanners" 
              className="btn-primary w-full text-center block mt-4 flex items-center justify-center gap-2 group-hover:gap-4 transition-all"
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
        <div className="card card-hover animate-slide-up">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Last Scan</h2>
              <p className="text-gray-400 text-sm">Recent reconnaissance results</p>
            </div>
            <Clock className="w-6 h-6 text-purple-400/50" />
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
                <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                  <p className="text-gray-400 text-xs">Subdomains</p>
                  <p className="text-2xl font-bold text-purple-300">{lastScan.subdomain_count}</p>
                  <p className="text-xs text-purple-400 mt-1">Alive: {lastScan.alive_count}</p>
                </div>
                <div className="bg-pink-500/10 rounded-lg p-3 border border-pink-500/20">
                  <p className="text-gray-400 text-xs">Endpoints</p>
                  <p className="text-2xl font-bold text-pink-300">{lastScan.endpoint_count}</p>
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
        <div className="card card-hover animate-slide-up">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Recent Scans</h2>
              <p className="text-gray-400 text-sm">Your latest reconnaissance activity</p>
            </div>
            <TrendingUp className="w-6 h-6 text-pink-400/50" />
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {scans.length > 0 ? (
              scans.slice(0, 5).map((scan) => (
                <div 
                  key={scan.id} 
                  onClick={() => navigate(`/scan/${scan.id}`)}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/5 cursor-pointer group"
                >
                  <div className="flex-1">
                    <p className="text-white font-mono text-sm font-semibold group-hover:text-purple-300 transition-colors">{scan.target}</p>
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

      {/* CTA Section */}
      <div className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-r from-purple-600/30 via-pink-600/20 to-purple-600/30 border border-purple-400/30 animate-slide-up">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-600/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
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
