'use client';

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@goltex/ui";
import { ShoppingCart, PackageSearch, BarChart3, Clock, FileSpreadsheet, Banknote, UserCircle, Sun, Moon, Contact, Users, ScrollText, Settings } from "lucide-react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useRole } from "../context/RoleContext";
import { useTheme } from "../context/ThemeContext";
import StoreSwitcher from "../components/StoreSwitcher";
import { useRouter } from "next/navigation";
import { useIsNativeAndroid } from "../lib/platform";
import UserProfileModal from "./components/UserProfileModal";


export default function HubPage() {
  const [isMounted, setIsMounted] = useState(false);
  const { role, username, isHydrated, clearSession, permissions } = useRole();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const isNativeAndroid = useIsNativeAndroid();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isHydrated && (!role || !username)) {
      router.push("/login");
    }
  }, [isHydrated, role, username, router]);

  const currentDateTime = new Date().toLocaleString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!isHydrated || !role || !username) return null;

  const isApkMode = isNativeAndroid || process.env.NEXT_PUBLIC_APP_MODE === 'apk';

  const isModuleAllowed = (key: string, permValue?: boolean) => {
    if (!permValue) return false;
    if (!isApkMode) return true;
    // En modo APK Android, solo se permiten los módulos móviles (POS y Configuración)
    return key === "pos" || key === "settings";
  };

  const hasAnyModuleAccess = Boolean(
    isModuleAllowed("pos", permissions?.access_pos) ||
    isModuleAllowed("inventory", permissions?.access_inventory) ||
    isModuleAllowed("dashboard", permissions?.access_dashboard) ||
    isModuleAllowed("caja", permissions?.access_caja) ||
    isModuleAllowed("contabilidad", permissions?.access_contabilidad) ||
    isModuleAllowed("clientes", permissions?.access_clientes) ||
    isModuleAllowed("personal", permissions?.access_personal) ||
    isModuleAllowed("proformas", permissions?.access_proformas) ||
    isModuleAllowed("settings", permissions?.access_settings)
  );



  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 md:space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-1 md:mb-2">Hola, {username || role}</h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg">¿Qué deseas hacer hoy?</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground bg-secondary/50 py-1.5 px-3 sm:py-2 sm:px-4 rounded-full">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span suppressHydrationWarning>{isMounted ? currentDateTime : ''}</span>
            </div>
            {/* Store Switcher */}
            <StoreSwitcher />
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-secondary/50 hover:bg-secondary transition-colors border border-border shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border text-xs sm:text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              <UserCircle className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              Mi Perfil
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border text-xs sm:text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              <Contact className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <UserProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
      />

      {!hasAnyModuleAccess ? (
        <div className="text-center py-16 bg-glass/30 rounded-2xl border border-white/10 p-8 space-y-3">
          <p className="text-lg font-bold text-muted-foreground">
            {isApkMode 
              ? "No cuentas con módulos móviles asignados actualmente."
              : "No cuentas con módulos asignados actualmente."}
          </p>
          <p className="text-sm text-muted-foreground/70">Comunícate con un Administrador para habilitar los permisos de tu cuenta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* POS - Acceso: access_pos */}
          {isModuleAllowed("pos", permissions?.access_pos) && (
            <div onClick={() => router.push('/pos/')} className="block group cursor-pointer">
              <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <ShoppingCart className="w-7 h-7 text-blue-400" />
                  </div>
                  <CardTitle className="text-2xl">Punto 1</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Catálogo de telas, proformas, carrito de compras y facturación rápida.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Inventario - Acceso: access_inventory */}
          {isModuleAllowed("inventory", permissions?.access_inventory) && (
            <div onClick={() => router.push('/inventario/')} className="block group cursor-pointer">
              <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,186,0.2)]">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <PackageSearch className="w-7 h-7 text-purple-400" />
                  </div>
                  <CardTitle className="text-2xl">Catálogo & Servicios</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Gestión de stock, control de productos, y alertas de desabastecimiento.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Dashboard - Acceso: access_dashboard */}
          {isModuleAllowed("dashboard", permissions?.access_dashboard) && (
            <div onClick={() => router.push('/dashboard/')} className="block group cursor-pointer">
              <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <CardTitle className="text-2xl">Dashboard</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Métricas del negocio, resumen de ventas diarias y proyecciones.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Caja - Acceso: access_caja */}
          {isModuleAllowed("caja", permissions?.access_caja) && (
            <div onClick={() => router.push('/caja/')} className="block group cursor-pointer">
              <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Banknote className="w-7 h-7 text-cyan-400" />
                  </div>
                  <CardTitle className="text-2xl">Caja</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Liquidación de tickets pendientes del día, control de pasarela de pagos y cierre rápido.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Contabilidad - Acceso: access_contabilidad */}
          {isModuleAllowed("contabilidad", permissions?.access_contabilidad) && (
            <div onClick={() => router.push('/contabilidad/')} className="block group w-full cursor-pointer">
              <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-7 h-7 text-amber-400" />
                  </div>
                  <CardTitle className="text-2xl">Contabilidad</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Migración de historial, importación y exportación de archivos contables.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Clientes Frecuentes - Acceso: access_clientes */}
          {isModuleAllowed("clientes", permissions?.access_clientes) && (
            <div onClick={() => router.push('/clientes/')} className="block group w-full cursor-pointer">
              <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-pink-500/50 hover:shadow-[0_0_30px_rgba(236,72,153,0.2)]">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Contact className="w-7 h-7 text-pink-400" />
                  </div>
                  <CardTitle className="text-2xl">Clientes Frecuentes</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Gestión de clientes caseros, registro de RUC/DNI y mantenimiento de historial VIP.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Personal - Acceso: access_personal */}
          {isModuleAllowed("personal", permissions?.access_personal) && (
            <div onClick={() => router.push('/admin/personal/')} className="block group cursor-pointer">
              <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-indigo-500/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Users className="w-7 h-7 text-indigo-400" />
                  </div>
                  <CardTitle className="text-2xl">Personal</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Gestión de empleados, control de accesos y roles del sistema.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Historial de Proformas - Acceso: access_proformas */}
          {isModuleAllowed("proformas", permissions?.access_proformas) && (
            <div onClick={() => router.push('/historial-proformas/')} className="block group cursor-pointer">
              <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-teal-500/50 hover:shadow-[0_0_30px_rgba(20,184,166,0.2)]">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-teal-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <ScrollText className="w-7 h-7 text-teal-400" />
                  </div>
                  <CardTitle className="text-2xl">Historial</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Historial completo de proformas, detalles de ítems y anulación.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Configuración - Acceso: access_settings */}
          {isModuleAllowed("settings", permissions?.access_settings) && (
            <div onClick={() => router.push('/configuracion/')} className="block group cursor-pointer">
              <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Settings className="w-7 h-7 text-emerald-400" />
                  </div>
                  <CardTitle className="text-2xl">Configuración</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Gestión de impresoras, hardware y ajustes generales del sistema.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          clearSession();
          router.push('/login');
        }}
        title="Cerrar Sesión"
        description="¿Estás seguro de que deseas salir de tu cuenta?"
        confirmText="Sí, salir"
        isDestructive={true}
      />
    </div>
  );
}
