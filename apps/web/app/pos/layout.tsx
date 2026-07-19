"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import PinLockScreen from "../components/PinLockScreen";
import { supabase } from "../lib/supabase";
import { db, syncCatalog } from "../lib/localDb";
import bcrypt from "bcryptjs";
import { Loader2 } from "lucide-react";
import { useRole } from "../context/RoleContext";

interface CashierProfile {
  id: string;
  username: string;
  role: string;
  employee_id: string | null;
  employees?: { full_name: string } | null;
}

interface PosAuthContextType {
  isLocked: boolean;
  activeCashier: CashierProfile | null;
  lockPos: () => void;
  unlockPos: (profile: CashierProfile) => void;
}

const PosAuthContext = createContext<PosAuthContextType | undefined>(undefined);

export function usePosAuth() {
  const context = useContext(PosAuthContext);
  if (!context) {
    throw new Error("usePosAuth must be used within a PosAuthLayout");
  }
  return context;
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [activeCashier, setActiveCashier] = useState<CashierProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const { role, username, employeeId, isHydrated } = useRole();

  const lockPos = () => {
    setIsLocked(true);
    setActiveCashier(null);
  };

  const unlockPos = (profile: CashierProfile) => {
    setActiveCashier(profile);
    setIsLocked(false);
  };

  // Fase 5: Auto-login con Supabase Session y RoleContext (Web Session)
  useEffect(() => {
    if (!isHydrated) return; // Esperar a que el RoleContext cargue

    const checkSession = async () => {
      try {
        // 1. Prioridad a la sesión web local (RoleContext) si ya hay un usuario válido
        if (role && role !== "DELETED" && username) {
          unlockPos({
            id: 'local-session', // Dummy ID for local auth
            username: username,
            role: role,
            employee_id: employeeId
          });
          return; // Ya se validó por la web, salimos
        }

        // 2. Si no hay sesión local (ej: Tablet App), revisar sesión de Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const { data, error } = await supabase
            .from("profiles")
            .select(`
              id,
              username,
              role,
              employee_id,
              employees:employee_id ( full_name )
            `)
            .eq("email", session.user.email)
            .neq("role", "DELETED")
            .maybeSingle();

          if (data && !error) {
            unlockPos(data as CashierProfile);
          }
        }
      } catch (err) {
        console.error("Error comprobando sesión del POS:", err);
      } finally {
        setIsCheckingSession(false);
      }
    };
    
    checkSession();
  }, [isHydrated, role, username, employeeId]);

  // Fase 4: Background Sync
  useEffect(() => {
    const handleOnline = async () => {
      console.log("Conexión recuperada. Sincronizando catálogo y ventas pendientes...");
      
      // Sync Catalog
      await syncCatalog();

      // Sincronizar ventas offline
      try {
        const pendingSales = await db.pending_sales.toArray();
        if (pendingSales.length === 0) return;

        let syncedCount = 0;
        for (const sale of pendingSales) {
          // Remover atributos locales antes de enviar
          const { local_id, sync_status, ...saleData } = sale as any;
          
          const { error } = await supabase.from('sales').insert(saleData);
          
          if (!error) {
            await db.pending_sales.delete(sale.local_id!);
            syncedCount++;
          } else {
            console.error("Error sincronizando venta", sale.local_id, error);
          }
        }

        if (syncedCount > 0) {
          alert(`✅ ${syncedCount} ventas offline sincronizadas con éxito.`);
        }
      } catch (err) {
        console.error("Error en sincronización background:", err);
      }
    };

    // Sincronizar inmediatamente al cargar la vista si estamos online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncCatalog();
    }

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handlePinComplete = async (pin: string) => {
    setErrorMsg(null);
    setIsAuthenticating(true);

    try {
      let cashierData: CashierProfile | null = null;

      if (navigator.onLine) {
        // Validación Online
        const { data, error } = await supabase
          .from("profiles")
          .select(`
            id,
            username,
            role,
            employee_id,
            password_hash,
            employees:employee_id ( full_name )
          `)
          .neq("role", "DELETED");

        if (error) throw new Error("Error al validar el PIN en línea.");
        
        const matchedProfile = data.find(p => p.password_hash && bcrypt.compareSync(pin, p.password_hash));
        if (matchedProfile) {
          cashierData = matchedProfile as CashierProfile;
        }
      } else {
        // Validación Offline (Fallback)
        console.log("Validando PIN en modo offline...");
        const localProfiles = await db.profiles.toArray();
        const matchedProfile = localProfiles.find(p => p.password_hash && bcrypt.compareSync(pin, p.password_hash));
        
        if (matchedProfile) {
          cashierData = {
            id: matchedProfile.id,
            username: matchedProfile.username,
            role: matchedProfile.role,
            employee_id: matchedProfile.employee_id,
          };
        }
      }

      if (!cashierData) {
        setErrorMsg("PIN incorrecto. Inténtalo de nuevo.");
        return;
      }

      // Desbloquear y guardar cajero
      unlockPos(cashierData);
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/pos`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || "Error al iniciar sesión con Google");
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium animate-pulse">Iniciando Punto de Venta...</p>
      </div>
    );
  }

  return (
    <PosAuthContext.Provider value={{ isLocked, activeCashier, lockPos, unlockPos }}>
      {/* Contenido protegido del POS */}
      <div className={`transition-all duration-300 ${isLocked ? "blur-sm pointer-events-none select-none opacity-50" : ""}`}>
        {children}
      </div>

      {/* Pantalla de bloqueo */}
      {isLocked && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center">
          <PinLockScreen 
            onPinComplete={handlePinComplete} 
            onGoogleLogin={navigator.onLine ? handleGoogleLogin : undefined}
          />
          {errorMsg && (
            <div className="absolute bottom-24 bg-destructive/10 text-destructive border border-destructive px-6 py-3 rounded-full font-bold animate-in fade-in slide-in-from-bottom-4">
              {errorMsg}
            </div>
          )}
          {isAuthenticating && (
            <div className="absolute bottom-24 text-muted-foreground font-medium animate-pulse">
              Validando...
            </div>
          )}
        </div>
      )}
    </PosAuthContext.Provider>
  );
}
