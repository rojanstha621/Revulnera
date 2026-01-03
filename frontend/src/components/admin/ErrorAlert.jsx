// src/components/admin/ErrorAlert.jsx
import React from "react";
import { AlertCircle, X } from "lucide-react";

export default function ErrorAlert({ message, onDismiss }) {
  return (
    <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 flex items-start justify-between">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
        <p className="text-red-200">{message}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-300">
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
