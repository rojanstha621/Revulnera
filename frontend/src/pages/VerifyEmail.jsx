// src/pages/VerifyEmail.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { getJSON } from "../api/api"; // if you don't have getJSON, tell me and I'll adapt to postJSON

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Missing verification token.");
        return;
      }

      const res = await getJSON(`/auth/verify/?token=${encodeURIComponent(token)}`);

      if (res?.detail && String(res.detail).toLowerCase().includes("verified")) {
        setStatus("success");
        setMessage(res.detail);
        return;
      }

      if (res?.detail) {
        setStatus("error");
        setMessage(res.detail);
        return;
      }

      setStatus("error");
      setMessage("Verification failed. Please try again.");
    };

    run();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-slate-900 to-slate-800 px-4">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-white">Email verification</h2>

        {status === "verifying" && (
          <p className="text-sm text-slate-300">Verifying your account...</p>
        )}

        {status === "success" && (
          <>
            <p className="mt-3 text-sm text-green-400">{message}</p>
            <button
              className="btn-primary w-full mt-4"
              onClick={() => nav("/auth/login")}
            >
              Go to login
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <p className="mt-3 text-sm text-red-400">{message}</p>
            <p className="mt-4 text-xs text-slate-300">
              You can{" "}
              <Link to="/auth/login" className="text-purple-400 underline">
                sign in
              </Link>{" "}
              or resend verification from the login page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
