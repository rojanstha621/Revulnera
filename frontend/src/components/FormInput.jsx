// src/components/FormInput.jsx
import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

export default function FormInput({
  label,
  type = 'text',
  error,
  success,
  icon: Icon,
  className = '',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-gray-300">
          {label}
        </label>
      )}
      
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        
        <input
          type={inputType}
          className={`
            w-full px-4 py-3 rounded-xl bg-white/5 border text-white 
            placeholder-gray-500 transition-all duration-300 outline-none
            ${Icon ? 'pl-11' : ''}
            ${isPassword ? 'pr-11' : ''}
            ${error 
              ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/30' 
              : success
                ? 'border-green-500/50 focus:border-green-500 focus:ring-2 focus:ring-green-500/30'
                : 'border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30'
            }
            backdrop-blur-sm hover:bg-white/10
          `}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}

        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        )}

        {success && !error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}

      {success && !error && (
        <p className="text-sm text-green-400 flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          {success}
        </p>
      )}
    </div>
  );
}
