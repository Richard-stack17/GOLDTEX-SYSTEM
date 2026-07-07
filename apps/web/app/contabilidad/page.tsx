'use client';

import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
  Download, Calendar, CheckCircle2, AlertCircle, BarChart3,
  Eye, Database, ArrowLeft, RefreshCw, Landmark, Maximize2, Minimize2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────
type ExcelRow = {
  id: string;
  FECHA: string;          // YYYY-MM-DD stored, displayed as DD-MM-YYYY
  DOCUMENTO: string;
  'NOMBRE Y (O) RAZON': string;
  DETALLE: string;        // bank label: BBVA | BCP | — (never "Efectivo")
  BBVA: number;
  BCP: number;
  EFECTIVO: number;
  TOTAL: number;
};

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
const deriveBankLabel = (bbva: number, bcp: number): string => {
  if (bbva > 0 && bcp === 0) return 'BBVA';
  if (bcp > 0 && bbva === 0) return 'BCP';
  if (bbva > 0 && bcp > 0) return 'BBVA / BCP';
  return '—'; // cash only
};

/** Map a Supabase sale row to ExcelRow */
const mapSale = (sale: any): ExcelRow => {
  const txs: { payment_method: string; amount: number }[] = sale.transactions ?? [];
  const sumBy = (m: string) => txs.filter(t => t.payment_method === m).reduce((s, t) => s + t.amount, 0);
  const bbva = sumBy('BBVA');
  const bcp = sumBy('BCP') + sumBy('IZIPAY');
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
    DETALLE: deriveBankLabel(bbva, bcp),
    BBVA: bbva,
    BCP: bcp,
    EFECTIVO: efectivo,
    TOTAL: bbva + bcp + efectivo,
  };
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ContabilidadPage() {
  const [startDate, setStartDate] = useState<string>(limaToday);
  const [endDate, setEndDate] = useState<string>(limaToday);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ExcelRow[] | null>(null);
  const [isDataCurrent, setIsDataCurrent] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tableWrapperRef = useRef<HTMLDivElement>(null);



  // ── Cell-level draft edits ─────────────────────────────────────────────────
  type CellDraft = {
    DOCUMENTO?: string;
    'NOMBRE Y (O) RAZON'?: string;
    BBVA?: string;
    BCP?: string;
    EFECTIVO?: string;
  };
  const [cellEdits, setCellEdits] = useState<Record<string, CellDraft>>({});

  const getCellDraft = (rowId: string, field: keyof CellDraft, fallback: string) =>
    cellEdits[rowId]?.[field] ?? fallback;

  const setCellDraft = (rowId: string, field: keyof CellDraft, val: string) =>
    setCellEdits(prev => ({ ...prev, [rowId]: { ...prev[rowId], [field]: val } }));

  const clearCellDraft = (rowId: string, field: keyof CellDraft) =>
    setCellEdits(prev => {
      const next = { ...prev };
      if (next[rowId]) {
        delete next[rowId][field];
        if (!Object.keys(next[rowId]).length) delete next[rowId];
      }
      return next;
    });

  // ── Supabase query ─────────────────────────────────────────────────────────
  const querySales = (start: string, end: string) =>
    supabase
      .from('sales')
      .select(`
        id, document_number, issue_date, detail, total,
        voucher_type, voucher_doc_number, voucher_doc_name,
        customers ( business_name ),
        transactions ( payment_method, amount )
      `)
      .gte('issue_date', start)
      .lte('issue_date', end)
      .eq('status', 'COMPLETED')
      .order('issue_date', { ascending: true });

  const loadRows = useCallback(async (start: string, end: string) => {
    setIsLoading(true); setError(null); setPreviewRows(null); setIsDataCurrent(false);
    try {
      const { data, error: e } = await querySales(start, end);
      if (e) throw new Error(e.message);
      if (!data?.length) throw new Error(`Sin ventas COMPLETED entre ${start} y ${end}.`);
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

  const handlePreview = () => {
    if (!startDate || !endDate || startDate > endDate) { setError('Rango de fechas inválido.'); return; }
    loadRows(startDate, endDate);
  };

  const handleShortcutToday = () => {
    const t = limaToday();
    setStartDate(t); setEndDate(t);
    loadRows(t, t);
  };

  // ── Cell save ──────────────────────────────────────────────────────────────
  const handleSaveCell = async (rowId: string, field: keyof CellDraft) => {
    const draft = cellEdits[rowId]?.[field];
    if (draft === undefined) return;
    const row = previewRows?.find(r => r.id === rowId);
    if (!row) return;

    const numericFields = ['BBVA', 'BCP', 'EFECTIVO'];
    const isNumeric = numericFields.includes(field as string);

    try {
      if (field === 'DOCUMENTO') {
        let voucherDocNumber = draft;
        if (draft.startsWith('FT-') || draft.startsWith('BV-')) voucherDocNumber = draft.substring(3);
        const { error: e } = await supabase.from('sales')
          .update({ document_number: draft, voucher_doc_number: voucherDocNumber })
          .eq('id', rowId);
        if (e) throw e;
        setPreviewRows(prev => prev ? prev.map(r => r.id === rowId ? { ...r, DOCUMENTO: draft } : r) : null);

      } else if (field === 'NOMBRE Y (O) RAZON') {
        const val = draft.trim() || 'CLIENTES VARIOS';
        const { error: e } = await supabase.from('sales').update({ voucher_doc_name: val }).eq('id', rowId);
        if (e) throw e;
        setPreviewRows(prev => prev ? prev.map(r => r.id === rowId ? { ...r, 'NOMBRE Y (O) RAZON': val } : r) : null);

      } else if (isNumeric) {
        const numVal = parseFloat(draft) || 0;
        const method = field as 'BBVA' | 'BCP' | 'EFECTIVO';
        const { data: existingTx } = await supabase
          .from('transactions').select('id')
          .eq('sale_id', rowId).eq('payment_method', method).maybeSingle();
        if (existingTx) {
          await supabase.from('transactions').update({ amount: numVal }).eq('id', existingTx.id);
        } else if (numVal > 0) {
          await supabase.from('transactions').insert({
            sale_id: rowId, payment_method: method, amount: numVal,
            surcharge_pct: 0, surcharge_amount: 0, sequence: 99, original_detail: 'Ajuste manual',
          });
        }
        const newBBVA = method === 'BBVA' ? numVal : row.BBVA;
        const newBCP  = method === 'BCP'  ? numVal : row.BCP;
        const newEFE  = method === 'EFECTIVO' ? numVal : row.EFECTIVO;
        const newTotal = newBBVA + newBCP + newEFE;
        await supabase.from('sales').update({ total: newTotal }).eq('id', rowId);
        setPreviewRows(prev => prev ? prev.map(r => {
          if (r.id !== rowId) return r;
          const u = { ...r, [method]: numVal, TOTAL: newTotal };
          u.DETALLE = deriveBankLabel(u.BBVA, u.BCP);
          return u;
        }) : null);
      }
      clearCellDraft(rowId, field);
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
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
    aoa.push(['FECHA', 'DOCUMENTO\nNUMERO', 'NOMBRE Y (O) RAZON', 'DETALLE', 'BBVA', 'BCP', 'TOTAL']);

    for (const r of filteredExportRows) {
      aoa.push([
        excelDate(r.FECHA),
        r.DOCUMENTO,
        r['NOMBRE Y (O) RAZON'],
        r.DETALLE === '—' ? '' : r.DETALLE, // never write efectivo label
        r.BBVA || 0,
        r.BCP || 0,
        (r.BBVA || 0) + (r.BCP || 0), // Excel Total = BBVA + BCP
      ]);
    }

    const excelBBVATotal = filteredExportRows.reduce((s, r) => s + (r.BBVA || 0), 0);
    const excelBCPTotal = filteredExportRows.reduce((s, r) => s + (r.BCP || 0), 0);

    // Totals row
    aoa.push([
      'TOTALES', '', '', '',
      excelBBVATotal,
      excelBCPTotal,
      excelBBVATotal + excelBCPTotal, // Excel Total
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 36 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

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
        else if (C === 6) color = "008000"; // TOTAL: Green

        // Add boldness for header and totals row, and alignment
        const isHeader = R === 0;
        const isTotals = R === range.e.r;
        
        cell.s = {
          font: { color: { rgb: color }, bold: isHeader || isTotals },
          alignment: { 
            wrapText: isHeader && C === 1, 
            vertical: "center",
            horizontal: (C >= 4 || isHeader) ? "center" : "left" 
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

  const spinnerOff = '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
  const inlineCellCls = 'h-7 px-1.5 border-2 border-transparent hover:border-indigo-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white text-xs font-bold w-full focus:outline-none transition-colors';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <datalist id="clientes-list">
        <option value="CLIENTES VARIOS" />
      </datalist>

      <main className="flex-1 min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/hub" className="text-gray-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900 leading-none">G-SYSTEM ERP — Contabilidad</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Ventas COMPLETED · Hora local Lima (UTC-5)</p>
                </div>
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
              </div>
            )}
          </div>

          {/* Preview Table */}
          {previewRows && !error && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Vista previa de ventas</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Clic en cualquier celda para editar · Enter o Tab para guardar</p>
                </div>
                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullscreen ? 'Salir' : 'Pantalla Completa'}
                </button>
              </div>

              <div ref={tableWrapperRef} className={`overflow-x-auto ${isFullscreen ? 'bg-white p-4 overflow-y-auto' : ''}`}>
                <table className="min-w-max w-full text-xs">
                  <thead className="bg-[#FACC15] border-b border-gray-300 text-gray-800">
                    <tr>
                      {['FECHA', 'DOCUMENTO', 'NOMBRE Y (O) RAZON', 'DETALLE', 'BBVA', 'BCP', 'EFECTIVO', 'TOTAL'].map(col => {
                        const isNum = ['BBVA', 'BCP', 'EFECTIVO', 'TOTAL'].includes(col);
                        return (
                          <th key={col} className={`px-4 py-2.5 font-extrabold whitespace-nowrap uppercase tracking-wider ${isNum ? 'text-right' : 'text-left'}`}>{col}</th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, index) => (
                      <tr key={index} className="hover:bg-indigo-50/30 transition-colors font-bold text-gray-800">

                        {/* FECHA — display as DD-MM-YYYY */}
                        <td className="px-4 py-1.5 whitespace-nowrap font-mono text-gray-600">{displayDate(row.FECHA)}</td>

                        {/* DOCUMENTO — unified inline edit (no buttons) */}
                        <td className="px-2 py-1 whitespace-nowrap min-w-[140px]">
                          <input
                            type="text"
                            value={getCellDraft(row.id, 'DOCUMENTO', row.DOCUMENTO)}
                            onChange={e => setCellDraft(row.id, 'DOCUMENTO', e.target.value)}
                            onBlur={() => handleSaveCell(row.id, 'DOCUMENTO')}
                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') clearCellDraft(row.id, 'DOCUMENTO'); }}
                            className={`${inlineCellCls} font-mono`}
                          />
                        </td>

                        {/* NOMBRE Y (O) RAZON — with datalist */}
                        <td className="px-2 py-1 whitespace-nowrap min-w-[180px]">
                          <input
                            type="text"
                            list="clientes-list"
                            value={getCellDraft(row.id, 'NOMBRE Y (O) RAZON', row['NOMBRE Y (O) RAZON'])}
                            onChange={e => setCellDraft(row.id, 'NOMBRE Y (O) RAZON', e.target.value)}
                            onBlur={() => handleSaveCell(row.id, 'NOMBRE Y (O) RAZON')}
                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                            className={inlineCellCls}
                          />
                        </td>

                        {/* DETALLE — bank label badge */}
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                            row.DETALLE === 'BBVA' ? 'bg-blue-100 text-blue-700'
                            : row.DETALLE === 'BCP' ? 'bg-orange-100 text-orange-700'
                            : row.DETALLE === 'BBVA / BCP' ? 'bg-purple-100 text-purple-700'
                            : 'text-gray-400'
                          }`}>{row.DETALLE}</span>
                        </td>

                        {/* BBVA */}
                        <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
                          <input type="number" step="0.01" placeholder="0.00"
                            value={getCellDraft(row.id, 'BBVA', row.BBVA === 0 ? '' : String(row.BBVA))}
                            onChange={e => setCellDraft(row.id, 'BBVA', e.target.value)}
                            onBlur={() => handleSaveCell(row.id, 'BBVA')}
                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                            className={`${inlineCellCls} text-right text-blue-700 ${spinnerOff}`}
                          />
                        </td>

                        {/* BCP */}
                        <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
                          <input type="number" step="0.01" placeholder="0.00"
                            value={getCellDraft(row.id, 'BCP', row.BCP === 0 ? '' : String(row.BCP))}
                            onChange={e => setCellDraft(row.id, 'BCP', e.target.value)}
                            onBlur={() => handleSaveCell(row.id, 'BCP')}
                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                            className={`${inlineCellCls} text-right text-red-600 ${spinnerOff}`}
                          />
                        </td>

                        {/* EFECTIVO */}
                        <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
                          <input type="number" step="0.01" placeholder="0.00"
                            value={getCellDraft(row.id, 'EFECTIVO', row.EFECTIVO === 0 ? '' : String(row.EFECTIVO))}
                            onChange={e => setCellDraft(row.id, 'EFECTIVO', e.target.value)}
                            onBlur={() => handleSaveCell(row.id, 'EFECTIVO')}
                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                            className={`${inlineCellCls} text-right text-fuchsia-600 ${spinnerOff}`}
                          />
                        </td>

                        {/* TOTAL — read-only, green */}
                        <td className="px-4 py-1.5 font-extrabold text-emerald-700 whitespace-nowrap text-right">{fmt(row.TOTAL)}</td>
                      </tr>
                    ))}

                    {/* Totals row */}
                    <tr className="bg-[#40E0D0] font-extrabold text-gray-950 border-t-2 border-gray-300 text-xs">
                      <td colSpan={4} className="px-4 py-3 whitespace-nowrap text-right">TOTAL GENERAL</td>
                      <td className="px-4 py-3 text-blue-800 whitespace-nowrap text-right">{fmt(totals?.BBVA || 0)}</td>
                      <td className="px-4 py-3 text-red-700 whitespace-nowrap text-right">{fmt(totals?.BCP || 0)}</td>
                      <td className="px-4 py-3 text-fuchsia-700 whitespace-nowrap text-right">{fmt(totals?.EFECTIVO || 0)}</td>
                      <td className="px-4 py-3 text-xl text-emerald-800 whitespace-nowrap text-right">{fmt(totals?.TOTAL || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
