// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
// import ScanCreate from "./pages/ScanCreate";
// import ScanLive from "./pages/ScanLive";
import HomePage from "./pages/HomePage";
import Dashboard from "./pages/Dashboard";
import Scanners from "./pages/Scanners";
import Logs from "./pages/Logs";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import ForgotPassword from "./pages/ForgetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPasswordConfirm from "./pages/ResetPasswordConfirm";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";

// Admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminScans from "./pages/AdminScans";
import AdminScanDetail from "./pages/AdminScanDetail";
import AdminAnalytics from "./pages/AdminAnalytics";


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
              path="/scanners"
              element={
                <ProtectedRoute>
                  <Scanners />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <Logs />
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
            <Route path="/profile" element={<Profile />} />

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
      </BrowserRouter>
    </AuthProvider>
  );
}
