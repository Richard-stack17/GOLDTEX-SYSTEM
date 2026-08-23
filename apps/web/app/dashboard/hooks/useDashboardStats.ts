import { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, syncCatalog } from "../../lib/localDb";
import { useStore } from "../../context/StoreContext";

export type DateFilter = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "THIS_YEAR" | "CUSTOM" | "ALL_TIME";

const formatYMD = (date: Date): string => {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0]!;
};

export function useDashboardStats() {
  const { activeStore, activeStoreId, isAllStoresMode, isLoadingStores, availableStoreIds } = useStore();
  const [dateFilter, setDateFilter] = useState<DateFilter>("THIS_WEEK");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number | "">(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | "">(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number | "">("");

  // Sync when store context resolves or active store changes
  useEffect(() => {
    if (isLoadingStores) return;
    if (typeof window !== 'undefined' && navigator.onLine) {
      if (isAllStoresMode) {
        syncCatalog();
      } else if (activeStoreId) {
        syncCatalog(activeStoreId);
      }
    }
  }, [activeStoreId, isAllStoresMode, isLoadingStores]);

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
    } else if (dateFilter === "THIS_YEAR") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    } else if (dateFilter === "ALL_TIME") {
      start = new Date(2020, 0, 1);
      end = new Date(now.getFullYear() + 1, 11, 31);
    } else if (dateFilter === "CUSTOM") {
      if (customStartDate && customEndDate) {
        const startStr = customStartDate <= customEndDate ? customStartDate : customEndDate;
        const endStr = customStartDate <= customEndDate ? customEndDate : customStartDate;
        return { start: startStr, end: endStr };
      }
      if (customStartDate && !customEndDate) {
        return { start: customStartDate, end: customStartDate };
      }
      if (!customStartDate && customEndDate) {
        return { start: customEndDate, end: customEndDate };
      }
      const y = selectedYear === "" ? now.getFullYear() : (selectedYear as number);
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

    const finalStart = formatYMD(start);
    const finalEnd = formatYMD(end);
    const safeStart = finalStart <= finalEnd ? finalStart : finalEnd;
    const safeEnd = finalStart <= finalEnd ? finalEnd : finalStart;

    return { start: safeStart, end: safeEnd };
  }, [dateFilter, customStartDate, customEndDate, selectedYear, selectedMonth, selectedDay]);

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
    } else if (dateFilter === "THIS_YEAR") {
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31);
    } else if (dateFilter === "ALL_TIME") {
      start = new Date(2015, 0, 1);
      end = new Date(2019, 11, 31);
    } else if (dateFilter === "CUSTOM") {
      if (customStartDate && customEndDate) {
        const validStart = customStartDate <= customEndDate ? customStartDate : customEndDate;
        const validEnd = customStartDate <= customEndDate ? customEndDate : customStartDate;
        const dStart = new Date(validStart + 'T00:00:00');
        const dEnd = new Date(validEnd + 'T00:00:00');
        const diffMs = Math.max(0, dEnd.getTime() - dStart.getTime());
        const pEnd = new Date(dStart.getTime() - 1000 * 60 * 60 * 24);
        const pStart = new Date(pEnd.getTime() - diffMs);
        return { start: formatYMD(pStart), end: formatYMD(pEnd) };
      }
      const y = selectedYear === "" ? now.getFullYear() : (selectedYear as number);
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

    const pStart = formatYMD(start);
    const pEnd = formatYMD(end);
    return { start: pStart <= pEnd ? pStart : pEnd, end: pStart <= pEnd ? pEnd : pStart };
  }, [dateFilter, customStartDate, customEndDate, selectedYear, selectedMonth, selectedDay]);

  // ── Database Queries ──
  const rawSales = useLiveQuery(
    () => db.sales.where('issue_date').between(dateRange.start!, dateRange.end, true, true).toArray(),
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
      s.status !== 'PENDING' &&
      s.parent_sale_id == null &&
      (isAllStoresMode ? availableStoreIds.includes(s.store_id || '') : s.store_id === activeStoreId)
    );
  }, [rawSales, isAllStoresMode, activeStoreId, availableStoreIds]);

  const prevSales = useMemo(() => {
    if (!rawPrevSales) return [];
    return rawPrevSales.filter(s =>
      s.status !== 'CANCELLED' &&
      s.status !== 'PENDING' &&
      s.parent_sale_id == null &&
      (isAllStoresMode ? availableStoreIds.includes(s.store_id || '') : s.store_id === activeStoreId)
    );
  }, [rawPrevSales, isAllStoresMode, activeStoreId, availableStoreIds]);

  const transactions = useLiveQuery(() => db.transactions.toArray(), [], []);
  const employees = useLiveQuery(() => db.employees.toArray(), [], []);
  const profiles = useLiveQuery(() => db.profiles.toArray(), [], []);
  const families = useLiveQuery(() => db.families.toArray(), [], []);
  const products = useLiveQuery(() => db.products.toArray(), [], []);

  // ── Handlers ──
  const handleQuickFilter = (filter: DateFilter) => {
    setDateFilter(filter);
    if (filter !== "CUSTOM") {
      setSelectedYear(new Date().getFullYear());
      setSelectedMonth(new Date().getMonth());
      setSelectedDay("");
      setCustomStartDate("");
      setCustomEndDate("");
    }
  };

  const handleSetStartDate = (dateStr: string) => {
    setDateFilter("CUSTOM");
    setCustomStartDate(dateStr);
    if (!dateStr) return;

    // Si hay fecha final y la fecha inicial es posterior, auto-ajustamos la final
    if (customEndDate && dateStr > customEndDate) {
      setCustomEndDate(dateStr);
    }

    // Sincronizar automáticamente selectores de Año y Mes
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0] && parts[1]) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // 0-indexed
      if (!isNaN(y)) setSelectedYear(y);
      if (!isNaN(m)) setSelectedMonth(m);
    }
  };

  const handleSetEndDate = (dateStr: string) => {
    setDateFilter("CUSTOM");
    setCustomEndDate(dateStr);
    if (!dateStr) return;

    // Si hay fecha inicial y la fecha final es anterior, auto-ajustamos la inicial
    if (customStartDate && dateStr < customStartDate) {
      setCustomStartDate(dateStr);
    }

    // Sincronizar selectores si no estaban definidos
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0] && parts[1]) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && selectedYear === "") setSelectedYear(y);
      if (!isNaN(m) && selectedMonth === "") setSelectedMonth(m);
    }
  };

  const handleMonthChange = (monthVal: number | "" | string) => {
    setDateFilter("CUSTOM");
    const m = monthVal === "" ? "" : Number(monthVal);
    setSelectedMonth(m);
    const now = new Date();
    const y = selectedYear !== "" ? Number(selectedYear) : now.getFullYear();

    if (m === "") {
      // Todo el año seleccionado
      setCustomStartDate(formatYMD(new Date(y, 0, 1)));
      setCustomEndDate(formatYMD(new Date(y, 11, 31)));
    } else {
      // Rango completo del mes seleccionado
      setCustomStartDate(formatYMD(new Date(y, Number(m), 1)));
      setCustomEndDate(formatYMD(new Date(y, Number(m) + 1, 0)));
    }
  };

  const handleYearChange = (yearVal: number | "" | string) => {
    setDateFilter("CUSTOM");
    const y = yearVal === "" ? "" : Number(yearVal);
    setSelectedYear(y);
    if (y === "") return;

    const m = selectedMonth !== "" ? Number(selectedMonth) : "";
    if (m === "") {
      setCustomStartDate(formatYMD(new Date(Number(y), 0, 1)));
      setCustomEndDate(formatYMD(new Date(Number(y), 11, 31)));
    } else {
      setCustomStartDate(formatYMD(new Date(Number(y), Number(m), 1)));
      setCustomEndDate(formatYMD(new Date(Number(y), Number(m) + 1, 0)));
    }
  };

  const handleCustomFilter = (type: "YEAR" | "MONTH" | "DAY", val: string | number) => {
    setDateFilter("CUSTOM");
    if (type === "YEAR") {
      handleYearChange(val);
    } else if (type === "MONTH") {
      handleMonthChange(val);
    } else if (type === "DAY") {
      setSelectedDay(val === "" ? "" : Number(val));
    }
  };

  // ── Métricas y Analítica ──
  const totalSalesAmount = useMemo(() => {
    if (!sales) return 0;
    return sales.reduce((sum, s) => sum + (s.total || 0), 0);
  }, [sales]);

  const prevSalesAmount = useMemo(() => {
    if (!prevSales) return 0;
    return prevSales.reduce((sum, s) => sum + (s.total || 0), 0);
  }, [prevSales]);

  const totalOrders = sales ? sales.length : 0;
  const prevTotalOrders = prevSales ? prevSales.length : 0;

  const avgTicket = useMemo(() => {
    if (totalOrders === 0) return 0;
    return totalSalesAmount / totalOrders;
  }, [totalSalesAmount, totalOrders]);

  const prevAvgTicket = useMemo(() => {
    if (prevTotalOrders === 0) return 0;
    return prevSalesAmount / prevTotalOrders;
  }, [prevSalesAmount, prevTotalOrders]);

  const daysInPeriod = useMemo(() => {
    const start = new Date((dateRange.start!) + 'T00:00:00');
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

  // 2. Lógica de Comparativa "Vs Previo" con Redondeo Entero Estricto y Protección División x Cero
  const computeTrend = (current: number, prev: number) => {
    if (!prev || prev === 0 || isNaN(prev)) {
      if (current > 0) return { pct: 100, status: 'green' as const, noData: false, current, prev: 0 };
      return { pct: 0, status: 'neutral' as const, noData: true, current, prev: 0 };
    }
    const diff = current - prev;
    const pct = Math.round((diff / prev) * 100);
    const status = pct > 0 ? ('green' as const) : pct < 0 ? ('red' as const) : ('neutral' as const);
    return { pct, status, noData: false, current, prev };
  };

  const salesTrend = useMemo(() => {
    return computeTrend(totalSalesAmount, prevSalesAmount);
  }, [totalSalesAmount, prevSalesAmount]);

  const ordersTrend = useMemo(() => {
    return computeTrend(totalOrders, prevTotalOrders);
  }, [totalOrders, prevTotalOrders]);

  const ticketTrend = useMemo(() => {
    return computeTrend(avgTicket, prevAvgTicket);
  }, [avgTicket, prevAvgTicket]);

  const ordersPerDayTrend = useMemo(() => {
    return computeTrend(avgOrdersPerDay, prevAvgOrdersPerDay);
  }, [avgOrdersPerDay, prevAvgOrdersPerDay]);

  const salesPerDayTrend = useMemo(() => {
    return computeTrend(avgSalesPerDay, prevAvgSalesPerDay);
  }, [avgSalesPerDay, prevAvgSalesPerDay]);

  // 3. Eficiencia de Proformas Mostrador
  const proformaStats = useMemo(() => {
    if (!rawSales) return { emitidas: 0, ejecutadas: 0, anuladas: 0, conversionPct: 0, total: 0, completed: 0, rate: 0 };
    const counterProformas = rawSales.filter(s =>
      s.source_type !== 'CONSOLIDATED' &&
      s.parent_sale_id == null &&
      (isAllStoresMode ? availableStoreIds.includes(s.store_id || '') : s.store_id === activeStoreId)
    );
    const emitidas = counterProformas.length;
    let ejecutadas = 0;
    let anuladas = 0;
    for (const s of counterProformas) {
      if (s.status === 'COMPLETED' || s.status === 'PAID') ejecutadas++;
      else if (s.status === 'CANCELLED') anuladas++;
    }
    const conversionPct = emitidas > 0 ? Math.round((ejecutadas / emitidas) * 100) : 0;
    return { emitidas, ejecutadas, anuladas, conversionPct, total: emitidas, completed: ejecutadas, rate: conversionPct };
  }, [rawSales, isAllStoresMode, activeStoreId, availableStoreIds]);

  const prevProformaStats = useMemo(() => {
    if (!rawPrevSales) return { emitidas: 0, ejecutadas: 0, anuladas: 0, conversionPct: 0, total: 0, completed: 0, rate: 0 };
    const counterProformas = rawPrevSales.filter(s =>
      s.source_type !== 'CONSOLIDATED' &&
      s.parent_sale_id == null &&
      (isAllStoresMode ? availableStoreIds.includes(s.store_id || '') : s.store_id === activeStoreId)
    );
    const emitidas = counterProformas.length;
    let ejecutadas = 0;
    let anuladas = 0;
    for (const s of counterProformas) {
      if (s.status === 'COMPLETED' || s.status === 'PAID') ejecutadas++;
      else if (s.status === 'CANCELLED') anuladas++;
    }
    const conversionPct = emitidas > 0 ? Math.round((ejecutadas / emitidas) * 100) : 0;
    return { emitidas, ejecutadas, anuladas, conversionPct, total: emitidas, completed: ejecutadas, rate: conversionPct };
  }, [rawPrevSales, isAllStoresMode, activeStoreId, availableStoreIds]);

  // 4. Cuadre por Método de Pago
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

  // 5. Top Productos & Familias (Telas / Inventario Físico)
  const { topProducts, topFamilies, totalProductsIncome } = useMemo(() => {
    const productStats: Record<string, { id: string, name: string, code?: string, familyId: string, quantity: number, amount: number }> = {};
    const familyStats: Record<string, { id: string, name: string, quantity: number, amount: number }> = {};

    // 1. Inicializar con catálogo activo
    for (const p of products || []) {
      if ((p as any).is_active === false) continue;
      const prodKey = p.id || p.code || p.name;
      productStats[prodKey] = {
        id: p.id || prodKey,
        name: p.name || 'Sin Nombre',
        code: p.code || p.sku || '',
        familyId: p.family_id || '',
        quantity: 0,
        amount: 0
      };
    }

    for (const f of families || []) {
      if ((f as any).is_active === false) continue;
      familyStats[f.id] = { id: f.id, name: f.name, quantity: 0, amount: 0 };
    }

    let totalProdIncome = 0;

    for (const sale of sales || []) {
      if (sale.status === 'CANCELLED') continue;
      for (const item of sale.items || []) {
        if (!item.is_service) {
          const qty = Number(item.quantity ?? item.qty ?? item.cant ?? 0) || 0;
          const price = Number(item.editedPrice ?? item.price ?? 0) || 0;
          let income = qty * price;
          if (isNaN(income)) income = 0;
          totalProdIncome += income;

          const prodKey = item.id || item.code || item.name;
          if (!productStats[prodKey]) {
            productStats[prodKey] = {
              id: item.id || prodKey,
              name: item.name || 'Sin Nombre',
              code: item.code || item.sku || '',
              familyId: item.familyId || item.family_id || '',
              quantity: 0,
              amount: 0
            };
          }
          productStats[prodKey].quantity += qty;
          productStats[prodKey].amount += income;

          const famId = item.familyId || item.family_id;
          if (famId) {
            const famName = families?.find(f => f.id === famId)?.name || 'Otros';
            if (!familyStats[famId]) {
              familyStats[famId] = { id: famId, name: famName, quantity: 0, amount: 0 };
            }
            familyStats[famId].quantity += qty;
            familyStats[famId].amount += income;
          }
        }
      }
    }

    const sortedProducts = Object.values(productStats).map(p => ({
      ...p,
      pct: totalProdIncome > 0 ? Math.round((p.amount / totalProdIncome) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    const sortedFamilies = Object.values(familyStats).map(f => ({
      ...f,
      pct: totalProdIncome > 0 ? Math.round((f.amount / totalProdIncome) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    return { topProducts: sortedProducts, topFamilies: sortedFamilies, totalProductsIncome: totalProdIncome };
  }, [sales, families, products]);

  // 6. Ingresos por Servicios Realizados
  const servicesStats = useMemo(() => {
    if (!sales) return { totalServicesAmount: 0, servicesList: [] };
    const breakdown: Record<string, { name: string; amount: number; count: number }> = {};
    let totalServicesAmount = 0;

    for (const sale of sales) {
      if (sale.status === 'CANCELLED') continue;
      for (const item of sale.items || []) {
        if (item.is_service) {
          const qty = Number(item.quantity ?? item.qty ?? item.cant ?? 1) || 1;
          const price = Number(item.editedPrice ?? item.price ?? 0) || 0;
          let income = qty * price;
          if (isNaN(income)) income = 0;

          const serviceName = (item.name || 'Servicio General').trim().toUpperCase();
          if (!breakdown[serviceName]) {
            breakdown[serviceName] = { name: serviceName, amount: 0, count: 0 };
          }
          breakdown[serviceName].amount += income;
          breakdown[serviceName].count += qty;
          totalServicesAmount += income;
        }
      }
    }

    const servicesList = Object.values(breakdown).map(s => ({
      name: s.name,
      amount: s.amount,
      count: s.count,
      pct: totalServicesAmount > 0 ? Math.round((s.amount / totalServicesAmount) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    return { totalServicesAmount, servicesList };
  }, [sales]);

  // 6. Ranking por Atención de Proformas
  const sellerRanking = useMemo(() => {
    if (!sales || !profiles || !employees) return [];
    const sellerStats: Record<string, { total: number; count: number }> = {};
    let totalSellersSales = 0;

    for (const sale of sales) {
      if (sale.status !== 'COMPLETED') continue;

      let sellerKey = 'ADMIN';

      if ((sale as any).seller_id) {
        const foundProf = profiles.find(p => p.id === (sale as any).seller_id);
        if (foundProf) {
          sellerKey = foundProf.username;
        }
      } else if (rawSales) {
        // Si es un consolidado sin seller_id directo, buscar en sus proformas hijas
        const child = rawSales.find(cs => cs.parent_sale_id === sale.id && (cs as any).seller_id);
        if (child && (child as any).seller_id) {
          const foundProf = profiles.find(p => p.id === (child as any).seller_id);
          if (foundProf) {
            sellerKey = foundProf.username;
          }
        } else if ((sale as any).seller?.username) {
          const foundProf = profiles.find(p => p.username.toLowerCase() === (sale as any).seller.username.toLowerCase());
          if (foundProf) {
            sellerKey = foundProf.username;
          }
        }
      } else if ((sale as any).seller?.username) {
        const foundProf = profiles.find(p => p.username.toLowerCase() === (sale as any).seller.username.toLowerCase());
        if (foundProf) {
          sellerKey = foundProf.username;
        }
      }

      if (!sellerStats[sellerKey]) {
        sellerStats[sellerKey] = { total: 0, count: 0 };
      }
      sellerStats[sellerKey]!.total += sale.total;
      sellerStats[sellerKey]!.count += 1;
      totalSellersSales += sale.total;
    }

    return Object.entries(sellerStats).map(([sellerName, stats]) => {
      const profile = profiles.find(p => p.username === sellerName);
      const employee = profile?.employee_id ? employees.find(e => e.id === profile.employee_id) : null;
      const displayName = employee ? employee.full_name : sellerName;
      const pct = totalSellersSales > 0 ? Math.round((stats.total / totalSellersSales) * 100) : 0;
      return { id: sellerName, name: displayName, total: stats.total, count: stats.count, pct };
    }).sort((a, b) => b.total - a.total);
  }, [sales, profiles, employees]);

  // 7. Chart Data (Ventas por Día u Hora)
  const chartData = useMemo(() => {
    if (!sales) return { items: [], maxVal: 0, totalChartSales: 0 };

    const isToday = dateFilter === "TODAY";
    const daysMap: Record<string, number> = {};
    const dates: string[] = [];

    if (isToday) {
      const hourBlocks = [8, 10, 12, 14, 16, 18, 20, 22];
      hourBlocks.forEach(h => {
        const key = `${h.toString().padStart(2, '0')}:00`;
        daysMap[key] = 0;
        dates.push(key);
      });

      for (const sale of sales) {
        if (!sale.created_at) continue;
        const d = new Date(sale.created_at);
        let hour = d.getUTCHours() - 5;
        if (hour < 0) hour += 24;
        let block = hourBlocks[0] || 0;
        for (let i = hourBlocks.length - 1; i >= 0; i--) {
          const hb = hourBlocks[i];
          if (hb !== undefined && hour >= hb) {
            block = hb;
            break;
          }
        }
        const key = `${block.toString().padStart(2, '0')}:00`;
        if (daysMap[key] !== undefined) {
          daysMap[key] += sale.total;
        }
      }
    } else {
      const startD = new Date((dateRange.start!) + 'T00:00:00');
      const endD = new Date(dateRange.end + 'T00:00:00');

      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const ymd = formatYMD(d);
        daysMap[ymd] = 0;
        dates.push(ymd);
      }

      for (const sale of sales) {
        daysMap[sale.issue_date] = (daysMap[sale.issue_date] || 0) + sale.total;
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
        prevDaysMap[sale.issue_date] = (prevDaysMap[sale.issue_date] || 0) + sale.total;
      }
    }

    let maxVal = 0;
    let totalChartSales = 0;

    const items = dates.map((date, index) => {
      const total = daysMap[date] || 0;
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

  // 8. Insights: Día Top y Día Bajo
  const chartInsights = useMemo(() => {
    if (!chartData.items || chartData.items.length === 0 || dateFilter === 'TODAY') return null;
    const now = new Date();
    const todayStr = formatYMD(now);
    const pastItems = chartData.items.filter(item => {
      const [d, m] = item.label.split('/');
      if (!d || !m) return false;
      const year = (dateRange.start!).split('-')[0];
      const itemDate = `${year}-${m}-${d}`;
      return itemDate <= todayStr && item.total > 0;
    });
    if (pastItems.length === 0) return null;
    const best = pastItems.reduce((a, b) => a.total > b.total ? a : b);
    const worst = pastItems.reduce((a, b) => a.total < b.total ? a : b);
    return { best, worst };
  }, [chartData, dateFilter, dateRange]);

  // SWR: Cache the data so it doesn't flash to zero
  const [cachedData, setCachedData] = useState<any>(null);

  const currentData = {
    dateFilter, setDateFilter,
    customStartDate, setCustomStartDate,
    customEndDate, setCustomEndDate,
    selectedYear, setSelectedYear,
    selectedMonth, setSelectedMonth,
    selectedDay, setSelectedDay,
    handleQuickFilter, handleCustomFilter,
    handleSetStartDate, handleSetEndDate,
    handleMonthChange, handleYearChange,
    dateRange,
    rawSales, rawPrevSales,
    transactions, employees, profiles, families,
    sales, prevSales,
    totalSalesAmount, prevSalesAmount,
    salesTrend, totalOrders, ordersTrend,
    avgTicket, ticketTrend, avgOrdersPerDay, ordersPerDayTrend,
    avgSalesPerDay, salesPerDayTrend, proformaStats,
    chartData, chartInsights, paymentMethods,
    topProducts, topFamilies, sellerRanking,
    servicesStats, totalProductsIncome,
    isLoadingData: rawSales === undefined
  };

  useEffect(() => {
    if (rawSales !== undefined && transactions !== undefined) {
      setCachedData(currentData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawSales, transactions, dateFilter, customStartDate, customEndDate, selectedYear, selectedMonth, selectedDay, activeStoreId]);

  return cachedData || currentData;
}
