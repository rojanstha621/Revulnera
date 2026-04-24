// src/components/subscription/UsageCard.jsx
import React from "react";
import { AlertCircle } from "lucide-react";

export default function UsageCard({
  icon: Icon,
  title,
  used,
  limit,
  unit,
  decimals = 0,
  isUnlimited = false,
  percentage = 0,
  hidePercent = false,
}) {
  const displayUsed = decimals ? used.toFixed(decimals) : used;
  const displayLimit = decimals && limit ? limit.toFixed(decimals) : limit;
  const isWarning = percentage > 80;
  const isCritical = percentage > 95;

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <div className="text-3xl font-bold text-white mt-2">
            {displayUsed}
            {!hidePercent && <span className="text-lg text-gray-400 ml-1">{unit}</span>}
          </div>
        </div>
        <div className="relative">
          <Icon
            className={`w-8 h-8 ${
              isCritical
                ? "text-red-400"
                : isWarning
                ? "text-yellow-400"
                : "text-cyan-400"
            }`}
          />
        </div>
      </div>

      {!hidePercent && (
        <>
          <p className="text-gray-400 text-sm mb-2">
            {isUnlimited ? (
              <span>Unlimited</span>
            ) : (
              <>
                {((percentage).toFixed(1))}% of {displayLimit} {unit}
              </>
            )}
          </p>

          {!isUnlimited && (
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isCritical
                    ? "bg-red-500"
                    : isWarning
                    ? "bg-yellow-500"
                    : "bg-cyan-500"
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              ></div>
            </div>
          )}

          {isCritical && !isUnlimited && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>Nearing limit - consider upgrading</span>
            </div>
          )}
        </>
      )}

      {hidePercent && limit && (
        <p className="text-gray-400 text-sm">
          Limit: {displayLimit} {unit}
        </p>
      )}
    </div>
  );
}
