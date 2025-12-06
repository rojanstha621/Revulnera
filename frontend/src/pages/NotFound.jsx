// src/pages/NotFound.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
      <h1 className="text-4xl font-bold text-white">404</h1>
      <p className="text-slate-300">
        The page you are looking for does not exist.
      </p>
      <Link to="/" className="btn-primary">
        Go back home
      </Link>
    </div>
  );
}
