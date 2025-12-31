// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { postJSON } from "../api/api";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!email.includes("@")) {
      setErr("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    const res = await postJSON("/auth/password-reset/", {
      email: email.trim(),
    });
    setLoading(false);

    if (res?.detail) {
      // django_rest_passwordreset usually returns a detail message
      setMsg(res.detail);
    } else {
      setMsg(
        "If the email exists, a password reset link has been sent."
      );
    }

    setEmail("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-slate-900 to-slate-800 px-4">
      <div className="card w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-white">
          Forgot password
        </h2>

        <p className="text-sm text-slate-300 mb-4">
          Enter your email address and we’ll send you a password reset link.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-purple-500"
          />

          <button
            className="btn-primary w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        {msg && <p className="mt-3 text-sm text-green-400">{msg}</p>}

        <p className="mt-4 text-xs text-slate-300">
          Remembered your password?{" "}
          <Link to="/auth/login" className="text-purple-400 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
