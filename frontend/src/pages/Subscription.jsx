// src/pages/Subscription.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  TrendingUp,
  HardDrive,
  Wifi,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
} from "lucide-react";
import { getUserSubscription, getSubscriptionHistory } from "../api/api";
import LoadingScreen from "../components/LoadingScreen";
import SubscriptionCard from "../components/subscription/SubscriptionCard";
import UsageCard from "../components/subscription/UsageCard";
import HistoryTimeline from "../components/subscription/HistoryTimeline";
import { emitErrorToast } from "../utils/errorUtils";

export default function Subscription() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (error) {
      emitErrorToast(error);
    }
  }, [error]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [subData, historyData] = await Promise.all([
          getUserSubscription(),
          getSubscriptionHistory(),
        ]);

        if (subData) {
          setSubscription(subData);
        } else {
          setError("Failed to load subscription data");
        }

        if (historyData && Array.isArray(historyData)) {
          setHistory(historyData);
        }
      } catch (err) {
        console.error("Error loading subscription:", err);
        setError("Failed to load subscription information");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error || "Unable to load subscription information"}
        </div>
        <button
          onClick={() => navigate("/plans")}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
        >
          View Plans
        </button>
      </div>
    );
  }

  const plan = subscription.plan;
  const usage = subscription.usage;
  const statusColor = {
    active: "text-green-400",
    expired: "text-red-400",
    canceled: "text-gray-400",
    suspended: "text-yellow-400",
  };

  const getUsagePercentage = (used, limit) => {
    if (!limit) return 0;
    return (used / limit) * 100;
  };

  const scanUsagePercent = plan.max_scans_per_month
    ? getUsagePercentage(usage.scans_used_this_month, plan.max_scans_per_month)
    : 0;

  const storageUsagePercent = getUsagePercentage(
    usage.current_storage_used_gb,
    plan.max_storage_gb
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-5xl font-bold text-cyan-300 tracking-tight">
          Subscription Management
        </h1>
        <p className="text-gray-400 text-lg">
          Manage your plan, usage, and subscription settings
        </p>
      </div>

      {/* Current Plan Card */}
      <SubscriptionCard subscription={subscription} />

      {/* Usage Stats Grid */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Usage Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scans Used */}
          <UsageCard
            icon={Zap}
            title="Scans Used"
            used={usage.scans_used_this_month}
            limit={plan.max_scans_per_month}
            unit="scans"
            isUnlimited={plan.max_scans_per_month === null}
            percentage={scanUsagePercent}
          />

          {/* Storage Used */}
          <UsageCard
            icon={HardDrive}
            title="Storage Used"
            used={usage.current_storage_used_gb}
            limit={plan.max_storage_gb}
            unit="GB"
            decimals={2}
            percentage={storageUsagePercent}
          />

          {/* API Calls Today */}
          <UsageCard
            icon={Wifi}
            title="API Calls Today"
            used={usage.api_calls_today}
            limit={plan.api_rate_limit_per_minute}
            unit="calls/min"
            hidePercent={true}
          />
        </div>
      </div>

      {/* Usage Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scans Details */}
        {plan.max_scans_per_month && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Monthly Scans
              </h3>
              <span className="text-2xl font-bold text-cyan-400">
                {usage.scans_remaining}/{plan.max_scans_per_month}
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-3">
              {usage.scans_remaining} scans remaining this period
            </p>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  scanUsagePercent > 80 ? "bg-red-500" : "bg-cyan-500"
                }`}
                style={{ width: `${Math.min(scanUsagePercent, 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Storage Details */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-blue-400" />
              Storage Quota
            </h3>
            <span className="text-2xl font-bold text-cyan-400">
              {usage.current_storage_used_gb.toFixed(2)}/{plan.max_storage_gb}{" "}
              GB
            </span>
          </div>
          <p className="text-gray-400 text-sm mb-3">
            {(plan.max_storage_gb - usage.current_storage_used_gb).toFixed(2)}{" "}
            GB remaining
          </p>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                storageUsagePercent > 80 ? "bg-red-500" : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(storageUsagePercent, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Billing Period */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-purple-400" />
            Billing Period
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-gray-400 text-sm">Start Date</p>
              <p className="text-white font-medium">
                {new Date(subscription.current_period_start).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">End Date</p>
              <p className="text-white font-medium">
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Days Remaining</p>
              <p className="text-cyan-400 font-bold text-lg">
                {subscription.days_remaining} days
              </p>
            </div>
          </div>
        </div>

        {/* Auto Renewal */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-green-400" />
            Auto Renewal
          </h3>
          <div className="space-y-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${
                subscription.auto_renew
                  ? "bg-green-500/20 text-green-400"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {subscription.auto_renew ? "Enabled" : "Disabled"}
            </div>
            <p className="text-gray-400 text-sm">
              {subscription.auto_renew
                ? "Your subscription will automatically renew at the end of the billing period."
                : "Your subscription is set to expire. You can upgrade or renew it anytime."}
            </p>
          </div>
        </div>
      </div>

      {/* Plan Compute Profile */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Plan Compute Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">{plan.max_concurrent_scans} concurrent scans</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">{plan.worker_count ?? 1} worker cores</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">Queue priority {plan.scan_queue_priority ?? 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">Full OWASP scanner included on all tiers</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate("/plans")}
          className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 font-medium transition-colors flex items-center gap-2"
        >
          <TrendingUp className="w-5 h-5" />
          View All Plans
        </button>
      </div>

      {/* History Section */}
      {history.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Subscription History
          </h2>
          <HistoryTimeline history={history} />
        </div>
      )}
    </div>
  );
}
