'use client';

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@goltex/ui";
import { ShoppingCart, PackageSearch, BarChart3, Clock, FileSpreadsheet, Banknote, UserCircle, Sun, Moon, Contact } from "lucide-react";
import { useRole, type Role } from "../context/RoleContext";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";


export default function HubPage() {
  const [isMounted, setIsMounted] = useState(false);
  const { role, setRole, isHydrated } = useRole();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentDateTime = new Date().toLocaleString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!isHydrated) return null;

  return (
    <div className="min-h-screen p-8 max-w-[1400px] mx-auto space-y-12">
      <header className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Hola, {role === 'CAJERA' ? 'Yuriko' : role === 'VENDEDOR' ? 'Vendedor' : 'Admin'} 👋</h1>
          <p className="text-muted-foreground text-lg">¿Qué deseas hacer hoy?</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 py-2 px-4 rounded-full">
              <Clock className="w-4 h-4" />
              <span suppressHydrationWarning>{isMounted ? currentDateTime : ''}</span>
            </div>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary/50 hover:bg-secondary transition-colors border border-border"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-400" />}
            </button>
          </div>
          <div className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border">
            <UserCircle className="w-5 h-5 text-muted-foreground" />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="bg-transparent text-foreground font-bold outline-none cursor-pointer"
            >
              <option value="ADMIN">ADMIN (Dueño)</option>
              <option value="CAJERA">CAJERA (Yuriko)</option>
              <option value="VENDEDOR">VENDEDOR (Mostrador)</option>
            </select>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* POS - Acceso: ADMIN, VENDEDOR */}
        {(role === 'ADMIN' || role === 'VENDEDOR') ? (
          <Link href="/pos" className="block group">
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
          </Link>
        ) : (
          <Card className="h-full bg-glass/50 border-white/5 opacity-50 cursor-not-allowed">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-gray-500/20 flex items-center justify-center mb-4">
                <ShoppingCart className="w-7 h-7 text-gray-500" />
              </div>
              <CardTitle className="text-2xl text-gray-400">Punto 1</CardTitle>
              <CardDescription className="text-base mt-2 text-gray-500">
                Acceso denegado (Requiere ADMIN o VENDEDOR).
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Inventario - Acceso: ADMIN */}
        {(role === 'ADMIN') ? (
          <Link href="/inventario" className="block group">
            <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,186,0.2)]">
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <PackageSearch className="w-7 h-7 text-purple-400" />
                </div>
                <CardTitle className="text-2xl">Catálogo</CardTitle>
                <CardDescription className="text-base mt-2">
                  Gestión de stock, control de productos, y alertas de desabastecimiento.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <Card className="h-full bg-glass/50 border-white/5 opacity-50 cursor-not-allowed">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-gray-500/20 flex items-center justify-center mb-4">
                <PackageSearch className="w-7 h-7 text-gray-500" />
              </div>
              <CardTitle className="text-2xl text-gray-400">Catálogo</CardTitle>
              <CardDescription className="text-base mt-2 text-gray-500">
                Acceso denegado (Requiere ADMIN).
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Dashboard - Acceso: ADMIN */}
        {(role === 'ADMIN') ? (
          <Link href="/dashboard" className="block group">
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
          </Link>
        ) : (
          <Card className="h-full bg-glass/50 border-white/5 opacity-50 cursor-not-allowed">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-gray-500/20 flex items-center justify-center mb-4">
                <BarChart3 className="w-7 h-7 text-gray-500" />
              </div>
              <CardTitle className="text-2xl text-gray-400">Dashboard</CardTitle>
              <CardDescription className="text-base mt-2 text-gray-500">
                Acceso denegado (Requiere ADMIN).
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Caja - Acceso: ADMIN, CAJERA */}
        {(role === 'ADMIN' || role === 'CAJERA') ? (
          <Link href="/caja" className="block group">
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
          </Link>
        ) : (
          <Card className="h-full bg-glass/50 border-white/5 opacity-50 cursor-not-allowed">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-gray-500/20 flex items-center justify-center mb-4">
                <Banknote className="w-7 h-7 text-gray-500" />
              </div>
              <CardTitle className="text-2xl text-gray-400">Caja</CardTitle>
              <CardDescription className="text-base mt-2 text-gray-500">
                Acceso denegado.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Contabilidad - Acceso: ADMIN, CAJERA */}
        {(role === 'ADMIN' || role === 'CAJERA') ? (
          <button onClick={() => router.push('/contabilidad')} className="block group text-left w-full">
            <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] cursor-pointer">
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
          </button>
        ) : (
          <Card className="h-full bg-glass/50 border-white/5 opacity-50 cursor-not-allowed">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-gray-500/20 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-7 h-7 text-gray-500" />
              </div>
              <CardTitle className="text-2xl text-gray-400">Contabilidad</CardTitle>
              <CardDescription className="text-base mt-2 text-gray-500">
                Acceso denegado.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Clientes Frecuentes - Acceso: ADMIN, CAJERA */}
        {(role === 'ADMIN' || role === 'CAJERA') ? (
          <button onClick={() => router.push('/clientes')} className="block group text-left w-full">
            <Card className="h-full bg-glass hover:bg-white/5 border-white/10 transition-all duration-300 hover:border-pink-500/50 hover:shadow-[0_0_30px_rgba(236,72,153,0.2)] cursor-pointer">
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
          </button>
        ) : (
          <Card className="h-full bg-glass/50 border-white/5 opacity-50 cursor-not-allowed">
            <CardHeader>
              <div className="w-14 h-14 rounded-xl bg-gray-500/20 flex items-center justify-center mb-4">
                <Contact className="w-7 h-7 text-gray-500" />
              </div>
              <CardTitle className="text-2xl text-gray-400">Clientes Frecuentes</CardTitle>
              <CardDescription className="text-base mt-2 text-gray-500">
                Acceso denegado.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
