"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge
} from "@goltex/ui";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ShoppingCart, AlertTriangle, DollarSign, Package, Users, Medal, CreditCard, Banknote, Calendar, BarChart3, Tag } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, syncCatalog } from "../lib/localDb";
import {
  AreaChart, Area, LineChart, Line,
  BarChart, Bar, LabelList,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Legend
} from "recharts";

type DateFilter = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";

const formatYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function DashboardPage() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("THIS_WEEK");
  const [selectedYear, setSelectedYear] = useState<number | "">(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | "">(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number | "">("");

  // Sync on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      syncCatalog();
    }
  }, []);

  // ── Date Range Calculation (Timezone Safe) ──
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (dateFilter === "TODAY") {
      // today
    } else if (dateFilter === "THIS_WEEK") {
      const day = now.getDay() || 7;
      start.setDate(now.getDate() - (day - 1)); // Monday
      end = new Date(start);
      end.setDate(start.getDate() + 6); // Sunday
    } else if (dateFilter === "THIS_MONTH") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (dateFilter === "CUSTOM") {
      const y = selectedYear === "" ? now.getFullYear() : selectedYear as number;
      if (selectedMonth === "") {
        start = new Date(y, 0, 1);
        end = new Date(y, 11, 31);
      } else {
        const m = selectedMonth as number;
        if (selectedDay !== "") {
          const d = selectedDay as number;
          start = new Date(y, m, d);
          end = new Date(y, m, d);
        } else {
          start = new Date(y, m, 1);
          end = new Date(y, m + 1, 0);
        }
      }
    }

    return { start: formatYMD(start), end: formatYMD(end) };
  }, [dateFilter, selectedYear, selectedMonth, selectedDay]);

  const prevDateRange = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (dateFilter === "TODAY") {
      start.setDate(now.getDate() - 1);
      end.setDate(now.getDate() - 1);
    } else if (dateFilter === "THIS_WEEK") {
      const day = now.getDay() || 7;
      start.setDate(now.getDate() - (day - 1) - 7);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (dateFilter === "THIS_MONTH") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (dateFilter === "CUSTOM") {
      const y = selectedYear === "" ? now.getFullYear() : selectedYear as number;
      if (selectedMonth === "") {
        start = new Date(y - 1, 0, 1);
        end = new Date(y - 1, 11, 31);
      } else {
        const m = selectedMonth as number;
        if (selectedDay !== "") {
          const d = selectedDay as number;
          start = new Date(y, m, d - 1);
          end = new Date(y, m, d - 1);
        } else {
          const pMonth = m === 0 ? 11 : m - 1;
          const pYear = m === 0 ? y - 1 : y;
          start = new Date(pYear, pMonth, 1);
          end = new Date(pYear, pMonth + 1, 0);
        }
      }
    }

    return { start: formatYMD(start), end: formatYMD(end) };
  }, [dateFilter, selectedYear, selectedMonth, selectedDay]);


  // ── Database Queries ──
  const rawSales = useLiveQuery(
    () => db.sales.where('issue_date').between(dateRange.start, dateRange.end, true, true).toArray(),
    [dateRange.start, dateRange.end],
    []
  );

  const rawPrevSales = useLiveQuery(
    () => db.sales.where('issue_date').between(prevDateRange.start, prevDateRange.end, true, true).toArray(),
    [prevDateRange.start, prevDateRange.end],
    []
  );

  // 1. Filtrado Estricto (Sin límite arbitrario de monto)
  const sales = useMemo(() => {
    if (!rawSales) return [];
    return rawSales.filter(s =>
      s.status !== 'CANCELLED' &&
      s.status !== 'PENDING'
    );
  }, [rawSales]);

  const prevSales = useMemo(() => {
    if (!rawPrevSales) return [];
    return rawPrevSales.filter(s =>
      s.status !== 'CANCELLED' &&
      s.status !== 'PENDING'
    );
  }, [rawPrevSales]);

  const transactions = useLiveQuery(() => db.transactions.toArray(), [], []);
  const employees = useLiveQuery(() => db.employees.toArray(), [], []);
  const profiles = useLiveQuery(() => db.profiles.toArray(), [], []);
  const families = useLiveQuery(() => db.families.toArray(), [], []);

  // ── Handlers ──
  const handleQuickFilter = (filter: DateFilter) => {
    setDateFilter(filter);
    setSelectedYear("");
    setSelectedMonth("");
    setSelectedDay("");
  };

  const handleCustomFilter = (type: "DAY" | "MONTH" | "YEAR", value: string) => {
    setDateFilter("CUSTOM");
    const numValue = value === "" ? "" : Number(value);
    const now = new Date();

    if (type === "DAY") {
      setSelectedDay(numValue);
      if (selectedMonth === "") setSelectedMonth(now.getMonth());
      if (selectedYear === "") setSelectedYear(now.getFullYear());
    } else if (type === "MONTH") {
      setSelectedMonth(numValue);
      setSelectedDay(""); // Evitar días inválidos al cambiar de mes
      if (selectedYear === "") setSelectedYear(now.getFullYear());
    } else {
      setSelectedYear(numValue);
      setSelectedDay(""); // Evitar días inválidos al cambiar de año
    }
  };

  // ── Aggregations (Optimized with useMemo) ──

  // 1. KPIs & Trend
  const totalSalesAmount = useMemo(() => (sales || []).reduce((sum, s) => sum + s.total, 0), [sales]);
  const prevSalesAmount = useMemo(() => (prevSales || []).reduce((sum, s) => sum + s.total, 0), [prevSales]);
  const totalOrders = (sales || []).length;
  const prevTotalOrders = (prevSales || []).length;
  const avgTicket = totalOrders > 0 ? totalSalesAmount / totalOrders : 0;
  const prevAvgTicket = useMemo(() => {
    if (!prevSales || prevSales.length === 0) return 0;
    return prevSalesAmount / prevSales.length;
  }, [prevSales, prevSalesAmount]);

  // Días únicos con ventas en el periodo
  const daysInPeriod = useMemo(() => {
    const start = new Date(dateRange.start + 'T00:00:00');
    const end = new Date(dateRange.end + 'T00:00:00');
    const now = new Date();
    const effectiveEnd = end > now ? now : end;
    const diffMs = effectiveEnd.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
  }, [dateRange]);

  const prevDaysInPeriod = useMemo(() => {
    const start = new Date(prevDateRange.start + 'T00:00:00');
    const end = new Date(prevDateRange.end + 'T00:00:00');
    const now = new Date();
    const effectiveEnd = end > now ? now : end;
    const diffMs = effectiveEnd.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
  }, [prevDateRange]);

  const avgOrdersPerDay = totalOrders / daysInPeriod;
  const avgSalesPerDay = totalSalesAmount / daysInPeriod;
  const prevAvgOrdersPerDay = prevTotalOrders / prevDaysInPeriod;
  const prevAvgSalesPerDay = prevSalesAmount / prevDaysInPeriod;

  // 2. Lógica de Comparativa "Vs Previo" (Semáforo RAG)
  const salesTrend = useMemo(() => {
    if (!prevSalesAmount || prevSalesAmount === 0) {
      return { pct: 0, status: 'neutral' as const, noData: true };
    }
    const diff = totalSalesAmount - prevSalesAmount;
    const pct = (diff / prevSalesAmount) * 100;
    const status = pct > 0 ? 'green' as const : pct < 0 ? 'red' as const : 'neutral' as const;
    return { pct, status, noData: false };
  }, [totalSalesAmount, prevSalesAmount]);

  const ordersTrend = useMemo(() => {
    if (!prevTotalOrders || prevTotalOrders === 0) {
      return { pct: 0, status: 'neutral' as const, noData: true };
    }
    const diff = totalOrders - prevTotalOrders;
    const pct = (diff / prevTotalOrders) * 100;
    const status = pct > 0 ? 'green' as const : pct < 0 ? 'red' as const : 'neutral' as const;
    return { pct, status, noData: false };
  }, [totalOrders, prevTotalOrders]);

  const ticketTrend = useMemo(() => {
    if (!prevAvgTicket || prevAvgTicket === 0) {
      return { pct: 0, status: 'neutral' as const, noData: true };
    }
    const diff = avgTicket - prevAvgTicket;
    const pct = (diff / prevAvgTicket) * 100;
    const status = pct > 0 ? 'green' as const : pct < 0 ? 'red' as const : 'neutral' as const;
    return { pct, status, noData: false };
  }, [avgTicket, prevAvgTicket]);

  const ordersPerDayTrend = useMemo(() => {
    if (!prevAvgOrdersPerDay || prevAvgOrdersPerDay === 0) return { pct: 0, status: 'neutral' as const, noData: true };
    const diff = avgOrdersPerDay - prevAvgOrdersPerDay;
    const pct = (diff / prevAvgOrdersPerDay) * 100;
    return { pct, status: pct > 0 ? 'green' as const : pct < 0 ? 'red' as const : 'neutral' as const, noData: false };
  }, [avgOrdersPerDay, prevAvgOrdersPerDay]);

  const salesPerDayTrend = useMemo(() => {
    if (!prevAvgSalesPerDay || prevAvgSalesPerDay === 0) return { pct: 0, status: 'neutral' as const, noData: true };
    const diff = avgSalesPerDay - prevAvgSalesPerDay;
    const pct = (diff / prevAvgSalesPerDay) * 100;
    return { pct, status: pct > 0 ? 'green' as const : pct < 0 ? 'red' as const : 'neutral' as const, noData: false };
  }, [avgSalesPerDay, prevAvgSalesPerDay]);

  // 3. Eficiencia de Proformas
  const proformaStats = useMemo(() => {
    if (!rawSales) return { emitidas: 0, ejecutadas: 0, anuladas: 0, conversionPct: 0 };
    // Las proformas en el sistema empiezan como PENDING.
    // Todas las ventas (rawSales) fueron alguna vez PENDING (proformas).
    const emitidas = rawSales.length;
    let ejecutadas = 0;
    let anuladas = 0;
    for (const s of rawSales) {
      if (s.status === 'COMPLETED' || s.status === 'PAID') ejecutadas++;
      else if (s.status === 'CANCELLED') anuladas++;
    }
    const conversionPct = emitidas > 0 ? (ejecutadas / emitidas) * 100 : 0;
    return { emitidas, ejecutadas, anuladas, conversionPct };
  }, [rawSales]);

  // 2. Cuadre por Método de Pago
  const paymentMethods = useMemo(() => {
    if (!sales || !transactions) return [];
    const saleIds = new Set(sales.map(s => s.id));
    const relevantTxs = transactions.filter(tx => saleIds.has(tx.sale_id));
    const breakdown: Record<string, number> = {};
    for (const tx of relevantTxs) {
      const method = tx.payment_method || 'Efectivo';
      breakdown[method] = (breakdown[method] || 0) + tx.amount;
    }
    return Object.entries(breakdown).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
  }, [sales, transactions]);

  // 3. Top 3 Productos & Familias
  const { topProducts, topFamilies } = useMemo(() => {
    if (!sales || !families) return { topProducts: [], topFamilies: [] };
    const productStats: Record<string, { name: string, familyId: string, amount: number }> = {};
    const familyStats: Record<string, number> = {};
    let totalIncome = 0;

    for (const sale of sales) {
      if (sale.status === 'CANCELLED') continue;
      for (const item of sale.items || []) {
        if (!item.is_service) {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.editedPrice || item.price) || 0;
          let income = qty * price;
          if (isNaN(income)) income = 0;
          totalIncome += income;

          // Products
          if (!productStats[item.id]) {
            productStats[item.id] = { name: item.name, familyId: item.familyId || item.family_id, amount: 0 };
          }
          productStats[item.id].amount += income;

          // Families
          const famId = item.familyId || item.family_id;
          if (famId) {
            familyStats[famId] = (familyStats[famId] || 0) + income;
          }
        }
      }
    }

    const sortedProducts = Object.values(productStats).map(p => ({ ...p, pct: totalIncome > 0 ? (p.amount / totalIncome) * 100 : 0 })).sort((a, b) => b.amount - a.amount).slice(0, 3);
    const sortedFamilies = Object.entries(familyStats).map(([id, amount]) => {
      const famName = families.find(f => f.id === id)?.name;
      if (!famName) return null; // Filtrar familias no encontradas
      return { id, name: famName, amount, pct: totalIncome > 0 ? (amount / totalIncome) * 100 : 0 };
    }).filter(Boolean).sort((a: any, b: any) => b.amount - a.amount).slice(0, 3) as { id: string, name: string, amount: number, pct: number }[];

    return { topProducts: sortedProducts, topFamilies: sortedFamilies };
  }, [sales, families]);

  // 4. Ranking de Vendedores
  const sellerRanking = useMemo(() => {
    if (!sales || !profiles || !employees) return [];
    const sellerStats: Record<string, number> = {};
    let totalSellersSales = 0;
    for (const sale of sales) {
      if (sale.status === 'CANCELLED') continue;
      let sellerName = 'Propietario';
      if (sale.source_sheet?.startsWith('VENDEDOR:')) {
        sellerName = sale.source_sheet.replace('VENDEDOR:', '');
      }
      sellerStats[sellerName] = (sellerStats[sellerName] || 0) + sale.total;
      totalSellersSales += sale.total;
    }

    return Object.entries(sellerStats).map(([sellerName, total]) => {
      const profile = profiles.find(p => p.username === sellerName);
      const employee = profile?.employee_id ? employees.find(e => e.id === profile.employee_id) : null;
      const displayName = employee ? employee.full_name : sellerName;
      const pct = totalSellersSales > 0 ? (total / totalSellersSales) * 100 : 0;
      return { id: sellerName, name: displayName, total, pct };
    }).sort((a, b) => b.total - a.total);
  }, [sales, profiles, employees]);

  // 5. Chart Data (Ventas por Día u Hora)
  const chartData = useMemo(() => {
    if (!sales) return { items: [], maxVal: 0, totalChartSales: 0 };

    const isToday = dateFilter === "TODAY";
    const daysMap: Record<string, number> = {};
    const dates: string[] = [];

    if (isToday) {
      // Bloques de horas: 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
      const hourBlocks = [8, 10, 12, 14, 16, 18, 20, 22];
      hourBlocks.forEach(h => {
        const key = `${h.toString().padStart(2, '0')}:00`;
        daysMap[key] = 0;
        dates.push(key);
      });

      for (const sale of sales) {
        if (!sale.created_at) continue; // fallback para datos antiguos sin hora
        const d = new Date(sale.created_at);
        const hour = d.getHours();
        // Encontrar el bloque al que pertenece (ej: si es 13:00 va al bloque de 12:00 o 14:00, según redondeo)
        // Redondearemos al bloque anterior más cercano (ej: 13:00 -> 12:00, 09:30 -> 08:00)
        let block = hourBlocks[0];
        for (let i = hourBlocks.length - 1; i >= 0; i--) {
          if (hour >= hourBlocks[i]) {
            block = hourBlocks[i];
            break;
          }
        }
        const key = `${block.toString().padStart(2, '0')}:00`;
        daysMap[key] += sale.total;
      }
    } else {
      // Por día
      const startD = new Date(dateRange.start + 'T00:00:00');
      const endD = new Date(dateRange.end + 'T00:00:00');

      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const ymd = formatYMD(d);
        daysMap[ymd] = 0;
        dates.push(ymd);
      }

      for (const sale of sales) {
        if (daysMap[sale.issue_date] !== undefined) {
          daysMap[sale.issue_date] += sale.total;
        }
      }
    }

    const prevDaysMap: Record<string, number> = {};
    const prevDates: string[] = [];
    if (prevSales && !isToday) {
      const pStartD = new Date(prevDateRange.start + 'T00:00:00');
      const pEndD = new Date(prevDateRange.end + 'T00:00:00');
      for (let d = new Date(pStartD); d <= pEndD; d.setDate(d.getDate() + 1)) {
        const ymd = formatYMD(d);
        prevDaysMap[ymd] = 0;
        prevDates.push(ymd);
      }
      for (const sale of prevSales) {
        if (prevDaysMap[sale.issue_date] !== undefined) {
          prevDaysMap[sale.issue_date] += sale.total;
        }
      }
    }

    let maxVal = 0;
    let totalChartSales = 0;

    const items = dates.map((date, index) => {
      const total = daysMap[date];
      totalChartSales += total;

      const prevDate = prevDates[index];
      const prevTotal = prevDate ? (prevDaysMap[prevDate] || 0) : 0;

      if (total > maxVal) maxVal = total;
      if (prevTotal > maxVal) maxVal = prevTotal;

      let label = date;
      if (!isToday) {
        const [, m, d] = date.split('-');
        label = `${d}/${m}`;
      }
      return { label, total, prevTotal };
    });

    return { items, maxVal, totalChartSales };
  }, [sales, prevSales, dateRange, prevDateRange, dateFilter]);

  // 6. Insights: Día Top y Día Bajo
  const chartInsights = useMemo(() => {
    if (!chartData.items || chartData.items.length === 0 || dateFilter === 'TODAY') return null;
    const now = new Date();
    const todayStr = formatYMD(now);
    // Filtrar solo días que ya pasaron (no futuros con 0 artificial)
    const pastItems = chartData.items.filter(item => {
      // Para items con label dd/mm, reconstruir la fecha
      const [d, m] = item.label.split('/');
      if (!d || !m) return false;
      const year = dateRange.start.split('-')[0];
      const itemDate = `${year}-${m}-${d}`;
      return itemDate <= todayStr && item.total > 0;
    });
    if (pastItems.length === 0) return null;
    const best = pastItems.reduce((a, b) => a.total > b.total ? a : b);
    const worst = pastItems.reduce((a, b) => a.total < b.total ? a : b);
    return { best, worst };
  }, [chartData, dateFilter, dateRange]);

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];


  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-6 h-16 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">Módulo de Dashboard</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Analítica en Tiempo Real</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-screen-xl w-full mx-auto space-y-6">

        {/* ── PowerBI-style Dynamic Filters ── */}
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/20 text-primary font-medium flex items-center gap-1.5 px-3 py-1">
              <Calendar className="w-3.5 h-3.5" /> Periodo Activo
            </Badge>
            <div className="flex bg-secondary p-1 rounded-lg">
              {[
                { id: "TODAY", label: "Hoy" },
                { id: "THIS_WEEK", label: "Esta Semana" },
                { id: "THIS_MONTH", label: "Este Mes" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleQuickFilter(tab.id as DateFilter)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${dateFilter === tab.id
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary-foreground/5"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${dateFilter === "CUSTOM" ? "bg-primary/5 border-primary/30" : "bg-secondary/30 border-border/50"}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-wider pl-1 hidden lg:block ${dateFilter === "CUSTOM" ? "text-primary" : "text-muted-foreground"}`}>
              Rango Personalizado:
            </div>
            <select
              value={selectedDay}
              onChange={(e) => handleCustomFilter("DAY", e.target.value)}
              className={`h-8 px-1 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium w-16 ${dateFilter === "CUSTOM" ? "border-primary/50 bg-background text-foreground" : "border-input bg-background/50 text-muted-foreground"}`}
            >
              <option value="">Día</option>
              {Array.from({ length: selectedMonth === "" ? 31 : new Date(selectedYear === "" ? new Date().getFullYear() : selectedYear, (selectedMonth as number) + 1, 0).getDate() }).map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => handleCustomFilter("MONTH", e.target.value)}
              className={`h-8 px-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium ${dateFilter === "CUSTOM" ? "border-primary/50 bg-background text-foreground" : "border-input bg-background/50 text-muted-foreground"}`}
            >
              <option value="">Todos los meses</option>
              {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => handleCustomFilter("YEAR", e.target.value)}
              className={`h-8 px-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium w-24 ${dateFilter === "CUSTOM" ? "border-primary/50 bg-background text-foreground" : "border-input bg-background/50 text-muted-foreground"}`}
            >
              <option value="" disabled>Año</option>
              {[2023, 2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── TOP KPIs ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Facturado (Tarjeta Principal) */}
          {(() => {
            const isAlert = !salesTrend.noData && salesTrend.status === 'red';
            return (
              <Card className={`relative overflow-hidden transition-colors border-transparent shadow-lg text-white ${isAlert ? 'bg-gradient-to-br from-rose-600 to-rose-800 shadow-rose-600/20' : 'bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-indigo-500/20'}`}>
                <div className={`absolute right-[-10%] top-[-10%] opacity-10 text-white`}>
                  <DollarSign className="w-48 h-48" />
                </div>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 relative z-10">
                  <CardTitle className={`font-medium text-white/80`}>
                    Total Facturado
                  </CardTitle>
                  <Badge variant="outline" className={`font-medium border-white/30 text-white bg-white/20 hover:bg-white/20`}>
                    {totalOrders} órdenes
                  </Badge>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className={`text-4xl font-black tabular-nums tracking-tight`}>S/ {totalSalesAmount.toFixed(2)}</div>
                  <div className="mt-2">
                    {salesTrend.noData ? (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1 bg-white/20 text-white`}>Sin datos previos</span>
                    ) : (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1 bg-white/20 text-white`}>
                        {salesTrend.status === 'green' ? <TrendingUp className="w-3 h-3" /> : salesTrend.status === 'red' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {salesTrend.pct > 0 ? '+' : ''}{salesTrend.pct.toFixed(1)}% vs previo (S/ {prevSalesAmount.toFixed(2)})
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* 2. Rendimiento del Periodo (Fusión) */}
          <Card className="bg-card border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground font-medium text-sm uppercase tracking-wider font-bold">Rendimiento del Periodo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Volumen</p>
                  <p className={`text-xl font-black ${ordersTrend.status === 'green' ? 'text-emerald-700' : ordersTrend.status === 'red' ? 'text-rose-700' : 'text-slate-700'}`}>{totalOrders}</p>
                  {ordersTrend.noData ? (
                    <span className="text-[10px] bg-slate-50 text-slate-600 font-medium px-1.5 py-0.5 rounded-md w-fit">Sin datos</span>
                  ) : ordersTrend.status === 'green' ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +{ordersTrend.pct.toFixed(1)}%</span>
                  ) : ordersTrend.status === 'red' ? (
                    <span className="text-[10px] bg-rose-50 text-rose-700 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {ordersTrend.pct.toFixed(1)}%</span>
                  ) : (
                    <span className="text-[10px] bg-slate-50 text-slate-600 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5">0%</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Ticket Prom.</p>
                  <p className={`text-xl font-black ${ticketTrend.status === 'green' ? 'text-emerald-700' : ticketTrend.status === 'red' ? 'text-rose-700' : 'text-slate-700'}`}>S/ {avgTicket.toFixed(0)}</p>
                  {ticketTrend.noData ? (
                    <span className="text-[10px] bg-slate-50 text-slate-600 font-medium px-1.5 py-0.5 rounded-md w-fit">Sin datos</span>
                  ) : ticketTrend.status === 'green' ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +{ticketTrend.pct.toFixed(1)}%</span>
                  ) : ticketTrend.status === 'red' ? (
                    <span className="text-[10px] bg-rose-50 text-rose-700 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {ticketTrend.pct.toFixed(1)}%</span>
                  ) : (
                    <span className="text-[10px] bg-slate-50 text-slate-600 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5">0%</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Órdenes/Día</p>
                  <p className={`text-xl font-black ${ordersPerDayTrend.status === 'green' ? 'text-emerald-700' : ordersPerDayTrend.status === 'red' ? 'text-rose-700' : 'text-slate-700'}`}>{avgOrdersPerDay.toFixed(0)}</p>
                  {ordersPerDayTrend.noData ? (
                    <span className="text-[10px] bg-slate-50 text-slate-600 font-medium px-1.5 py-0.5 rounded-md w-fit">Sin datos</span>
                  ) : ordersPerDayTrend.status === 'green' ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +{ordersPerDayTrend.pct.toFixed(1)}%</span>
                  ) : ordersPerDayTrend.status === 'red' ? (
                    <span className="text-[10px] bg-rose-50 text-rose-700 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {ordersPerDayTrend.pct.toFixed(1)}%</span>
                  ) : (
                    <span className="text-[10px] bg-slate-50 text-slate-600 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5">0%</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Ventas/Día</p>
                  <p className={`text-xl font-black ${salesPerDayTrend.status === 'green' ? 'text-emerald-700' : salesPerDayTrend.status === 'red' ? 'text-rose-700' : 'text-slate-700'}`}>S/ {avgSalesPerDay.toFixed(0)}</p>
                  {salesPerDayTrend.noData ? (
                    <span className="text-[10px] bg-slate-50 text-slate-600 font-medium px-1.5 py-0.5 rounded-md w-fit">Sin datos</span>
                  ) : salesPerDayTrend.status === 'green' ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +{salesPerDayTrend.pct.toFixed(1)}%</span>
                  ) : salesPerDayTrend.status === 'red' ? (
                    <span className="text-[10px] bg-rose-50 text-rose-700 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {salesPerDayTrend.pct.toFixed(1)}%</span>
                  ) : (
                    <span className="text-[10px] bg-slate-50 text-slate-600 font-medium px-1.5 py-0.5 rounded-md w-fit inline-flex items-center gap-0.5">0%</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Conversión Proformas */}
          <Card className="bg-card border border-border shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-muted-foreground font-medium text-sm uppercase tracking-wider font-bold">Conversión Proformas</CardTitle>
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-black tabular-nums tracking-tight ${proformaStats.conversionPct >= 70 ? 'text-emerald-600' : proformaStats.conversionPct < 40 ? 'text-rose-600' : 'text-amber-600'}`}>
                {proformaStats.conversionPct.toFixed(0)}%
              </div>
              <div className="mt-2 flex flex-col gap-1 text-[10px] font-bold">
                <span className="text-slate-500">Emitidas: {proformaStats.emitidas}</span>
                <span className="text-emerald-600">Ejecutadas: {proformaStats.ejecutadas}</span>
                <span className="text-red-500">Anuladas: {proformaStats.anuladas}</span>
              </div>
            </CardContent>
          </Card>

          {/* 4. Ranking de Vendedores (movido aquí) */}
          <Card className="bg-card border border-border shadow-sm flex flex-col">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-muted-foreground font-medium text-sm uppercase tracking-wider font-bold">Top Vendedores</CardTitle>
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-indigo-500" />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 max-h-[180px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40px] text-center font-bold text-[10px] uppercase text-muted-foreground py-2">#</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2">Vendedor</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase text-muted-foreground py-2">Ventas</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase text-muted-foreground py-2">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellerRanking.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground font-medium text-sm border-none">
                        Vacío
                      </TableCell>
                    </TableRow>
                  ) : (
                    sellerRanking.slice(0, 5).map((seller, i) => (
                      <TableRow key={seller.id} className="hover:bg-secondary/30 border-border/50 last:border-0 transition-colors">
                        <TableCell className="text-center px-2 py-2">
                          <div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[10px] font-black shrink-0
                            ${i === 0 ? 'bg-amber-100 text-amber-600' :
                              i === 1 ? 'bg-slate-200 text-slate-600' :
                                i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-secondary text-muted-foreground'}`}>
                            {i === 0 ? <Medal className="w-3.5 h-3.5" /> : i + 1}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                              {seller.name.substring(0, 2)}
                            </div>
                            <span className="font-bold text-[11px] whitespace-normal break-words capitalize truncate max-w-[80px]" title={seller.name}>{seller.name.toLowerCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-2 py-2 font-black tabular-nums text-primary text-[11px]">
                          S/ {seller.total.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right px-2 py-2 font-bold tabular-nums text-muted-foreground text-[10px]">
                          {seller.pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* ── Chart ── */}
        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                Evolución de Ventas
                <span className="text-[10px] font-normal lowercase bg-secondary px-2 py-0.5 rounded ml-2">({dateFilter === "TODAY" ? "Por horas" : dateRange.start + ' al ' + dateRange.end})</span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 h-72">
                {chartData.items.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <BarChart3 className="w-8 h-8 mb-2" />
                    <p className="text-sm font-medium">Sin datos para graficar</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.items} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `S/${v}`} />
                      <RechartsTooltip
                        formatter={(value: any, name: any) => {
                          const label = name === 'prevTotal' ? 'Periodo Previo' : 'Periodo Actual';
                          return [`S/ ${Number(value).toFixed(2)}`, label];
                        }}
                        labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      {(dateFilter === 'THIS_MONTH' || dateFilter === 'THIS_WEEK' || dateFilter === 'CUSTOM') && (
                        <Area type="monotone" dataKey="prevTotal" name="prevTotal" stroke="#94a3b8" strokeDasharray="4 4" fillOpacity={1} fill="url(#colorPrev)" />
                      )}
                      <Area type="monotone" dataKey="total" name="total" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {chartInsights && (
                <div className="w-full lg:w-56 flex flex-col gap-4 justify-center">
                  <div className="border-l-4 border-emerald-500 bg-slate-50 rounded-r-lg p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Día Top: {chartInsights.best.label}</p>
                    <p className="text-lg font-black text-emerald-700">S/ {chartInsights.best.total.toFixed(0)}</p>
                  </div>
                  <div className="border-l-4 border-rose-500 bg-slate-50 rounded-r-lg p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Día Bajo: {chartInsights.worst.label}</p>
                    <p className="text-lg font-black text-rose-700">S/ {chartInsights.worst.total.toFixed(0)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Analytics Grid (3 columnas) ── */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Cuadre por Método de Pago */}
          <Card className="bg-card border border-border shadow-sm flex flex-col">
            <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                Cuadre de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 relative">
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 py-2">
                {paymentMethods.length === 0 ? (
                  <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-4">
                    <p className="text-sm font-medium">Vacío</p>
                  </div>
                ) : (
                  <>
                    <div className="w-full md:w-1/2 h-full flex items-center justify-center relative" style={{ minHeight: '180px' }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={paymentMethods}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={3}
                            dataKey="amount"
                            nameKey="method"
                            stroke="none"
                          >
                            {paymentMethods.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(val: any) => `S/ ${Number(val).toFixed(2)}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[9px] text-muted-foreground font-bold uppercase">Total</span>
                        <span className="text-xs font-black">S/ {totalSalesAmount.toFixed(0)}</span>
                      </div>
                    </div>

                    <div className="w-full md:w-1/2 flex flex-col justify-center gap-3 px-2 pb-2">
                      {paymentMethods.map((pm, i) => {
                        const pct = totalSalesAmount > 0 ? (pm.amount / totalSalesAmount) * 100 : 0;
                        return (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="font-bold uppercase truncate" title={pm.method}>{pm.method}</span>
                            </div>
                            <div className="flex items-center justify-end gap-2 shrink-0">
                              <span className="tabular-nums font-black text-primary">S/ {pm.amount.toFixed(0)}</span>
                              <span className="tabular-nums font-bold text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Familias */}
          <Card className="bg-card border border-border shadow-sm flex flex-col">
            <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Tag className="w-4 h-4 text-amber-500" />
                Top Familias
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 h-64">
              {topFamilies.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-4">
                  <p className="text-sm font-medium">Vacío</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topFamilies} layout="vertical" margin={{ top: 0, right: 90, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#475569' }} width={110} />
                    <RechartsTooltip
                      formatter={(val: any) => [`S/ ${Number(val).toFixed(2)}`, 'Ingreso']}
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="amount" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={24}>
                      <LabelList
                        dataKey="amount"
                        position="right"
                        content={(props: any) => {
                          const { x, y, width, height, value, index } = props;
                          if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return null;
                          const pct = topFamilies[index]?.pct || 0;
                          const xPos = x + (width || 0) + 8;
                          const yPos = y + (height || 0) / 2 + 4;
                          return (
                            <text x={xPos} y={yPos} fill="#475569" fontSize={10} fontWeight="bold">
                              S/ {Number(value).toFixed(2)} ({pct.toFixed(0)}%)
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Productos */}
          <Card className="bg-card border border-border shadow-sm flex flex-col">
            <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Package className="w-4 h-4 text-blue-500" />
                Top Productos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 h-64">
              {topProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-4">
                  <p className="text-sm font-medium">Vacío</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 90, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#475569' }} width={110} />
                    <RechartsTooltip
                      formatter={(val: any) => [`S/ ${Number(val).toFixed(2)}`, 'Ingreso']}
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24}>
                      <LabelList
                        dataKey="amount"
                        position="right"
                        content={(props: any) => {
                          const { x, y, width, height, value, index } = props;
                          if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return null;
                          const pct = topProducts[index]?.pct || 0;
                          const xPos = x + (width || 0) + 8;
                          const yPos = y + (height || 0) / 2 + 4;
                          return (
                            <text x={xPos} y={yPos} fill="#475569" fontSize={10} fontWeight="bold">
                              S/ {Number(value).toFixed(2)} ({pct.toFixed(0)}%)
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
