'use client';

import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
  Download, Calendar, CheckCircle2, AlertCircle, BarChart3,
  Eye, Database, ArrowLeft, RefreshCw, Landmark, Maximize2, Minimize2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

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

  const vType: string | null = sale.voucher_type ?? null;
  const vDocNum: string | null = sale.voucher_doc_number ?? null;
  let documento: string = sale.document_number ?? '';
  if (vType && vType !== 'TICKET' && vDocNum) {
    documento = `${vType === 'FACTURA' ? 'FT' : 'BV'}-${vDocNum}`;
  }

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
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl font-bold text-sm animate-in fade-in slide-in-from-bottom-4 ${type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
        : 'bg-red-500/10 border-red-500/30 text-red-500'
      }`}>
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

export default function ContabilidadPage() {
  const [startDate, setStartDate] = useState<string>(limaToday);
  const [endDate, setEndDate] = useState<string>(limaToday);
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
  const querySales = (start: string, end: string) =>
    supabase
      .from('sales')
      .select(`
        id, document_number, issue_date, detail, total, comment, source_type,
        voucher_type, voucher_doc_number, voucher_doc_name,
        customers ( business_name ),
        transactions ( payment_method, amount )
      `)
      .gte('issue_date', start)
      .lte('issue_date', end)
      .eq('status', 'COMPLETED')
      .order('issue_date', { ascending: true });

  const loadRows = useCallback(async (start: string, end: string) => {
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
  }, []);

  // ── Auto-load on mount ─────────────────────────────────────────────────────
  React.useEffect(() => {
    const today = limaToday();
    loadRows(today, today);
  }, [loadRows]);

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
      let voucherDocNumber = rowBuffer.documento;
      if (voucherDocNumber.startsWith('FT-') || voucherDocNumber.startsWith('BV-')) {
        voucherDocNumber = voucherDocNumber.substring(3);
      }
      const comment = rowBuffer.comentario.trim();

      const { error: e } = await supabase.from('sales')
        .update({
          document_number: rowBuffer.documento,
          voucher_doc_number: voucherDocNumber,
          voucher_doc_name: voucherDocName,
          comment: comment
        })
        .eq('id', rowId);
      if (e) throw e;

      const methods = [
        { name: "EFECTIVO", amount: efectivo },
        { name: isIzipay ? "IZIPAY" : "BCP", amount: bcp },
        { name: "BBVA", amount: bbva },
      ];

      // Aseguramos de eliminar la otra contraparte que no debe existir
      if (isIzipay) {
        methods.push({ name: "BCP", amount: 0 });
      } else {
        methods.push({ name: "IZIPAY", amount: 0 });
      }

      for (const m of methods) {
        const { data: existingTx } = await supabase
          .from('transactions').select('id')
          .eq('sale_id', rowId).eq('payment_method', m.name).maybeSingle();

        if (existingTx) {
          if (m.amount > 0) {
            await supabase.from('transactions').update({ amount: m.amount }).eq('id', existingTx.id);
          } else {
            await supabase.from('transactions').delete().eq('id', existingTx.id);
          }
        } else if (m.amount > 0) {
          await supabase.from('transactions').insert({
            sale_id: rowId, payment_method: m.name, amount: m.amount,
            surcharge_pct: 0, surcharge_amount: 0, sequence: 99, original_detail: 'Ajuste manual'
          });
        }
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

    const filteredExportRows = previewRows.filter(r => (r.BBVA || 0) + (r.BCP || 0) > 0);
    if (!filteredExportRows.length) {
      alert('No hay transacciones con montos en BBVA o BCP para exportar.');
      return;
    }

    const aoa: any[][] = [];

    // Header row — DOCUMENTO spans two "lines" via newline char
    aoa.push(['FECHA', 'DOCUMENTO\nNUMERO', 'NOMBRE Y (O) RAZON', 'DETALLE', 'BBVA', 'BCP', '']);

    for (const r of filteredExportRows) {
      aoa.push([
        excelDate(r.FECHA),
        r.DOCUMENTO,
        r['NOMBRE Y (O) RAZON'],
        r.DETALLE === '—' || r.DETALLE === 'EFECTIVO' ? '' : r.DETALLE, // never write efectivo label
        r.BBVA || 0,
        r.BCP || 0,
        r.COMENTARIO || '',
      ]);
    }

    const excelBBVATotal = filteredExportRows.reduce((s, r) => s + (r.BBVA || 0), 0);
    const excelBCPTotal = filteredExportRows.reduce((s, r) => s + (r.BCP || 0), 0);

    // Totals row (Subtotals)
    aoa.push([
      '', '', '', '', // Empty first 4 cells
      excelBBVATotal,
      excelBCPTotal,
      '', // Empty COMENTARIO
    ]);

    // General Total row (under BBVA)
    aoa.push([
      '', '', '', '', // Empty first 4 cells
      excelBBVATotal + excelBCPTotal, // Green cell under BBVA
      '', // Empty BCP
      '', // Empty COMENTARIO
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 36 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];

    // Apply styles to cells
    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:G1");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellRef];
        if (!cell) continue;

        let color = "000000"; // default black
        if (C === 4) color = "0000FF"; // BBVA: Blue
        else if (C === 5) color = "FF0000"; // BCP: Red

        // Add boldness for header and totals rows, and alignment
        const isHeader = R === 0;
        const isSubTotals = R === range.e.r - 1;
        const isGeneralTotal = R === range.e.r;

        // Make the General Total cell (under BBVA) green
        if (isGeneralTotal && C === 4) color = "008000"; // Green

        cell.s = {
          font: { color: { rgb: color }, bold: isHeader || isSubTotals || isGeneralTotal },
          alignment: {
            wrapText: isHeader && C === 1,
            vertical: "center",
            horizontal: (C >= 4 && C <= 5 || isHeader) ? "center" : "left"
          }
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <datalist id="clientes-list">
        <option value="CLIENTES VARIOS" />
      </datalist>

      <main className="flex-1 min-w-0">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-none">Módulo de Contabilidad</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Control de Ventas y Liquidación</p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 max-w-screen-2xl mx-auto space-y-5">
          {/* Filter Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex gap-4 flex-1">
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
            />
          )}
        </div>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
