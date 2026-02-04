// src/pages/Logs.jsx
import React, { useState } from "react";
import { FileText, Search, Filter, Download, Clock, AlertCircle } from "lucide-react";

export default function Logs() {
  const [searchTerm, setSearchTerm] = useState("");
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3 animate-slide-up">
        <div>
          <h1 className="text-4xl font-bold text-gradient">Scan Logs</h1>
          <p className="text-gray-400 mt-2">Monitor and review all your reconnaissance activities</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4 flex-col md:flex-row animate-slide-up">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search logs..."
            className="input-premium pl-12 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </button>
        <button className="btn-primary flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export
        </button>
      </div>

      {/* Coming Soon Card */}
      <div className="card card-hover animate-slide-up border-dashed border-2">
        <div className="text-center py-16 space-y-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto border border-purple-500/30">
            <FileText className="w-10 h-10 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Logs Coming Soon</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Detailed scan logs and activity history will appear here. Store, search, and export your reconnaissance data with advanced filtering options.
            </p>
          </div>
          <div className="pt-6 flex gap-4 justify-center">
            <div className="px-6 py-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <Clock className="w-5 h-5 text-purple-400 mx-auto mb-2" />
              <p className="text-sm text-purple-300">Timeline View</p>
            </div>
            <div className="px-6 py-3 rounded-lg bg-pink-500/10 border border-pink-500/30">
              <AlertCircle className="w-5 h-5 text-pink-400 mx-auto mb-2" />
              <p className="text-sm text-pink-300">Alerts</p>
            </div>
            <div className="px-6 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <Download className="w-5 h-5 text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-blue-300">Exports</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
