'use client';

import React from 'react';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AccessDeniedViewProps {
  moduleName?: string;
  onBack?: () => void;
  customReason?: string;
}

export function AccessDeniedView({ moduleName = 'este módulo', onBack, customReason }: AccessDeniedViewProps) {
  const router = useRouter();

  const handleGoBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = '/hub';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 shadow-xl text-center">
        <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 shadow-sm">
          <ShieldAlert className="w-7 h-7 shrink-0" />
        </div>

        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
          Acceso Restringido
        </h2>

        <p className="text-xs text-gray-500 font-medium leading-relaxed mt-2">
          {customReason || (
            <>
              No cuentas con los permisos necesarios para acceder a <strong className="text-gray-700">{moduleName}</strong>. Si requieres habilitar esta función, comunícate con el Administrador del sistema.
            </>
          )}
        </p>

        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center">
          <button
            onClick={handleGoBack}
            className="w-full h-10 px-4 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white transition-all shadow-sm cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Volver al Panel Principal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
