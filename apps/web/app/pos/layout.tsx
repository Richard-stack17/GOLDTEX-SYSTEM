"use client";

import React, { useEffect, useState } from "react";
import { useRole } from "../context/RoleContext";
import { AccessDeniedView } from "../components/AccessDeniedView";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { syncCatalog, db } from "../lib/localDb";
import { supabase } from "../lib/supabase";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { role, username, isHydrated, permissions } = useRole();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (isHydrated) {
      if (!username || role === "DELETED") {
        router.push("/login");
      } else {
        setIsChecking(false);
      }
    }
  }, [isHydrated, username, role, router]);

  // Sincronización en segundo plano del catálogo
  useEffect(() => {
    const handleOnline = async () => {
      await syncCatalog();
    };

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncCatalog();
    }

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  if (!isHydrated || isChecking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium animate-pulse">Cargando Sistema POS...</p>
      </div>
    );
  }

  if (!permissions?.access_pos) {
    return <AccessDeniedView moduleName="Punto de Venta (POS)" />;
  }

  return (
    <>
      {children}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            <div className="font-bold text-sm">{toast.message}</div>
          </div>
        </div>
      )}
    </>
  );
}
