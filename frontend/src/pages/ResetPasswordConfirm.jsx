// src/pages/ResetPasswordConfirm.jsx
import React, { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { postJSON } from "../api/api";

export default function ResetPasswordConfirm() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!token) {
      setErr("Invalid or missing reset token.");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await postJSON("/auth/password-reset/confirm/", {
      token,
      password,
    });
    setLoading(false);

    if (res?.detail) {
      setMsg(res.detail);
      setTimeout(() => nav("/auth/login"), 2000);
    } else {
      setErr("Password reset failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-slate-900 to-slate-800 px-4">
      <div className="card w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-white">
          Reset password
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            required
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
          />

          <input
            required
            type="password"
            placeholder="Confirm new password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
          />

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>

        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        {msg && <p className="mt-3 text-sm text-green-400">{msg}</p>}

        <p className="mt-4 text-xs text-slate-300">
          <Link to="/auth/login" className="text-purple-400 underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
