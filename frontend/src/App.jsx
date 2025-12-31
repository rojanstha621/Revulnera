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


            {/* <Route path="/scan" element={<ScanCreate />} /> */}
            {/* <Route path="/scans/:scanId" element={<ScanLive />} /> */}

            {/* Protected pages */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

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


            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
