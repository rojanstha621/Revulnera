// src/components/subscription/SubscriptionCard.jsx
import React from "react";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react";

export default function SubscriptionCard({ subscription }) {
  const plan = subscription.plan;
  const statusColor = {
    active: {
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      text: "text-green-400",
      icon: CheckCircle,
    },
    expired: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-400",
      icon: AlertCircle,
    },
    canceled: {
      bg: "bg-gray-500/10",
      border: "border-gray-500/30",
      text: "text-gray-400",
      icon: Clock,
    },
    suspended: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      text: "text-yellow-400",
      icon: AlertCircle,
    },
  };

  const status = statusColor[subscription.status] || statusColor.canceled;
  const StatusIcon = status.icon;

  return (
    <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 rounded-lg p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Plan Info */}
        <div className="lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                {plan.display_name}
              </h2>
              <p className="text-gray-400">{plan.description}</p>
            </div>
            <Zap className="w-8 h-8 text-cyan-400 flex-shrink-0" />
          </div>

          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${status.bg} border ${status.border} ${status.text}`}>
            <StatusIcon className="w-4 h-4" />
            <span className="font-medium capitalize">{subscription.status}</span>
          </div>
        </div>

        {/* Price */}
        <div className="flex flex-col items-start lg:items-end justify-center">
          <div className="text-5xl font-bold text-cyan-400">
            {plan.price_per_month_display}
          </div>
          {plan.price_per_month > 0 && (
            <div className="text-gray-400 mt-2">per month</div>
          )}
          {plan.price_per_month === 0 && (
            <div className="text-gray-400 text-sm mt-2">Forever free</div>
          )}
        </div>
      </div>
    </div>
  );
}
