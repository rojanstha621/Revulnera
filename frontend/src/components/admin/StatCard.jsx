// src/components/admin/StatCard.jsx
import React from "react";

const colorMap = {
  blue: "bg-blue-900/20 text-blue-400 border-blue-700/30",
  green: "bg-green-900/20 text-green-400 border-green-700/30",
  purple: "bg-purple-900/20 text-purple-400 border-purple-700/30",
  orange: "bg-orange-900/20 text-orange-400 border-orange-700/30",
  red: "bg-red-900/20 text-red-400 border-red-700/30",
};

export default function StatCard({ icon, label, value, color = "blue" }) {
  return (
    <div className={`rounded-lg border p-6 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className="opacity-20">{icon}</div>
      </div>
    </div>
  );
}
