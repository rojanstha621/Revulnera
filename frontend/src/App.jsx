// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ErrorBoundary from "./components/ErrorBoundary";
import usePageLoader from "./hooks/usePageLoader";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingScreen from "./components/LoadingScreen";

import Login from "./pages/Login";
import Register from "./pages/Register";
// import ScanCreate from "./pages/ScanCreate";
// import ScanLive from "./pages/ScanLive";
import HomePage from "./pages/HomePage";
import Dashboard from "./pages/Dashboard";
import Plans from "./pages/Plans";
import Subscription from "./pages/Subscription";
import Scanners from "./pages/Scanners";
import Reports from "./pages/Reports";
import AllScans from "./pages/AllScans";
import ScanDetail from "./pages/ScanDetail";
import NotFound from "./pages/NotFound";
import ForgotPassword from "./pages/ForgetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPasswordConfirm from "./pages/ResetPasswordConfirm";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";
import AccountVerification from "./pages/AccountVerification";
import VulnerabilityScans from "./pages/VulnerabilityScans";
import VulnerabilityScanDetail from "./pages/VulnerabilityScanDetail";
import DomainVerification from "./pages/DomainVerification";

// Admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminKYCQueue from "./pages/AdminKYCQueue";
import AdminKYCDetail from "./pages/AdminKYCDetail";
import AdminDomainProofQueue from "./pages/AdminDomainProofQueue";
import AdminDomainProofDetail from "./pages/AdminDomainProofDetail";
import AdminBugBountyScopes from "./pages/AdminBugBountyScopes";
import AdminScans from "./pages/AdminScans";
import AdminScanDetail from "./pages/AdminScanDetail";
import AdminAnalytics from "./pages/AdminAnalytics";

function AppContent() {
  const loading = usePageLoader();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Layout>
      <Routes>
        {/* Auth */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/reset-password" element={<ResetPasswordConfirm />} />
        <Route path="/auth/reset-password/:token" element={<ResetPasswordConfirm />} />


        {/* <Route path="/scan" element={<ScanCreate />} /> */}
        {/* <Route path="/scans/:scanId" element={<ScanLive />} /> */}

        {/* Home Page - Landing + Auto Redirect */}
        <Route path="/" element={<HomePage />} />

        {/* Protected pages */}

        <Route path="/change-password" element={<ChangePassword />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plans"
          element={<Plans />}
        />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <Subscription />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scanners"
          element={
            <ProtectedRoute>
              <Scanners />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scans"
          element={
            <ProtectedRoute>
              <AllScans />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scan/:scanId"
          element={
            <ProtectedRoute>
              <ScanDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vulnerability-scans"
          element={
            <ProtectedRoute>
              <VulnerabilityScans />
            </ProtectedRoute>
          }
        />
        <Route
          path="/domain-verification"
          element={
            <ProtectedRoute>
              <DomainVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vulnerability-scans/:scanId"
          element={
            <ProtectedRoute>
              <VulnerabilityScanDetail />
            </ProtectedRoute>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route
          path="/account-verification"
          element={
            <ProtectedRoute>
              <AccountVerification />
            </ProtectedRoute>
          }
        />

        {/* Admin pages */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute adminOnly>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:userId"
          element={
            <ProtectedRoute adminOnly>
              <AdminUserDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kyc"
          element={
            <ProtectedRoute adminOnly>
              <AdminKYCQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kyc/:submissionId"
          element={
            <ProtectedRoute adminOnly>
              <AdminKYCDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/domain-proofs"
          element={
            <ProtectedRoute adminOnly>
              <AdminDomainProofQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/domain-proofs/:verificationId"
          element={
            <ProtectedRoute adminOnly>
              <AdminDomainProofDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bug-bounty"
          element={
            <ProtectedRoute adminOnly>
              <AdminBugBountyScopes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/scans"
          element={
            <ProtectedRoute adminOnly>
              <AdminScans />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/scans/:scanId"
          element={
            <ProtectedRoute adminOnly>
              <AdminScanDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute adminOnly>
              <AdminAnalytics />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
