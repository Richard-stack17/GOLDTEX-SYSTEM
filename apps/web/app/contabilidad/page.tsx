'use client';

import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
  Download, Calendar, CheckCircle2, AlertCircle, BarChart3,
  Eye, Database, ArrowLeft, RefreshCw, Landmark, Maximize2, Minimize2, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRole } from '../context/RoleContext';
import { useStore } from '../context/StoreContext';
import { AccessDeniedView } from '../components/AccessDeniedView';
import StoreSwitcher from "../components/StoreSwitcher";
import Link from 'next/link';
import { useIsNativeAndroid } from '../lib/platform';

import { ExcelRow } from './types';
import ContabilidadTable from './components/ContabilidadTable';

// ─── Peru / Lima helpers ──────────────────────────────────────────────────────
const limaToday = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()); // YYYY-MM-DD
};

/** YYYY-MM-DD → DD-MM-YYYY for display */
const displayDate = (iso: string) => {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

/** YYYY-MM-DD → DD/MM/YY for Excel */
const excelDate = (iso: string) => {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y!.slice(2)}`;
};

const fmt = (n: number) => (n === 0 ? '—' : `S/ ${n.toFixed(2)}`);

/** Derive bank label for DETALLE column (never "Efectivo") */
const deriveBankLabel = (bbva: number, combinedBcp: number, izipay: number = 0): string => {
  const realBcp = combinedBcp - izipay;
  const parts = [];
  if (realBcp > 0) parts.push('BCP');
  if (bbva > 0) parts.push('BBVA');
  if (izipay > 0) parts.push('IZIPAY');

  if (parts.length > 0) return parts.join(' / ');
  return 'EFECTIVO'; // cash only
};

/** Map a Supabase sale row to ExcelRow */
const mapSale = (sale: any): ExcelRow => {
  const txs: { payment_method: string; amount: number }[] = sale.transactions ?? [];
  const sumBy = (m: string) => txs.filter(t => t.payment_method === m).reduce((s, t) => s + t.amount, 0);
  const bbva = sumBy('BBVA');
  const izipay = sumBy('IZIPAY');
  const bcp = sumBy('BCP') + izipay;
  const efectivo = sumBy('EFECTIVO');

  const clientName: string =
    sale.voucher_doc_name ||
    sale.customers?.business_name ||
    'CLIENTES VARIOS';

  const documento: string = sale.invoice_number || '';

  return {
    id: sale.id,
    FECHA: sale.issue_date ?? '',
    DOCUMENTO: documento,
    'NOMBRE Y (O) RAZON': clientName,
    DETALLE: deriveBankLabel(bbva, bcp, izipay),
    BBVA: bbva,
    BCP: bcp,
    EFECTIVO: efectivo,
    TOTAL: sale.total ?? (bbva + bcp + efectivo),
    COMENTARIO: sale.comment || '',
    _izipay: izipay,
  };
};

// ─── Toast helper ─────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 ${type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
        : 'bg-rose-50 border-rose-200 text-rose-900'
      }`}>
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
      )}
      <span className={type === 'success' ? 'text-emerald-900' : 'text-rose-900'}>{message}</span>
    </div>
  );
}

