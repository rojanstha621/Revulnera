// src/components/ProtectedRoute.jsx
import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { auth } = useContext(AuthContext);
  const location = useLocation();
  const isAdminUser =
    auth?.user?.role === "admin" ||
    auth?.user?.is_staff === true ||
    auth?.user?.is_superuser === true;

  if (!auth?.access) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  if (adminOnly && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  return children;
}
