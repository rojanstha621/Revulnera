// src/pages/Login.jsx
import React, { useState, useContext, useEffect } from "react";
import { postJSON } from "../api/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";

export default function Login() {
  const { login, isAuthenticated } = useContext(AuthContext);
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) nav("/");
  }, [isAuthenticated, nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);

    if (!form.email.includes("@")) {
      setErr("Please enter a valid email address.");
      return;
    }
    if (form.password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await postJSON("/auth/login/", {
      email: form.email.trim(),
      password: form.password,
    });
    setLoading(false);

    if (res?.access && res?.refresh) {
      login(res);
      const redirectTo = location.state?.from?.pathname || "/dashboard";
      nav(redirectTo, { replace: true });
      return;
    }

    const msg = res?.detail || "Login failed. Please try again.";
    setErr(msg);
  };

  const resendVerification = async () => {
    setErr(null);
    setInfo(null);

    const email = form.email.trim();
    if (!email || !email.includes("@")) {
      setErr("Enter your email first to resend verification.");
      return;
    }

    setResending(true);
    const res = await postJSON("/auth/resend-verify/", { email });
    setResending(false);

    if (res?.detail) {
      // backend returns {detail: "..."}
      setInfo(res.detail);
    } else {
      setInfo("Verification email sent. Please check your inbox.");
    }
  };

  const showResend =
    typeof err === "string" &&
    err.toLowerCase().includes("not verified");

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
              setForm((f) => ({ ...f, email: e.target.value }))
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
        {info && <p className="mt-3 text-sm text-green-400">{info}</p>}

        {showResend && (
          <button
            type="button"
            onClick={resendVerification}
            disabled={resending}
            className="mt-3 w-full p-3 rounded-xl border border-white/10 text-white bg-white/5 hover:bg-white/10"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
          <Link to="/auth/register" className="text-purple-400 underline">
            Create account
          </Link>
          <Link to="/auth/forgot-password" className="text-purple-400 underline">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
