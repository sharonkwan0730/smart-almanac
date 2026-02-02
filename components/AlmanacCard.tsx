
import React from 'react';

interface AlmanacCardProps {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const AlmanacCard: React.FC<AlmanacCardProps> = ({ title, children, icon, className = "" }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden ${className}`}>
      <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-red-800 text-base">{icon}</span>}
          <h3 className="text-stone-800 font-serif font-bold text-sm tracking-wider">{title}</h3>
        </div>
        <div className="h-px flex-grow mx-3 bg-stone-200 opacity-30"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-red-800 opacity-10"></div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};
