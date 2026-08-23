import React from 'react';
import { Check, ShieldAlert } from 'lucide-react';

export function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
        type === 'success' 
          ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
          : 'bg-red-50 text-red-900 border-red-200'
      }`}>
        {type === 'success' ? <Check className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-red-600" />}
        <p className="text-sm font-bold">{message}</p>
      </div>
    </div>
  );
}
