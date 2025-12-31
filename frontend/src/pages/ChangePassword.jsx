// src/pages/ChangePassword.jsx
import React, { useState } from "react";
import { putJSON } from "../api/api";

export default function ChangePassword() {
  const [form, setForm] = useState({
    old_password: "",
    new_password: "",
    new_password2: "",
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (form.new_password.length < 8) {
      setErr("New password must be at least 8 characters.");
      return;
    }
    if (form.new_password !== form.new_password2) {
      setErr("New passwords do not match.");
      return;
    }
    if (!form.old_password) {
      setErr("Old password is required.");
      return;
    }

    setLoading(true);
    const res = await putJSON("/auth/change-password/", {
      old_password: form.old_password,
      new_password: form.new_password,
    });
    setLoading(false);

    if (res?.detail) {
      setMsg(res.detail);
      setForm({
        old_password: "",
        new_password: "",
        new_password2: "",
      });
    } else {
      setErr("Failed to change password. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-slate-800 px-4 py-10">
      <div className="max-w-md mx-auto card">
        <h2 className="text-2xl font-bold mb-6 text-white">
          Change Password
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            required
            type="password"
            name="old_password"
            value={form.old_password}
            onChange={onChange}
            placeholder="Current password"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
          />

          <input
            required
            type="password"
            name="new_password"
            value={form.new_password}
            onChange={onChange}
            placeholder="New password"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
          />

          <input
            required
            type="password"
            name="new_password2"
            value={form.new_password2}
            onChange={onChange}
            placeholder="Confirm new password"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
          />

          <button
            className="btn-primary w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Updating..." : "Change password"}
          </button>
        </form>

        {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
        {msg && <p className="mt-4 text-sm text-green-400">{msg}</p>}
      </div>
    </div>
  );
}
