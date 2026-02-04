// src/components/EmptyState.jsx
import React from 'react';

export default function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className = '' 
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      {Icon && (
        <div className="w-20 h-20 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-6">
          <Icon className="w-10 h-10 text-purple-400" />
        </div>
      )}
      
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      
      {description && (
        <p className="text-gray-400 text-center max-w-md mb-6">{description}</p>
      )}
      
      {action && action}
    </div>
  );
}
