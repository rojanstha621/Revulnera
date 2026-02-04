// src/pages/AllScans.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Eye } from "lucide-react";
import { getUserScans } from "../api/api";
import LoadingScreen from "../components/LoadingScreen";

export default function AllScans() {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    const loadScans = async () => {
      try {
        setLoading(true);
        const data = await getUserScans();
        if (Array.isArray(data)) {
          setScans(data);
        }
      } catch (err) {
        console.error("Error loading scans:", err);
        setError("Failed to load scans");
      } finally {
        setLoading(false);
      }
    };

    loadScans();
  }, []);

  const filteredScans = scans
    .filter(scan => 
      scan.target.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(scan => 
      filterStatus === "all" || scan.status === filterStatus
    );

  const statusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "RUNNING":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "FAILED":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4 animate-slide-up">
        <h1 className="text-5xl font-bold text-gradient">All Scans</h1>
        <p className="text-gray-400">View and manage all your reconnaissance scans</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 animate-slide-up">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by target domain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-premium w-full pl-12"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-premium bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white cursor-pointer hover:bg-white/10 transition-colors"
        >
          <option value="all">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="RUNNING">Running</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {/* Scans Grid/List */}
      {error ? (
        <div className="card bg-red-500/20 border border-red-500/30">
          <p className="text-red-300">{error}</p>
        </div>
      ) : filteredScans.length > 0 ? (
        <div className="space-y-4 animate-slide-up">
          {filteredScans.map((scan) => (
            <div
              key={scan.id}
              className="card card-hover group cursor-pointer transition-all"
              onClick={() => navigate(`/scan/${scan.id}`)}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {scan.target}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Scanned on {new Date(scan.created_at).toLocaleDateString()} at{" "}
                    {new Date(scan.created_at).toLocaleTimeString()}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-300">
                      {scan.subdomain_count}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Subdomains</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-pink-300">
                      {scan.endpoint_count}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Endpoints</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-300">
                      {scan.alive_count}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Alive</p>
                  </div>
                </div>

                {/* Status & Action */}
                <div className="flex items-center gap-4">
                  <div
                    className={`px-3 py-1.5 rounded-lg border font-semibold text-sm ${statusColor(
                      scan.status
                    )}`}
                  >
                    {scan.status}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/scan/${scan.id}`);
                    }}
                    className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors text-purple-400 hover:text-purple-300"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card bg-white/5 border border-white/10 py-12">
          <div className="text-center space-y-3">
            <p className="text-2xl font-semibold text-gray-300">No scans found</p>
            <p className="text-gray-400">
              {searchTerm || filterStatus !== "all"
                ? "Try adjusting your search or filter"
                : "Start a new scan from the Scanners page"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
