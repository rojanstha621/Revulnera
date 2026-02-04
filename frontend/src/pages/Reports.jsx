// src/pages/Reports.jsx
import React, { useState } from "react";
import { BarChart3, Calendar, Download, Share2, TrendingUp, FileJson } from "lucide-react";

export default function Reports() {
  const [dateRange, setDateRange] = useState("7days");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3 animate-slide-up">
        <div>
          <h1 className="text-4xl font-bold text-gradient">Reports & Analytics</h1>
          <p className="text-gray-400 mt-2">Generate and export comprehensive scan reports</p>
        </div>
      </div>

      {/* Report Generator */}
      <div className="card card-hover animate-slide-up">
        <h2 className="text-2xl font-bold text-white mb-6">Generate New Report</h2>
        <div className="space-y-4">
          {/* Date Range Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { value: "7days", label: "Last 7 Days" },
              { value: "30days", label: "Last 30 Days" },
              { value: "all", label: "All Time" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  dateRange === option.value
                    ? "bg-purple-600/30 border-purple-500 text-purple-300"
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/50"
                }`}
              >
                <Calendar className="w-5 h-5 mx-auto mb-2" />
                {option.label}
              </button>
            ))}
          </div>

          {/* Report Type Options */}
          <div className="pt-4 space-y-3">
            <p className="text-sm font-semibold text-gray-300">Report Format</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="card hover:scale-105 transition-transform border border-white/10 hover:border-purple-500/30">
                <BarChart3 className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                <p className="text-white font-semibold">PDF Report</p>
                <p className="text-gray-400 text-xs mt-1">Professional document</p>
              </button>
              <button className="card hover:scale-105 transition-transform border border-white/10 hover:border-pink-500/30">
                <FileJson className="w-8 h-8 text-pink-400 mx-auto mb-3" />
                <p className="text-white font-semibold">JSON Export</p>
                <p className="text-gray-400 text-xs mt-1">Raw data format</p>
              </button>
              <button className="card hover:scale-105 transition-transform border border-white/10 hover:border-blue-500/30">
                <TrendingUp className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <p className="text-white font-semibold">Summary</p>
                <p className="text-gray-400 text-xs mt-1">Quick overview</p>
              </button>
            </div>
          </div>

          <button className="btn-primary w-full flex items-center justify-center gap-2 mt-6">
            <Download className="w-5 h-5" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
        <div className="card card-hover bg-gradient-to-br from-purple-500/20 to-pink-500/20">
          <BarChart3 className="w-10 h-10 text-purple-400 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Scan Statistics</h3>
          <p className="text-gray-400">Get detailed metrics on your reconnaissance activities, including subdomain discoveries and endpoint analysis.</p>
        </div>
        <div className="card card-hover bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
          <Share2 className="w-10 h-10 text-blue-400 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Share Reports</h3>
          <p className="text-gray-400">Export and share your findings with team members or stakeholders securely.</p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="card border-dashed border-2 text-center py-12 animate-slide-up">
        <p className="text-gray-400 mb-4">Full reporting features coming soon</p>
        <p className="text-sm text-gray-500">Advanced analytics, scheduling, and team collaboration features in development</p>
      </div>
    </div>
  );
}
