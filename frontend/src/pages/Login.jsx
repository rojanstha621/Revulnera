// src/pages/Login.jsx
import React, { useState, useContext, useEffect } from "react";
import { postJSON } from "../api/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";

export default function Login() {
  const { login, isAuthenticated } = useContext(AuthContext);
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      nav("/");
    }
  }, [isAuthenticated, nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);

    if (!form.email.includes("@")) {
      setErr("Please enter a valid email address.");
      return;
    }
    if (form.password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const res = await postJSON("/auth/login/", form);
    setLoading(false);

    if (res.access && res.refresh) {
      login(res);
      const redirectTo = location.state?.from?.pathname || "/dashboard";
      nav(redirectTo, { replace: true });
    } else {
      setErr(res.detail || "Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-slate-900 to-slate-800 px-4">
      <div className="card w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-white">Sign in</h2>
        <p className="text-sm text-slate-300 mb-4">
          Enter your credentials to access your Revulnera dashboard.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            required
            name="email"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value.trim() }))
            }
            placeholder="Email"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            required
            type="password"
            name="password"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            placeholder="Password"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            className="btn-primary w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

        <p className="mt-4 text-xs text-slate-300">
          Don&apos;t have an account?{" "}
          <Link to="/auth/register" className="text-purple-400 underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
