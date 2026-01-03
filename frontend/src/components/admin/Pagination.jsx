// src/components/admin/Pagination.jsx
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, totalPages, onPageChange }) {
  return (
    <div className="flex items-center justify-center space-x-2 mt-6 pb-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-2 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="text-gray-300 text-sm">
        Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
      </div>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-2 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
