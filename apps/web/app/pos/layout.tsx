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

  useEffect(() => {
    if (isHydrated) {
      if (!username || role === "DELETED") {
        router.push("/login");
      } else {
        setIsChecking(false);
      }
    }
  }, [isHydrated, username, role, router]);

  // Sincronización en segundo plano
  useEffect(() => {
    const handleOnline = async () => {
      console.log("Conexión recuperada. Sincronizando catálogo y ventas pendientes...");
      
      await syncCatalog();

      try {
        const pendingSales = await db.pending_sales.toArray();
        if (pendingSales.length === 0) return;

        let syncedCount = 0;
        for (const sale of pendingSales) {
          const { local_id, sync_status, ...saleData } = sale as any;
          const { error } = await supabase.from('sales').insert(saleData);
          if (!error) {
            await db.pending_sales.delete(sale.local_id!);
            syncedCount++;
          }
        }
        if (syncedCount > 0) {
          alert(`✅ ${syncedCount} ventas offline sincronizadas con éxito.`);
        }
      } catch (err) {
        console.error("Error en sincronización background:", err);
      }
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
    </>
  );
}
