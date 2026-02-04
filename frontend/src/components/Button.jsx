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
    primary: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/30',
    secondary: 'border-2 border-purple-500 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 hover:scale-105 active:scale-95',
    danger: 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30',
    ghost: 'text-gray-300 hover:bg-white/5 hover:text-purple-400',
    outline: 'border border-white/20 text-gray-300 hover:border-purple-500/50 hover:bg-purple-500/10',
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
