// src/components/subscription/HistoryTimeline.jsx
import React from "react";
import { ArrowUp, ArrowDown, RotateCcw, Trash2, AlertTriangle, Play } from "lucide-react";

const getChangeTypeIcon = (changeType) => {
  switch (changeType) {
    case "upgrade":
      return <ArrowUp className="w-5 h-5 text-green-400" />;
    case "downgrade":
      return <ArrowDown className="w-5 h-5 text-blue-400" />;
    case "renewal":
      return <RotateCcw className="w-5 h-5 text-purple-400" />;
    case "cancellation":
      return <Trash2 className="w-5 h-5 text-red-400" />;
    case "suspension":
      return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    case "reactivation":
      return <Play className="w-5 h-5 text-green-400" />;
    default:
      return <RotateCcw className="w-5 h-5 text-gray-400" />;
  }
};

const getChangeTypeLabel = (changeType) => {
  const labels = {
    upgrade: "Plan Upgraded",
    downgrade: "Plan Downgraded",
    renewal: "Subscription Renewed",
    cancellation: "Subscription Canceled",
    suspension: "Subscription Suspended",
    reactivation: "Subscription Reactivated",
  };
  return labels[changeType] || changeType;
};

export default function HistoryTimeline({ history }) {
  return (
    <div className="space-y-4">
      {history.map((entry, index) => {
        const isLast = index === history.length - 1;
        return (
          <div key={entry.id} className="relative">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-6 top-12 w-0.5 h-16 bg-gray-700" />
            )}

            {/* Entry */}
            <div className="flex gap-4">
              {/* Icon */}
              <div className="relative z-10 mt-1">
                <div className="w-12 h-12 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center">
                  {getChangeTypeIcon(entry.change_type)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg p-4 mt-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-white font-bold">
                      {getChangeTypeLabel(entry.change_type)}
                    </h4>
                    <p className="text-gray-400 text-sm mt-1">
                      {entry.old_plan_name && (
                        <>
                          <span className="font-medium">
                            {entry.old_plan_name}
                          </span>
                          <span className="mx-2">→</span>
                        </>
                      )}
                      <span className="font-medium text-cyan-400">
                        {entry.new_plan_name}
                      </span>
                    </p>
                  </div>
                  <span className="text-gray-500 text-sm whitespace-nowrap ml-4">
                    {new Date(entry.changed_at).toLocaleDateString()}
                  </span>
                </div>

                {entry.reason && (
                  <p className="text-gray-400 text-sm mt-2 italic">
                    "{entry.reason}"
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
