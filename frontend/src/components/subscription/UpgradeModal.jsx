// src/components/subscription/UpgradeModal.jsx
import React, { useState } from "react";
import { AlertCircle, Check, X, Loader } from "lucide-react";
import { upgradSubscription } from "../../api/api";
import { useToast } from "../../context/ToastContext";

export default function UpgradeModal({
  plan,
  currentPlan,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const toast = useToast();

  if (!isOpen || !plan) return null;

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const response = await upgradSubscription(plan.id, reason);

      if (response.detail) {
        toast.success(response.detail);
        onSuccess?.();
        onClose();
      } else if (response._status) {
        toast.error(response.detail || "Failed to upgrade subscription");
      }
    } catch (err) {
      console.error("Error upgrading subscription:", err);
      toast.error("Error upgrading subscription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isUpgrade =
    currentPlan &&
    plan.price_per_month > currentPlan.plan.price_per_month;
  const isDowngrade =
    currentPlan &&
    plan.price_per_month < currentPlan.plan.price_per_month;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full space-y-6">
        {/* Header */}
        <div className="px-6 pt-6 space-y-2">
          <h2 className="text-2xl font-bold text-white">
            {plan.name === "free"
              ? "Switch to Free"
              : isUpgrade
              ? "Upgrade Plan"
              : "Downgrade Plan"}
          </h2>
          <p className="text-gray-400 text-sm">
            You're switching to the <span className="font-bold">{plan.display_name}</span> plan
          </p>
        </div>

        {/* Comparison */}
        <div className="px-6 bg-gray-800/50 py-4 rounded-lg space-y-3">
          <div className="text-sm">
            <p className="text-gray-400 mb-2">Plan Changes:</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Monthly Price</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 line-through">
                    {currentPlan?.plan.price_per_month_display || "$0.00"}
                  </span>
                  <span className="text-cyan-400 font-bold">
                    {plan.price_per_month_display}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Scans/Month</span>
                <span className="text-cyan-400 font-bold">
                  {plan.max_scans_per_month === null
                    ? "Unlimited"
                    : plan.max_scans_per_month}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Storage</span>
                <span className="text-cyan-400 font-bold">
                  {plan.max_storage_gb} GB
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Concurrent Scans</span>
                <span className="text-cyan-400 font-bold">
                  {plan.max_concurrent_scans}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Highlight */}
        <div className="px-6 space-y-3">
          <p className="text-sm text-gray-400 font-medium">New Features:</p>
          {plan.advanced_reporting && (
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-gray-300">Advanced Reporting</span>
            </div>
          )}
          {plan.custom_integrations && (
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-gray-300">Custom Integrations</span>
            </div>
          )}
          {plan.dedicated_account_manager && (
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-gray-300">Dedicated Account Manager</span>
            </div>
          )}
          {!plan.advanced_reporting &&
            !plan.custom_integrations &&
            !plan.dedicated_account_manager && (
              <p className="text-gray-500 text-sm italic">
                No additional features
              </p>
            )}
        </div>

        {/* Warning for downgrade */}
        {isDowngrade && (
          <div className="px-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-300 font-medium">
                Downgrading your plan
              </p>
              <p className="text-xs text-yellow-200 mt-1">
                You may lose access to premium features. Your data will be preserved.
              </p>
            </div>
          </div>
        )}

        {/* Reason Field */}
        <div className="px-6">
          <label className="block text-sm text-gray-400 mb-2">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us why you're changing plans..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:border-cyan-500 focus:outline-none resize-none"
            rows="3"
          />
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              plan.name === "free"
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "bg-cyan-600 text-white hover:bg-cyan-500"
            }`}
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirm
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
