// src/components/LoadingScreen.jsx
import React from "react";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950 overflow-hidden">
      <style>
        {`
          @keyframes float {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-30px);
            }
          }
          
          .animate-float {
            animation: float 2s ease-in-out infinite;
          }
        `}
      </style>
      
      <img 
        src="/logoImage.png" 
        alt="Revulnera Logo" 
        className="w-32 h-32 object-contain animate-float"
      />
    </div>
  );
}
