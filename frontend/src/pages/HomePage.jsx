// src/pages/HomePage.jsx
import React, { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function HomePage() {
  const { auth, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const isAdmin =
    auth?.user?.role === "admin" ||
    auth?.user?.is_staff === true ||
    auth?.user?.is_superuser === true;

  useEffect(() => {
    // If admin, redirect to admin dashboard
    if (isAdmin) {
      navigate("/admin", { replace: true });
    }
    // If authenticated regular user, redirect to user dashboard
    else if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, isAuthenticated, navigate]);

  // If not authenticated, show landing page
  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center py-16 space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold text-cyan-300 tracking-tight">
            Revulnera
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Advanced vulnerability reconnaissance and assessment platform
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <a
              href="/auth/login"
              className="px-8 py-3 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-lg font-semibold transition"
            >
              Login
            </a>
            <a
              href="/auth/register"
              className="px-8 py-3 border border-slate-600 text-slate-200 hover:bg-slate-900 rounded-lg font-semibold transition"
            >
              Register
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12">
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-cyan-300 mb-3">Reconnaissance</h3>
            <p className="text-gray-400">
              Comprehensive subdomain discovery and enumeration with IP resolution and alive status detection.
            </p>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-cyan-300 mb-3">Endpoint Discovery</h3>
            <p className="text-gray-400">
              Identify and analyze web endpoints with HTTP status codes, headers, and security fingerprints.
            </p>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-cyan-300 mb-3">Analysis</h3>
            <p className="text-gray-400">
              Deep insights with detailed scan reports, trending analysis, and actionable recommendations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated regular user, loading while redirecting
  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }
}
