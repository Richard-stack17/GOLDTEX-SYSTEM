'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../context/RoleContext';
import { Loader2 } from 'lucide-react';

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const { role, isHydrated, permissions } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !permissions?.access_settings) {
      router.push('/hub');
    }
  }, [permissions, isHydrated, router]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!permissions?.access_settings) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header básico o sidebar se puede poner aquí */}
      {children}
    </div>
  );
}
