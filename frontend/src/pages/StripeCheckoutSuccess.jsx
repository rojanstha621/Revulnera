// src/pages/StripeCheckoutSuccess.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader, XCircle } from "lucide-react";
import { verifyStripeCheckoutSession } from "../api/api";
import { emitErrorToast } from "../utils/errorUtils";

export default function StripeCheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState("verifying");
  const [message, setMessage] = useState("Verifying your payment with Stripe...");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      const errorMessage = "Missing Stripe checkout session id.";
      setState("error");
      setMessage(errorMessage);
      emitErrorToast(errorMessage);
      return;
    }

    const verifySession = async () => {
      try {
        const response = await verifyStripeCheckoutSession(sessionId);
        if (response?._status) {
          const errorMessage = response.detail || "Stripe payment verification failed.";
          setState("error");
          setMessage(errorMessage);
          emitErrorToast(errorMessage);
          return;
        }

        setState("success");
        setMessage(response.detail || "Payment verified successfully.");
        setTimeout(() => {
          navigate("/subscription", { replace: true });
        }, 1800);
      } catch (error) {
        console.error("Stripe checkout verification failed:", error);
        const errorMessage = "Stripe payment verification failed.";
        setState("error");
        setMessage(errorMessage);
        emitErrorToast(errorMessage);
      }
    };

    verifySession();
  }, [navigate, searchParams]);

  return (
    <div className="max-w-2xl mx-auto py-20 px-4">
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 p-8 shadow-2xl shadow-cyan-950/30">
        <div className="flex items-start gap-4">
          <div className="mt-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 p-3 text-cyan-300">
            {state === "success" ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : state === "error" ? (
              <XCircle className="h-8 w-8" />
            ) : (
              <Loader className="h-8 w-8 animate-spin" />
            )}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Stripe checkout</h1>
            <p className="text-gray-300">{message}</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
          {state === "success"
            ? "The backend confirmed payment and activated your subscription. You will be redirected shortly."
            : state === "error"
            ? "The payment was not finalized. You can return to the plans page and try again."
            : "Do not close this tab while verification is in progress."}
        </div>
      </div>
    </div>
  );
}
