// src/components/ProtectedRoute.jsx
import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { auth } = useContext(AuthContext);
  const location = useLocation();

  if (!auth?.access) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  if (adminOnly && auth?.user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
