// src/components/LoadingScreen.jsx
import React from "react";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950 overflow-hidden">
      <style>
        {`
          @keyframes subtlePulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.95;
            }
            50% {
              transform: scale(1.04);
              opacity: 1;
            }
          }
          
          .animate-subtle {
            animation: subtlePulse 0.7s ease-in-out infinite;
          }
        `}
      </style>
      
      <img 
        src="/logoImage.png" 
        alt="Revulnera Logo" 
        className="w-24 h-24 object-contain animate-subtle"
      />
    </div>
  );
}
