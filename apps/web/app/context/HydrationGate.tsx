"use client";

import React from "react";
import { useRole } from "./RoleContext";

/**
 * HydrationGate — Guarda de hidratación.
 *
 * Mientras RoleContext no haya leído localStorage (isHydrated = false),
 * muestra una pantalla de carga mínima. Esto garantiza que:
 *  1. El servidor y el primer render del cliente rendericen lo mismo (spinner).
 *  2. No haya hydration mismatch por contenido dependiente del rol.
 *  3. No haya parpadeo visual de interfaz según el rol/tema.
 */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const { isHydrated } = useRole();

  if (!isHydrated) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
        aria-label="Cargando sistema..."
        role="status"
      >
        {/* Spinner animado */}
        <div className="relative">
          {/* Anillo exterior */}
          <div className="w-14 h-14 rounded-full border-4 border-border" />
          {/* Arco giratorio */}
          <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        </div>

        {/* Logotipo / nombre del sistema */}
        <div className="mt-6 text-center">
          <p className="text-xl font-black tracking-widest text-foreground uppercase">
            GOLTEX
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wider uppercase">
            Cargando sistema...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
