// src/components/subscription/SubscriptionWidget.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap, ChevronRight, AlertCircle, TrendingUp } from "lucide-react";
import { getUserSubscription } from "../../api/api";

export default function SubscriptionWidget() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const data = await getUserSubscription();
        if (data) {
          setSubscription(data);
        }
      } catch (err) {
        console.error("Error loading subscription:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSubscription();
  }, []);

  if (loading || !subscription) {
    return null;
  }

  const plan = subscription.plan;
  const usage = subscription.usage;
  const scanPercent = plan.max_scans_per_month
    ? (usage.scans_used_this_month / plan.max_scans_per_month) * 100
    : 0;

  return (
    <Link
      to="/subscription"
      className="block bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 rounded-lg p-6 hover:border-cyan-400/50 transition-colors"
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-cyan-400" />
            <div>
              <p className="text-gray-400 text-sm font-medium">Current Plan</p>
              <h3 className="text-xl font-bold text-white">
                {plan.display_name}
              </h3>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>

        {/* Usage Bar */}
        {plan.max_scans_per_month && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Monthly Scans</span>
              <span className="text-cyan-400 text-sm font-bold">
                {usage.scans_used_this_month}/{plan.max_scans_per_month}
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  scanPercent > 80 ? "bg-red-500" : "bg-cyan-500"
                }`}
                style={{ width: `${Math.min(scanPercent, 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between pt-2 border-t border-cyan-500/20">
          <span className="text-gray-400 text-sm">
            {subscription.days_remaining} days remaining
          </span>
          {scanPercent > 80 && (
            <div className="flex items-center gap-1 text-yellow-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              Nearing limit
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
