// src/pages/Plans.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { getSubscriptionPlans, getUserSubscription } from "../api/api";
import LoadingScreen from "../components/LoadingScreen";
import UpgradeModal from "../components/subscription/UpgradeModal";
import { emitErrorToast } from "../utils/errorUtils";

const FALLBACK_PLANS = [
  {
    id: "fallback-free",
    name: "free",
    display_name: "FREE",
    description: "Full scanner access with limited compute power.",
    price_per_month: 0,
    max_scans_per_month: 20,
    max_concurrent_scans: 1,
    worker_count: 1,
    max_storage_gb: 2,
    api_rate_limit_per_minute: 20,
    support_level: "email",
    advanced_reporting: true,
    custom_integrations: true,
    dedicated_account_manager: true,
    full_owasp_top10: true,
    full_export: true,
    api_access: true,
  },
  {
    id: "fallback-pro",
    name: "pro",
    display_name: "PRO",
    description: "Full scanner access with medium compute pool and faster scan throughput.",
    price_per_month: 2900,
    max_scans_per_month: 200,
    max_concurrent_scans: 3,
    worker_count: 4,
    max_storage_gb: 100,
    api_rate_limit_per_minute: 300,
    support_level: "priority",
    advanced_reporting: true,
    custom_integrations: true,
    dedicated_account_manager: true,
    full_owasp_top10: true,
    full_export: true,
    api_access: true,
  },
  {
    id: "fallback-plus",
    name: "plus",
    display_name: "PLUS",
    description: "Full scanner access with highest compute power and queue priority.",
    price_per_month: 9900,
    max_scans_per_month: null,
    max_concurrent_scans: 10,
    worker_count: 10,
    max_storage_gb: 1000,
    api_rate_limit_per_minute: 2000,
    support_level: "24/7",
    advanced_reporting: true,
    custom_integrations: true,
    dedicated_account_manager: true,
    full_owasp_top10: true,
    full_export: true,
    api_access: true,
  },
];

