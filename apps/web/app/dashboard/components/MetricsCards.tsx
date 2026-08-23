import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@goltex/ui";
import { DollarSign, TrendingUp, TrendingDown, Target, FileText } from 'lucide-react';

interface MetricsCardsProps {
  salesTrend?: { pct: number; status: 'green' | 'red' | 'neutral'; noData: boolean; current?: number; prev?: number };
  totalSalesAmount?: number;
  prevSalesAmount?: number;
  totalOrders?: number;
  ordersTrend?: { pct: number; status: 'green' | 'red' | 'neutral'; noData: boolean };
  avgTicket?: number;
  ticketTrend?: { pct: number; status: 'green' | 'red' | 'neutral'; noData: boolean };
  avgOrdersPerDay?: number;
  ordersPerDayTrend?: { pct: number; status: 'green' | 'red' | 'neutral'; noData: boolean };
  avgSalesPerDay?: number;
  salesPerDayTrend?: { pct: number; status: 'green' | 'red' | 'neutral'; noData: boolean };
  proformaStats?: { emitidas: number; ejecutadas: number; anuladas: number; conversionPct: number };
  isLoadingData?: boolean;
}

export function MetricsCards({
  salesTrend = { pct: 0, status: 'neutral', noData: true, current: 0, prev: 0 },
  totalSalesAmount,
  prevSalesAmount,
  totalOrders = 0,
  ordersTrend = { pct: 0, status: 'neutral', noData: true },
  avgTicket = 0,
  ticketTrend = { pct: 0, status: 'neutral', noData: true },
  avgOrdersPerDay = 0,
  ordersPerDayTrend = { pct: 0, status: 'neutral', noData: true },
  avgSalesPerDay = 0,
  salesPerDayTrend = { pct: 0, status: 'neutral', noData: true },
  proformaStats = { emitidas: 0, ejecutadas: 0, anuladas: 0, conversionPct: 0 },
  isLoadingData = false
}: MetricsCardsProps) {
  const isAlert = !salesTrend.noData && salesTrend.status === 'red';
  const salesPct = Math.round(Number(salesTrend.pct) || 0);
  const currentSales = totalSalesAmount ?? salesTrend?.current ?? 0;
  const prevSales = prevSalesAmount ?? salesTrend?.prev ?? 0;

  return (
    <>
      {/* 1. Total Facturado (col-span-3 en xl) */}
      <Card className={`relative overflow-hidden transition-colors border-transparent shadow-lg text-white col-span-1 xl:col-span-3 flex flex-col justify-between ${isAlert ? 'bg-gradient-to-br from-rose-600 to-rose-800 shadow-rose-600/20' : 'bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-indigo-500/20'}`}>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl transform rotate-45 pointer-events-none" />
        <CardHeader className="pb-2">
          <CardTitle className="text-white/80 font-medium text-xs uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Total Facturado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mb-2">
            {isLoadingData ? <div className="w-32 h-9 bg-white/20 animate-pulse rounded-md" /> : `S/ ${currentSales.toLocaleString()}`}
          </div>
          {salesTrend.noData ? (
            <div className="flex items-center gap-1.5 text-white/70 text-[11px] font-bold bg-white/10 w-fit px-2.5 py-1 rounded-full">
              <span>Sin datos previos</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1 text-[11px] font-bold">
              <div className={`flex items-center gap-1.5 w-fit px-2.5 py-0.5 rounded-full ${isAlert ? 'bg-rose-900/50 text-rose-100' : 'bg-emerald-400/20 text-emerald-100'}`}>
                {salesTrend.status === 'green' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{salesTrend.status === 'green' ? '+' : ''}{salesPct}%</span>
              </div>
              <span className="text-white/70">vs anterior (S/ {prevSales.toLocaleString()})</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Rendimiento del Periodo (col-span-4 en xl) */}
      <Card className="bg-card border border-border shadow-sm flex flex-col col-span-1 md:col-span-2 xl:col-span-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-muted-foreground font-medium text-xs uppercase tracking-wider font-bold">Rendimiento del Periodo</CardTitle>
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center px-3 sm:px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2">
            {/* Volumen */}
            <div className="flex flex-col gap-0.5">
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Órdenes</div>
              <div className="text-base sm:text-lg font-black text-foreground">{isLoadingData ? <div className="w-12 h-6 bg-muted animate-pulse rounded-md" /> : totalOrders}</div>
              {ordersTrend.noData ? (
                <span className="text-[9px] bg-secondary text-muted-foreground font-medium px-1.5 py-0.2 rounded w-fit">Sin datos</span>
              ) : ordersTrend.status === 'green' ? (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded w-fit">+{Math.round(Number(ordersTrend.pct))}%</span>
              ) : (
                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded w-fit">{Math.round(Number(ordersTrend.pct))}%</span>
              )}
            </div>

            {/* Ticket Promedio */}
            <div className="flex flex-col gap-0.5">
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Ticket Prom.</div>
              <div className="text-base sm:text-lg font-black text-foreground">{isLoadingData ? <div className="w-14 h-6 bg-muted animate-pulse rounded-md" /> : `S/ ${(avgTicket || 0).toFixed(0)}`}</div>
              {ticketTrend.noData ? (
                <span className="text-[9px] bg-secondary text-muted-foreground font-medium px-1.5 py-0.2 rounded w-fit">Sin datos</span>
              ) : ticketTrend.status === 'green' ? (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded w-fit">+{Math.round(Number(ticketTrend.pct))}%</span>
              ) : (
                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded w-fit">{Math.round(Number(ticketTrend.pct))}%</span>
              )}
            </div>

            {/* Órdenes / Día */}
            <div className="flex flex-col gap-0.5">
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Órdenes/Día</div>
              <div className="text-base sm:text-lg font-black text-foreground">{isLoadingData ? <div className="w-12 h-6 bg-muted animate-pulse rounded-md" /> : (avgOrdersPerDay || 0).toFixed(0)}</div>
              {ordersPerDayTrend.noData ? (
                <span className="text-[9px] bg-secondary text-muted-foreground font-medium px-1.5 py-0.2 rounded w-fit">Sin datos</span>
              ) : ordersPerDayTrend.status === 'green' ? (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded w-fit">+{Math.round(Number(ordersPerDayTrend.pct))}%</span>
              ) : (
                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded w-fit">{Math.round(Number(ordersPerDayTrend.pct))}%</span>
              )}
            </div>

            {/* Ventas / Día */}
            <div className="flex flex-col gap-0.5">
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Ventas/Día</div>
              <div className="text-base sm:text-lg font-black text-foreground">{isLoadingData ? <div className="w-14 h-6 bg-muted animate-pulse rounded-md" /> : `S/ ${(avgSalesPerDay || 0).toFixed(0)}`}</div>
              {salesPerDayTrend.noData ? (
                <span className="text-[9px] bg-secondary text-muted-foreground font-medium px-1.5 py-0.2 rounded w-fit">Sin datos</span>
              ) : salesPerDayTrend.status === 'green' ? (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded w-fit">+{Math.round(Number(salesPerDayTrend.pct))}%</span>
              ) : (
                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded w-fit">{Math.round(Number(salesPerDayTrend.pct))}%</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Proformas Overview (col-span-2 en xl: ancho reducido y conciso) */}
      <Card className="bg-card border border-border shadow-sm flex flex-col col-span-1 xl:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-muted-foreground font-medium text-xs uppercase tracking-wider font-bold">Proformas M.</CardTitle>
          <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-amber-500" />
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 flex-1 flex flex-col justify-center">
          <div className="flex items-baseline justify-between">
            <span className={`text-xl sm:text-2xl font-black tabular-nums tracking-tight ${proformaStats.conversionPct >= 70 ? 'text-emerald-600 dark:text-emerald-400' : proformaStats.conversionPct < 40 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {isLoadingData ? <div className="w-16 h-7 bg-muted animate-pulse rounded-md" /> : `${Math.round(proformaStats?.conversionPct || 0)}%`}
            </span>
            <span className="text-[9px] uppercase font-bold text-muted-foreground">Efectividad</span>
          </div>
          <div className="mt-1 flex flex-col gap-0.5 text-[10px] font-bold">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Emitidas:</span>
              <span className="text-foreground tabular-nums">{proformaStats.emitidas}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span>Pagadas:</span>
              <span className="tabular-nums font-black">{proformaStats.ejecutadas}</span>
            </div>
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
              <span>Anuladas:</span>
              <span className="tabular-nums">{proformaStats.anuladas}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
