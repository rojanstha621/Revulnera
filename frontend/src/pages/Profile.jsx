// src/pages/Profile.jsx
import React, { useEffect, useState, useContext } from "react";
import { User, Mail, Phone, MapPin, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { getJSON, putJSON } from "../api/api";

export default function Profile() {
  const { auth } = useContext(AuthContext);
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
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 animate-fade-in">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-purple-500"></div>
        <p className="text-gray-400">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="space-y-3 animate-slide-up">
        <h1 className="text-4xl font-bold text-gradient">Profile Settings</h1>
        <p className="text-gray-400">Manage your account information and preferences</p>
      </div>

      {/* Profile Card */}
      <div className="card card-hover animate-slide-up">
        {/* User Info Card */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Account Status</p>
                <p className="text-2xl font-bold text-white">{auth?.user?.full_name || "User"}</p>
                <p className="text-sm text-purple-300 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-4 h-4" />
                  Active
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {err && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{err}</p>
          </div>
        )}
        {msg && (
          <div className="mb-6 bg-green-500/20 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-green-300 text-sm">{msg}</p>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Full Name */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Full Name
            </label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={onChange}
              placeholder="Your full name"
              className="input-premium w-full"
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address
            </label>
            <input
              type="email"
              value={auth?.user?.email || ""}
              disabled
              className="input-premium w-full opacity-60 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number
            </label>
            <input
              name="phone"
              value={form.phone}
              onChange={onChange}
              placeholder="Your phone number"
              className="input-premium w-full"
            />
          </div>

          {/* Address */}
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Address
            </label>
            <textarea
              name="address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Your address"
              className="input-premium w-full h-24 resize-none"
            />
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-4 font-bold text-lg flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                Saving Changes...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Save Profile Changes
              </>
            )}
          </button>
        </form>

        {/* Password Change Link */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <p className="text-gray-400 text-sm mb-4">Want to change your password?</p>
          <a
            href="/change-password"
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Lock className="w-5 h-5" />
            Change Password
          </a>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
        <div className="card bg-blue-500/10 border-blue-500/30">
          <Mail className="w-6 h-6 text-blue-400 mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Verified Account</h3>
          <p className="text-gray-400 text-sm">Your account is active and ready to use</p>
        </div>
        <div className="card bg-purple-500/10 border-purple-500/30">
          <CheckCircle className="w-6 h-6 text-purple-400 mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Two-Factor Ready</h3>
          <p className="text-gray-400 text-sm">Enhanced security options available</p>
        </div>
      </div>
    </div>
  );
}
