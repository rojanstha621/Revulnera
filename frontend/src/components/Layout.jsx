// src/components/Layout.jsx
import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Navbar from "./Navbar";
import AdminNavbar from "./AdminNavbar";
import Footer from "./Footer";

export default function Layout({ children }) {
  const { auth } = useContext(AuthContext);
  const isAdmin =
    auth?.user?.role === "admin" ||
    auth?.user?.is_staff === true ||
    auth?.user?.is_superuser === true;
  const needsVulnerabilityVerification =
    !!auth?.access && !isAdmin && auth?.user?.can_run_vulnerability_scans !== true;
  const [kycStatus, setKycStatus] = useState(null);

  useEffect(() => {
    if (!needsVulnerabilityVerification || auth?.user?.email_verified === false) {
      setKycStatus(null);
      return;
    }

    const cacheKey = `kyc_status_${auth?.user?.email || "unknown"}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.status) {
          setKycStatus(parsed.status);
          return;
        }
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    setKycStatus(null);
  }, [needsVulnerabilityVerification, auth?.user?.email_verified, auth?.user?.email]);

  useEffect(() => {
    if (!auth?.access) {
      setKycStatus(null);
      return;
    }

    const onStorageChange = () => {
      if (!needsVulnerabilityVerification || auth?.user?.email_verified === false) {
        setKycStatus(null);
        return;
      }

      const cacheKey = `kyc_status_${auth?.user?.email || "unknown"}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.status) {
            setKycStatus(parsed.status);
            return;
          }
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }
    };

    window.addEventListener("focus", onStorageChange);

    return () => {
      window.removeEventListener("focus", onStorageChange);
    };
  }, [auth?.access, needsVulnerabilityVerification, auth?.user?.email_verified, auth?.user?.email]);

  const verificationTarget =
    kycStatus === "PENDING"
      ? "/account-verification#status"
      : "/account-verification#submit";
  const shouldShowVerificationBanner =
    needsVulnerabilityVerification &&
    !(auth?.user?.email_verified !== false && kycStatus === "APPROVED");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {isAdmin ? <AdminNavbar /> : <Navbar />}
      {shouldShowVerificationBanner && (
        <div className="mx-4 md:mx-8 mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-yellow-200">
            {auth?.user?.email_verified === false
              ? "Please verify your email first, then submit KYC documents to unlock Vulnerability Detection."
              : "You can use reconnaissance now. Vulnerability Detection will unlock after manual KYC review. Submit your documents if you have not done so."}
          </p>
          <Link
            to={verificationTarget}
            className="inline-flex w-fit items-center rounded-md border border-yellow-300/50 px-3 py-1.5 text-xs font-semibold text-yellow-100 hover:bg-yellow-400/10"
          >
            Open Verification
          </Link>
        </div>
      )}
      <main className="flex-1 px-4 md:px-8 py-6">{children}</main>
      <Footer />
    </div>
  );
}
