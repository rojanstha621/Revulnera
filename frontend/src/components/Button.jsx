// src/components/Button.jsx
import React from 'react';
import LoadingSpinner from './LoadingSpinner';

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  className = '',
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-slate-900 text-slate-100 border border-slate-700 hover:bg-slate-800 active:scale-95 shadow-lg shadow-black/30',
    secondary: 'border border-slate-600 text-slate-200 bg-slate-900/60 hover:bg-slate-800 active:scale-95',
    danger: 'bg-red-600 text-white border border-red-500 hover:bg-red-500 active:scale-95 shadow-lg shadow-red-900/40',
    ghost: 'text-gray-300 hover:bg-white/5 hover:text-cyan-300',
    outline: 'border border-slate-700 text-gray-300 hover:border-cyan-500/50 hover:bg-slate-900',
  };

  return (
    <button
      className={`
        ${baseClasses}
        ${variants[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          Loading...
        </>
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5" />}
          {children}
        </>
      )}
    </button>
  );
}
