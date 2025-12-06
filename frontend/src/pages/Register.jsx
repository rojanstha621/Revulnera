// src/pages/Register.jsx
import React, { useState, useContext, useEffect } from "react";
import { postJSON } from "../api/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    password2: "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useContext(AuthContext);
  const nav = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      nav("/");
    }
  }, [isAuthenticated, nav]);

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!form.email.includes("@")) {
      setErr("Please enter a valid email address.");
      return;
    }
    if (form.password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.password2) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    const payload = {
      email: form.email.trim(),
      password: form.password,
      full_name: form.full_name.trim(),
    };
    const res = await postJSON("/auth/register/", payload);
    setLoading(false);

    if (res.email || res.id || res.success) {
      setMsg(
        "Registration successful. Check your email to verify your account."
      );
      setForm({
        email: "",
        password: "",
        full_name: "",
        password2: "",
      });
    } else if (res.detail) {
      setErr(res.detail);
    } else {
      setErr("Registration error. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-slate-900 to-slate-800 px-4">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-white">
          Create an account
        </h2>
        <p className="text-sm text-slate-300 mb-4">
          Sign up to start running scans and reviewing reports.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            required
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="Email"
            type="email"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            required
            name="full_name"
            value={form.full_name}
            onChange={onChange}
            placeholder="Full name"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            required
            name="password"
            value={form.password}
            onChange={onChange}
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            required
            name="password2"
            value={form.password2}
            onChange={onChange}
            type="password"
            placeholder="Confirm password"
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            className="btn-primary w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
        {msg && <p className="mt-4 text-sm text-green-400">{msg}</p>}

        <p className="mt-4 text-xs text-slate-300">
          Already have an account?{" "}
          <Link to="/auth/login" className="text-purple-400 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
