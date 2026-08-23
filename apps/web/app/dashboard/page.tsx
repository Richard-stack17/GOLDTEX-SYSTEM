'use client';

import React from "react";
import { useRole } from "../context/RoleContext";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import Link from 'next/link';
import StoreSwitcher from '../components/StoreSwitcher';
import { AccessDeniedView } from '../components/AccessDeniedView';
import { useIsNativeAndroid } from '../lib/platform';

// Hooks
import { useDashboardStats } from "./hooks/useDashboardStats";

// Components
import { MetricsCards } from "./components/MetricsCards";
import { RankingTable } from "./components/RankingTable";
import { SalesChart } from "./components/SalesChart";
import { TopProducts } from "./components/TopProducts";
import { TopFamilies } from "./components/TopFamilies";
import { PaymentMethods } from "./components/PaymentMethods";
import { ServicesBreakdown } from "./components/ServicesBreakdown";

const DATE_FILTERS: { id: string; label: string }[] = [
  { id: "TODAY", label: "Hoy" },
  { id: "THIS_WEEK", label: "Semana" },
  { id: "THIS_MONTH", label: "Mes" },
  { id: "THIS_YEAR", label: "Año" },
  { id: "CUSTOM", label: "Personalizado" },
  { id: "ALL_TIME", label: "Histórico" }
];

export default function DashboardPage() {
  const router = useRouter();
  const { isHydrated, permissions } = useRole();
  const stats = useDashboardStats();
  const isNativeAndroid = useIsNativeAndroid();

  if (!isHydrated) return null;
  if (isNativeAndroid) {
    return (
      <AccessDeniedView
        moduleName="Dashboard"
        customReason="El módulo de Dashboard está disponible exclusivamente desde la versión Web."
      />
    );
  }
  if (!permissions?.access_dashboard) {
    return <AccessDeniedView moduleName="Dashboard" />;
  }

  if (!stats) return null;

  const isCustom = stats.dateFilter === "CUSTOM";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── HEADER ── */}
      <header className="bg-card border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-6 shadow-sm shrink-0">
        <div className="flex items-center gap-4 pt-2 sm:pt-0 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-foreground truncate">
                Dashboard
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Métricas y Resumen de Ventas</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <StoreSwitcher />
        </div>
      </header>

      {/* ── FILTERS BAR ── */}
      <div className="bg-card/50 border-b border-border px-4 py-2.5 flex flex-col gap-2.5 shrink-0">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
            <CalendarIcon className="w-4 h-4 text-indigo-500" />
            Filtro de Fecha
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {DATE_FILTERS.map((f) => {
              const isActive = stats.dateFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => stats.handleQuickFilter ? stats.handleQuickFilter(f.id as any) : stats.setDateFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                      : 'bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CUSTOM DATE RANGE PICKER PANEL ── */}
        {isCustom && (
          <div className="pt-2.5 border-t border-border/60 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground shrink-0">
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              <span>Rango Personalizado:</span>
            </div>

            {/* Selector de Rango Desde - Hasta (Grid en móvil, flex en desktop) */}
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1.5 sm:py-1 rounded-lg border border-border min-w-0">
                <span className="text-[10px] font-bold uppercase text-muted-foreground shrink-0">Desde:</span>
                <input
                  type="date"
                  value={stats.customStartDate || stats.dateRange?.start || ''}
                  onChange={(e) => {
                    if (stats.handleSetStartDate) stats.handleSetStartDate(e.target.value);
                    else stats.setCustomStartDate(e.target.value);
                  }}
                  className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer w-full min-w-0"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1.5 sm:py-1 rounded-lg border border-border min-w-0">
                <span className="text-[10px] font-bold uppercase text-muted-foreground shrink-0">Hasta:</span>
                <input
                  type="date"
                  value={stats.customEndDate || stats.dateRange?.end || ''}
                  onChange={(e) => {
                    if (stats.handleSetEndDate) stats.handleSetEndDate(e.target.value);
                    else stats.setCustomEndDate(e.target.value);
                  }}
                  className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer w-full min-w-0"
                />
              </div>
            </div>

            {/* Desplegables de Mes / Año (Grid en móvil, flex en desktop) */}
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <select
                value={stats.selectedMonth !== "" ? stats.selectedMonth : ""}
                onChange={(e) => {
                  if (stats.handleMonthChange) stats.handleMonthChange(e.target.value);
                  else stats.setSelectedMonth(e.target.value === "" ? "" : Number(e.target.value));
                }}
                className="h-8 sm:h-7 px-2.5 rounded-lg bg-secondary/80 border border-border text-xs font-bold text-foreground outline-none cursor-pointer w-full sm:w-auto truncate"
              >
                <option value="">Todos los Meses</option>
                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>

              <select
                value={stats.selectedYear !== "" ? stats.selectedYear : ""}
                onChange={(e) => {
                  if (stats.handleYearChange) stats.handleYearChange(e.target.value);
                  else stats.setSelectedYear(e.target.value === "" ? "" : Number(e.target.value));
                }}
                className="h-8 sm:h-7 px-2.5 rounded-lg bg-secondary/80 border border-border text-xs font-bold text-foreground outline-none cursor-pointer w-full sm:w-auto"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

          {/* ── TOP KPIs: FACTURADO | RENDIMIENTO | PROFORMAS | CUADRE DE PAGOS ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4">
            <MetricsCards {...stats} />
            <div className="col-span-1 md:col-span-2 xl:col-span-3">
              <PaymentMethods {...stats} />
            </div>
          </div>

          {/* ── CHART & RANKING ── */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
            <SalesChart {...stats} />
            <RankingTable {...stats} />
          </div>

          {/* ── ANALYTICS GRID: TOP PRODUCTOS | TOP FAMILIAS | SERVICIOS ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <TopProducts {...stats} />
            <TopFamilies {...stats} />
            <ServicesBreakdown {...stats} />
          </div>

        </div>
      </main>
    </div>
  );
}