export default function Plans() {
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    if (error) {
      emitErrorToast(error);
    }
  }, [error]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const plansData = await getSubscriptionPlans();

        if (plansData && Array.isArray(plansData) && plansData.length > 0) {
          setPlans(plansData);
        } else {
          setPlans(FALLBACK_PLANS);
        }

        if (auth?.access) {
          const subData = await getUserSubscription();
          if (subData && subData.plan) {
            setCurrentSubscription(subData);
          }
        }
      } catch (err) {
        console.error("Error loading plans:", err);
        setError("Failed to load subscription plans");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [auth?.access]);

  const handleUpgradeClick = (plan) => {
    if (!auth?.user) {
      navigate("/auth/login");
      return;
    }
    setSelectedPlan(plan);
    setShowUpgradeModal(true);
  };

  const handleUpgradeSuccess = () => {
    setShowUpgradeModal(false);
    // Reload subscription data
    getUserSubscription().then(setCurrentSubscription);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const isCurrentPlan = (planName) => {
    return currentSubscription?.plan?.name === planName;
  };

  const orderedPlans = [...plans].sort((a, b) => a.price_per_month - b.price_per_month);

  const getPriceLabel = (plan) => {
    if (plan.price_per_month === 0) return "$0";
    return `$${(plan.price_per_month / 100).toFixed(0)}`;
  };

  const getFeaturedPlan = (planName) => planName === "plus";

  const findPlan = (planName) => orderedPlans.find((p) => p.name === planName);
  const freePlan = findPlan("free");
  const proPlan = findPlan("pro");
  const plusPlan = findPlan("plus");

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-white">Plans</h1>
        <p className="text-gray-400 text-sm mt-1">
          All plans include the full OWASP scanner. Tiers differ only in compute capacity.
        </p>
      </div>

      {error && (
        <div className="border border-red-800 bg-red-950/40 rounded p-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {currentSubscription && (
        <div className="border border-gray-700 rounded p-4 flex items-center justify-between bg-gray-900">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Active plan</p>
            <p className="text-white font-medium mt-0.5">
              {currentSubscription.plan?.display_name || "Free"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">
              {currentSubscription.days_remaining ?? 0} days left
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {currentSubscription.status === "active" ? "Active" : currentSubscription.status}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {orderedPlans.map((plan) => {
          const current = isCurrentPlan(plan.name);
          const featured = getFeaturedPlan(plan.name);
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col border rounded p-5 ${
                featured
                  ? "border-white/20 bg-gray-800"
                  : current
                  ? "border-gray-500 bg-gray-900"
                  : "border-gray-800 bg-gray-900"
              }`}
            >
              {current && (
                <span className="absolute top-3 right-3 text-[10px] font-medium text-gray-400 border border-gray-700 rounded px-2 py-0.5 uppercase tracking-wide">
                  Current
                </span>
              )}

              <div className="mb-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{plan.name}</p>
                <h2 className="text-xl font-semibold text-white">{plan.display_name}</h2>
                <p className="text-gray-400 text-xs mt-1">{plan.description}</p>
              </div>

              <div className="mb-5">
                <span className="text-3xl font-semibold text-white">{getPriceLabel(plan)}</span>
                {plan.price_per_month > 0 && (
                  <span className="text-gray-500 text-xs ml-1">/ mo</span>
                )}
              </div>

              <ul className="space-y-2 text-sm text-gray-400 flex-1 mb-6">
                <li>
                  {plan.max_scans_per_month === null ? "Unlimited" : plan.max_scans_per_month} scans / month
                </li>
                <li>{plan.max_concurrent_scans} concurrent scans</li>
                <li>{plan.worker_count ?? 1} worker cores</li>
                <li>{plan.max_storage_gb} GB storage</li>
                <li>{plan.api_rate_limit_per_minute} API req / min</li>
                <li className="capitalize">{plan.support_level} support</li>
              </ul>

              <button
                onClick={() => !current && handleUpgradeClick(plan)}
                disabled={current}
                className={`w-full py-2 text-sm rounded border transition-colors ${
                  current
                    ? "border-gray-700 text-gray-600 cursor-not-allowed"
                    : featured
                    ? "border-white text-white hover:bg-white hover:text-gray-900"
                    : "border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white"
                }`}
              >
                {current
                  ? "Current plan"
                  : plan.name === "free"
                  ? "Switch to Free"
                  : `Upgrade to ${plan.display_name}`}
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-sm font-medium text-gray-300 mb-3">Tier comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-400 border-t border-gray-800">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="py-2.5 text-left font-normal text-gray-500 pr-8">Metric</th>
                <th className="py-2.5 text-left font-normal pr-8">Free</th>
                <th className="py-2.5 text-left font-normal pr-8">Pro</th>
                <th className="py-2.5 text-left font-normal">Plus</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Concurrent scans", freePlan?.max_concurrent_scans ?? 1, proPlan?.max_concurrent_scans ?? 3, plusPlan?.max_concurrent_scans ?? 10],
                ["Worker cores", freePlan?.worker_count ?? 1, proPlan?.worker_count ?? 4, plusPlan?.worker_count ?? 10],
                ["Queue priority", freePlan?.scan_queue_priority ?? 1, proPlan?.scan_queue_priority ?? 5, plusPlan?.scan_queue_priority ?? 10],
                ["OWASP Top 10", "Full", "Full", "Full"],
              ].map(([label, free, pro, plus]) => (
                <tr key={label} className="border-b border-gray-800/60">
                  <td className="py-2.5 pr-8 text-gray-500">{label}</td>
                  <td className="py-2.5 pr-8">{free}</td>
                  <td className="py-2.5 pr-8">{pro}</td>
                  <td className="py-2.5">{plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UpgradeModal
        plan={selectedPlan}
        currentPlan={currentSubscription}
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={handleUpgradeSuccess}
      />
    </div>
  );
}
