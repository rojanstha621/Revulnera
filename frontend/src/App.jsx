// src/App.jsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ErrorBoundary from "./components/ErrorBoundary";
import usePageLoader from "./hooks/usePageLoader";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingScreen from "./components/LoadingScreen";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const HomePage = lazy(() => import("./pages/HomePage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Plans = lazy(() => import("./pages/Plans"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Scanners = lazy(() => import("./pages/Scanners"));
const Reports = lazy(() => import("./pages/Reports"));
const AllScans = lazy(() => import("./pages/AllScans"));
const ScanDetail = lazy(() => import("./pages/ScanDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPassword = lazy(() => import("./pages/ForgetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPasswordConfirm = lazy(() => import("./pages/ResetPasswordConfirm"));
const Profile = lazy(() => import("./pages/Profile"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const AccountVerification = lazy(() => import("./pages/AccountVerification"));
const VulnerabilityScans = lazy(() => import("./pages/VulnerabilityScans"));
const VulnerabilityScanDetail = lazy(() => import("./pages/VulnerabilityScanDetail"));
const DomainVerification = lazy(() => import("./pages/DomainVerification"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminUserDetail = lazy(() => import("./pages/AdminUserDetail"));
const AdminKYCQueue = lazy(() => import("./pages/AdminKYCQueue"));
const AdminKYCDetail = lazy(() => import("./pages/AdminKYCDetail"));
const AdminDomainProofQueue = lazy(() => import("./pages/AdminDomainProofQueue"));
const AdminDomainProofDetail = lazy(() => import("./pages/AdminDomainProofDetail"));
const AdminBugBountyScopes = lazy(() => import("./pages/AdminBugBountyScopes"));
const AdminScans = lazy(() => import("./pages/AdminScans"));
const AdminScanDetail = lazy(() => import("./pages/AdminScanDetail"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));

function AppContent() {
  const loading = usePageLoader();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Layout>
      <Suspense fallback={<LoadingScreen />}>
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
      </Suspense>
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
