// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { getJSON, putJSON } from "../api/api";

export default function Profile() {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const res = await getJSON("/auth/me/");
      if (res?.email) {
        setForm({
          full_name: res.full_name || "",
          phone: res.profile?.phone || "",
          address: res.profile?.address || "",
        });
      } else {
        setErr("Failed to load profile.");
      }
      setLoading(false);
    };
    loadProfile();
  }, []);

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    setSaving(true);
    const res = await putJSON("/auth/me/", {
      full_name: form.full_name,
      profile: {
        phone: form.phone,
        address: form.address,
      },
    });
    setSaving(false);

    if (res?.email) {
      setMsg("Profile updated successfully.");
    } else {
      setErr(res?.detail || "Failed to update profile.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-slate-800 px-4 py-10">
      <div className="max-w-xl mx-auto card">
        <h2 className="text-2xl font-bold mb-6 text-white">
          My Profile
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            name="full_name"
            value={form.full_name}
            onChange={onChange}
            placeholder="Full name"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
          />

          <input
            name="phone"
            value={form.phone}
            onChange={onChange}
            placeholder="Phone"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
          />

          <input
            name="address"
            value={form.address}
            onChange={onChange}
            placeholder="Address"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
          />

          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>

                <p className="mt-6 text-sm text-slate-300">
        Want to update your password?{" "}
        <a href="/change-password" className="text-purple-400 underline">
            Change password
        </a>
        </p>

        {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
        {msg && <p className="mt-4 text-sm text-green-400">{msg}</p>}
      </div>
    </div>
  );
}