export default function ContabilidadPage() {
  const { isHydrated, permissions, role } = useRole();
  const { activeStoreId, isAllStoresMode, availableStoreIds, isLoadingStores } = useStore();
  const isNativeAndroid = useIsNativeAndroid();

  const [dateFilter, setDateFilter] = useState<'TODAY' | 'MONTH' | 'CUSTOM'>('TODAY');
  const [customStart, setCustomStart] = useState(limaToday());
  const [customEnd, setCustomEnd] = useState(limaToday());
  const [startDate, setStartDate] = useState<string>(limaToday());
  const [endDate, setEndDate] = useState<string>(limaToday());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ExcelRow[] | null>(null);
  const [isDataCurrent, setIsDataCurrent] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullEfectivo, setShowFullEfectivo] = useState(false);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const isEditingRef = useRef(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Supabase query ─────────────────────────────────────────────────────────
  const querySales = (start: string, end: string) => {
    let query = supabase
      .from('sales')
      .select(`
        id, proforma_number, invoice_number, issue_date, detail, total, comment, source_type,
        voucher_type, voucher_doc_number, voucher_doc_name,
        customers ( business_name ),
        transactions ( payment_method, amount )
      `)
      .gte('issue_date', start)
      .lte('issue_date', end)
      .eq('status', 'COMPLETED')
      .is('parent_sale_id', null)
      .order('issue_date', { ascending: true });
      
    // ── BLINDAJE CAPA 2: Filtrado estricto por permiso contextual de módulo ──────
    if (activeStoreId) {
      // Caso normal: tienda activa específica
      query = query.eq('store_id', activeStoreId);
    } else if (isAllStoresMode && role !== 'ADMIN' && availableStoreIds.length > 0) {
      // Modo ALL para empleado multi-tienda: restringe a sus tiendas autorizadas CON PERMISO en este módulo
      query = query.in('store_id', availableStoreIds);
    }
    // Si es ADMIN global en modo ALL: sin filtro (ve todo)
    
    return query;
  };

  const loadRows = useCallback(async (start: string, end: string) => {
    if (isLoadingStores) return;
    if (!isAllStoresMode && !activeStoreId) return;
    if (isEditingRef.current) return;
    setIsLoading(true); setError(null); setPreviewRows(null); setIsDataCurrent(false);
    try {
      const { data, error: e } = await querySales(start, end);
      if (e) throw new Error(e.message);
      if (!data?.length) throw new Error("No se registraron ventas pagadas en este periodo.");
      setPreviewRows(data.map(mapSale));
      setIsDataCurrent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setIsLoading(false);
    }
  }, [activeStoreId, isAllStoresMode, availableStoreIds, isLoadingStores]);

  // ── Auto-load on mount ─────────────────────────────────────────────────────
  React.useEffect(() => {
    if (isLoadingStores) return;
    if (!isAllStoresMode && !activeStoreId) return;
    loadRows(startDate, endDate);
  }, [loadRows, activeStoreId, isAllStoresMode, isLoadingStores]);

  React.useEffect(() => {
    const channel = supabase
      .channel("contabilidad-sales")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          loadRows(startDate, endDate); // silent refresh on realtime event
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRows, startDate, endDate]);

  // ── Permission guards – placed AFTER all hooks (Rules of Hooks) ──────────
  // NOTE: The actual guards are placed just before return() below.
  // This comment marks the end of the setup hooks block.

  const handlePreview = () => {
    if (!startDate || !endDate || startDate > endDate) { setError('Rango de fechas inválido.'); return; }
    loadRows(startDate, endDate);
  };

  const handleShortcutToday = () => {
    const t = limaToday();
    setStartDate(t); setEndDate(t);
    loadRows(t, t);
  };

  // ── Row save ──────────────────────────────────────────────────────────────
  const handleSaveRow = async (rowId: string, rowBuffer: any, isIzipay?: boolean): Promise<boolean> => {
    try {
      const bcp = parseFloat(rowBuffer.bcp) || 0;
      const bbva = parseFloat(rowBuffer.bbva) || 0;
      const efectivo = parseFloat(rowBuffer.efectivo) || 0;

      const voucherDocName = rowBuffer.nombre.trim() || 'CLIENTES VARIOS';
      const docInput = rowBuffer.documento.trim();
      const isTicketCode = docInput.startsWith('TKT-');
      const invoiceNumber = isTicketCode ? null : (docInput || null);
      const comment = (rowBuffer.comentario || '').trim();

      const updateFields: Record<string, any> = {
        invoice_number: invoiceNumber,
        voucher_doc_name: voucherDocName,
        comment: comment
      };
      if (isTicketCode) {
        updateFields.proforma_number = docInput;
      }

      const { error: e } = await supabase.from('sales')
        .update(updateFields)
        .eq('id', rowId);
      if (e) throw e;

      const methods = [
        { name: "EFECTIVO", amount: efectivo },
        { name: isIzipay ? "IZIPAY" : "BCP", amount: bcp },
        { name: "BBVA", amount: bbva },
        { name: isIzipay ? "BCP" : "IZIPAY", amount: 0 }
      ];

      // Atomic fetch of all existing tx records for this sale
      const { data: existingTxs } = await supabase
        .from('transactions')
        .select('id, payment_method')
        .eq('sale_id', rowId);

      const txMap = new Map((existingTxs || []).map((t: any) => [t.payment_method, t.id]));

      // Execute all transaction operations in parallel
      const txPromises = methods.map(m => {
        const existingId = txMap.get(m.name);
        if (existingId) {
          if (m.amount > 0) {
            return supabase.from('transactions').update({ amount: m.amount }).eq('id', existingId);
          } else {
            return supabase.from('transactions').delete().eq('id', existingId);
          }
        } else if (m.amount > 0) {
          return supabase.from('transactions').insert({
            sale_id: rowId,
            payment_method: m.name,
            amount: m.amount,
            surcharge_pct: 0,
            surcharge_amount: 0,
            sequence: 99,
            original_detail: 'Ajuste manual'
          });
        }
        return Promise.resolve(null);
      });

      const results = await Promise.all(txPromises);
      for (const res of results) {
        if (res && (res as any).error) throw (res as any).error;
      }

      // Actualización inmediata del estado local (Opción A)
      setPreviewRows(prev => {
        if (!prev) return prev;
        return prev.map(r => {
          if (r.id === rowId) {
            return {
              ...r,
              DOCUMENTO: rowBuffer.documento,
              'NOMBRE Y (O) RAZON': voucherDocName,
              BBVA: bbva,
              BCP: bcp, // Siempre asignamos bcp porque en ExcelRow representa la columna combinada (BCP + IZIPAY)
              EFECTIVO: efectivo,
              COMENTARIO: comment,
              DETALLE: deriveBankLabel(bbva, bcp, isIzipay ? bcp : 0),
              _izipay: isIzipay ? bcp : 0
            };
          }
          return r;
        });
      });

      showToast('Fila actualizada correctamente', 'success');
      return true;
    } catch (err: any) {
      showToast('Error al guardar: ' + err.message, 'error');
      return false;
    }
  };

  // ── Excel export (with colors via XLSX) ───────────────────────────────────
  const handleExport = () => {
    if (!previewRows?.length) return;

    // Use filtered rows that already respect UI filters
    const filteredExportRows = previewRows.filter(r => showFullEfectivo || (r.BBVA || 0) > 0 || (r.BCP || 0) > 0);
    if (!filteredExportRows.length) {
      alert('No hay transacciones para exportar.');
      return;
    }

    // Helper to format month name
    const getMonthName = (dateStr: string) => {
      // dateStr is YYYY-MM-DD
      const date = new Date(dateStr + 'T12:00:00Z');
      const month = date.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
      const year = date.getFullYear();
      return { month, year };
    };

    // Sort rows by Date
    const sortedRows = [...filteredExportRows].sort((a, b) => new Date(a.FECHA).getTime() - new Date(b.FECHA).getTime());

    // Group by YYYY-MM
    const rowsByMonth: Record<string, typeof sortedRows> = {};
    for (const r of sortedRows) {
      const monthKey = r.FECHA.substring(0, 7); // YYYY-MM
      if (!rowsByMonth[monthKey]) rowsByMonth[monthKey] = [];
      rowsByMonth[monthKey].push(r);
    }

    const wb = XLSX.utils.book_new();

    for (const [monthKey, monthRows] of Object.entries(rowsByMonth)) {
      const firstRow = monthRows[0];
      if (!firstRow) continue;
      const { month, year } = getMonthName(firstRow.FECHA);
      const sheetName = `${month} ${year}`.substring(0, 31);

      const parts = monthKey.split('-');
      const yearNum = parseInt(parts[0] || '2026', 10);
      const monthNum = parseInt(parts[1] || '1', 10);
      const lastDayOfMonth = new Date(yearNum, monthNum, 0).getDate().toString().padStart(2, '0');
      
      const tabMonthStart = `${monthKey}-01`;
      const tabMonthEnd = `${monthKey}-${lastDayOfMonth}`;

      // Clip the global startDate/endDate filter to this specific month's boundaries
      const actualStart = startDate > tabMonthStart ? startDate : tabMonthStart;
      const actualEnd = endDate < tabMonthEnd ? endDate : tabMonthEnd;

      const minDay = actualStart.substring(8, 10);
      const maxDay = actualEnd.substring(8, 10);
      
      let title = '';
      if (minDay === '01' && maxDay === lastDayOfMonth) {
        title = `MES DE ${month} ${year}`;
      } else {
        title = `DEL ${minDay} AL ${maxDay} DE ${month} ${year}`;
      }

      const aoa: any[][] = [];

      // Institutional Headers (Rows 1 to 3) - 8 columns total
      aoa.push(["IT'S CORPORACION GOLDTEX S.A.C   CAL.ALEXANDER VON HUMBOLT 1550", '', '', '', '', '', '', '']);
      aoa.push(["DEPOSITOS Y TRANSFERENCIAS VISA Y YAPE", '', '', '', '', '', '', '']);
      aoa.push([title, '', '', '', '', '', '', '']);

      // Table Header (Row 4)
      aoa.push(['FECHA', 'DOCUMENTO\nNUMERO', 'NOMBRE Y (O) RAZON', 'DETALLE', 'BBVA', 'BCP', 'EFECTIVO', 'TOTAL']);

      // Group daily rows within this month
      const rowsByDate: Record<string, typeof monthRows> = {};
      for (const r of monthRows) {
        if (!rowsByDate[r.FECHA]) rowsByDate[r.FECHA] = [];
        rowsByDate[r.FECHA]!.push(r);
      }

      let generalTotalBBVA = 0;
      let generalTotalBCP = 0;
      let generalTotalEfectivo = 0;
      let generalTotalSum = 0;

      const subtotalRowIndices: number[] = [];
      let totalRowIndex = -1;

      for (const [date, dailyRows] of Object.entries(rowsByDate)) {
        let dailyBBVA = 0;
        let dailyBCP = 0;
        let dailyEfectivo = 0;
        let dailyTotal = 0;

        for (const r of dailyRows) {
          const bbva = r.BBVA || 0;
          const bcp = r.BCP || 0;
          const efectivo = r.EFECTIVO || 0;
          const total = r.TOTAL || (bbva + bcp + efectivo);
          
          dailyBBVA += bbva;
          dailyBCP += bcp;
          dailyEfectivo += efectivo;
          dailyTotal += total;

          aoa.push([
            excelDate(r.FECHA),
            r.DOCUMENTO,
            r['NOMBRE Y (O) RAZON'],
            r.DETALLE === '—' || r.DETALLE === 'EFECTIVO' ? '' : r.DETALLE,
            bbva,
            bcp,
            efectivo,
            total,
          ]);
        }

        generalTotalBBVA += dailyBBVA;
        generalTotalBCP += dailyBCP;
        generalTotalEfectivo += dailyEfectivo;
        generalTotalSum += dailyTotal;

        aoa.push([
          '', '', '', '', // Empty first 4 cells
          dailyBBVA,
          dailyBCP,
          dailyEfectivo,
          dailyTotal,
        ]);
        subtotalRowIndices.push(aoa.length - 1);
      }

      // Add General Total row
      aoa.push([
        '', '', '', '', // Empty first 4 cells
        generalTotalBBVA,
        generalTotalBCP,
        generalTotalEfectivo,
        generalTotalSum,
      ]);
      totalRowIndex = aoa.length - 1;

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 36 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

      // Merge header rows (0-indexed)
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Fila 1
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Fila 2
        { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }, // Fila 3
      ];

      // Apply styles to cells
      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:H1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          let cell = ws[cellRef];
          
          if (!cell) {
            cell = { t: 's', v: '' };
            ws[cellRef] = cell;
          }

          const isInstHeader = R >= 0 && R <= 2;
          const isTableHeader = R === 3;
          const isSubTotal = subtotalRowIndices.includes(R);
          const isGeneralTotal = R === totalRowIndex;

          let fontColor = "000000";
          let bgColor: string | undefined = undefined;
          let isBold = isInstHeader || isTableHeader || isSubTotal || isGeneralTotal;
          let numFmt: string | undefined = undefined;

          if (isGeneralTotal) {
            bgColor = "003366"; // Dark Blue
            fontColor = "FFFFFF"; // White
          } else if (isSubTotal) {
            bgColor = "99CCFF"; // Light Blue
          }

          // Column specific colors for amount columns
          if (!isGeneralTotal && !isInstHeader && !isTableHeader) {
            if (C === 4) fontColor = "0000FF"; // BBVA: Blue
            else if (C === 5) fontColor = "FF0000"; // BCP: Red
            else if (C === 6) fontColor = "FF00FF"; // EFECTIVO: Fucsia
            else if (C === 7) fontColor = "008000"; // TOTAL: Green
          }

          if (C >= 4 && C <= 7 && !isInstHeader && !isTableHeader) {
            numFmt = '#,##0.00';
            if (typeof cell.v === 'number') {
              cell.t = 'n';
            }
          }

          cell.s = {
            font: { color: { rgb: fontColor }, bold: isBold },
            fill: bgColor ? { fgColor: { rgb: bgColor } } : undefined,
            alignment: {
              wrapText: isTableHeader && C === 1,
              vertical: "center",
              horizontal: isInstHeader ? "center" : (C >= 4 && C <= 7 || isTableHeader) ? "center" : "left"
            },
            numFmt: numFmt
          };
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, `GSYSTEM_Contabilidad_${startDate}_al_${endDate}.xlsx`);
  };

  // ── Fullscreen toggle ─────────────────────────────────────────────────────
  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      await tableWrapperRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Listen for Escape to update state
  React.useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Derived totals ────────────────────────────────────────────────────────
  const totals = previewRows?.reduce(
    (acc, r) => ({ BBVA: acc.BBVA + r.BBVA, BCP: acc.BCP + r.BCP, EFECTIVO: acc.EFECTIVO + r.EFECTIVO, TOTAL: acc.TOTAL + r.TOTAL }),
    { BBVA: 0, BCP: 0, EFECTIVO: 0, TOTAL: 0 }
  );
  const totalBancos = (totals?.BCP ?? 0) + (totals?.BBVA ?? 0);

  const filteredRows = previewRows?.filter(r => showFullEfectivo || (r.BBVA || 0) > 0 || (r.BCP || 0) > 0) || [];
  const visibleTotals = filteredRows.reduce(
    (acc, r) => ({ BBVA: acc.BBVA + r.BBVA, BCP: acc.BCP + r.BCP, EFECTIVO: acc.EFECTIVO + r.EFECTIVO, TOTAL: acc.TOTAL + r.TOTAL }),
    { BBVA: 0, BCP: 0, EFECTIVO: 0, TOTAL: 0 }
  );

  const spinnerOff = '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
  const inlineCellCls = 'h-7 px-1.5 border-2 border-transparent hover:border-indigo-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white text-xs font-bold w-full focus:outline-none transition-colors';

  // ── Permission guards – placed AFTER all hooks (Rules of Hooks) ──────────
  if (!isHydrated || isLoadingStores) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm font-semibold text-gray-600">Cargando contabilidad...</p>
        </div>
      </div>
    );
  }
  if (isNativeAndroid) {
    return (
      <AccessDeniedView
        moduleName="Contabilidad"
        customReason="El módulo de Contabilidad está disponible exclusivamente desde la versión Web."
      />
    );
  }
  if (!permissions?.access_contabilidad) {
    return <AccessDeniedView moduleName="Módulo de Contabilidad" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <datalist id="clientes-list">
        <option value="CLIENTES VARIOS" />
      </datalist>

      <main className="flex-1 min-w-0">
        {/* Header */}
        <header className="bg-card border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-4 pt-2 sm:pt-0">
            <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-foreground truncate">Módulo de Contabilidad</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Control de Ventas y Liquidación</p>
              </div>
            </div>
          </div>
          <StoreSwitcher />
        </header>

        <div className="p-6 max-w-screen-2xl mx-auto space-y-5">
          {/* Filter Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Fecha Inicio
                  </label>
                  <input type="date"
                    className="h-10 px-3 rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white text-gray-900 font-medium focus:border-indigo-500 focus:outline-none transition-colors text-sm"
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); setIsDataCurrent(false); }}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Fecha Fin
                  </label>
                  <input type="date"
                    className="h-10 px-3 rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white text-gray-900 font-medium focus:border-indigo-500 focus:outline-none transition-colors text-sm"
                    value={endDate}
                    onChange={e => { setEndDate(e.target.value); setIsDataCurrent(false); }}
                  />
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={handleShortcutToday}
                  className="h-10 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm rounded-xl transition-colors">
                  Hoy
                </button>
                {!isDataCurrent && (
                  <button onClick={handlePreview} disabled={isLoading}
                    className={`h-10 px-5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${isLoading ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'}`}>
                    {isLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Cargando...</> : <><Eye className="w-4 h-4" /> Ver</>}
                  </button>
                )}
                {isDataCurrent && (
                  <button onClick={handleExport}
                    className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-md">
                    <Download className="w-4 h-4" /> Excel
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" /><p className="font-medium">{error}</p>
              </div>
            )}

            {/* Summary Badges */}
            {previewRows && !error && (
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="font-bold">{previewRows.length} ventas</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                  <Database className="w-3.5 h-3.5" />
                  <span className="font-bold">TOTAL: S/ {totals?.TOTAL.toFixed(2)}</span>
                </div>
                {totalBancos > 0 && (
                  <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-xl">
                    <Landmark className="w-3.5 h-3.5" />
                    <span className="font-bold">BANCOS: S/ {totalBancos.toFixed(2)}</span>
                  </div>
                )}
                {(totals?.BBVA ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
                    <span className="font-extrabold text-xs">BBVA</span>
                    <span className="font-bold">S/ {totals!.BBVA.toFixed(2)}</span>
                  </div>
                )}
                {(totals?.BCP ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl">
                    <span className="font-extrabold text-xs">BCP</span>
                    <span className="font-bold">S/ {totals!.BCP.toFixed(2)}</span>
                  </div>
                )}
                {(totals?.EFECTIVO ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <span className="font-extrabold text-xs">EFECTIVO</span>
                    <span className="font-bold">S/ {totals!.EFECTIVO.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center ml-2 text-xs text-slate-500 italic">
                  (Nota: Incluye ventas 100% en efectivo)
                </div>
              </div>
            )}
          </div>

          {/* Preview Table */}
          {previewRows && !error && (
            <ContabilidadTable
              filteredRows={filteredRows}
              handleSaveRow={handleSaveRow}
              isEditingRef={isEditingRef}
              displayDate={displayDate}
              inlineCellCls={inlineCellCls}
              showToast={showToast}
              showFullEfectivo={showFullEfectivo}
              setShowFullEfectivo={setShowFullEfectivo}
              toggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              tableWrapperRef={tableWrapperRef}
              toastNode={toast ? <Toast message={toast.message} type={toast.type} /> : null}
            />
          )}
        </div>
      </main>
    </div>
  );
}
