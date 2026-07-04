'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download, Calendar, CheckCircle2, AlertCircle, BarChart3,
  Eye, Database, ArrowLeft, RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

type ExcelRow = {
  FECHA: string;
  DOCUMENTO: string;
  'NOMBRE Y (O) RAZON': string;
  DETALLE: string;
  BBVA: number;
  BCP: number;
  EFECTIVO: number;
  IZIPAY: number;
  TOTAL: number;
};

const today = () => new Date().toISOString().split('T')[0]!;
const firstOfMonth = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0]!;
};
const fmt = (n: number) => n === 0 ? '—' : `S/ ${n.toFixed(2)}`;

export default function ContabilidadPage() {
  const [startDate, setStartDate] = useState<string>(firstOfMonth);
  const [endDate, setEndDate] = useState<string>(today);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ExcelRow[] | null>(null);
  const [isDataCurrent, setIsDataCurrent] = useState(false);

  const fetchData = async (): Promise<ExcelRow[]> => {
    const { data: salesData, error: salesErr } = await supabase
      .from('sales')
      .select(`
        id, document_number, issue_date, detail, total,
        voucher_type, voucher_doc_number, voucher_doc_name,
        customers ( business_name ),
        transactions ( payment_method, amount )
      `)
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)
      .eq('status', 'COMPLETED')
      .order('issue_date', { ascending: true });

    if (salesErr) throw new Error(`Error Supabase: ${salesErr.message}`);
    if (!salesData || salesData.length === 0)
      throw new Error(`Sin ventas COMPLETED entre ${startDate} y ${endDate}.`);

    return salesData.map((sale) => {
      const txs = (sale.transactions as { payment_method: string; amount: number }[]) ?? [];
      const sumBy = (m: string) => txs.filter(t => t.payment_method === m).reduce((s, t) => s + t.amount, 0);
      const bbva = sumBy('BBVA'), bcp = sumBy('BCP'), efectivo = sumBy('EFECTIVO'), izipay = sumBy('IZIPAY');

      const clientName = (sale as Record<string, unknown>).voucher_doc_name as string
        || (sale.customers as { business_name?: string } | null)?.business_name
        || 'CLIENTE VARIOS';

      const vType = (sale as Record<string, unknown>).voucher_type as string | null;
      const vDocNum = (sale as Record<string, unknown>).voucher_doc_number as string | null;
      let documento = sale.document_number ?? '';
      if (vType && vType !== 'TICKET' && vDocNum) {
        documento = `${vType === 'FACTURA' ? 'FT' : 'BV'}-${vDocNum}`;
      }

      return {
        FECHA: sale.issue_date ?? '',
        DOCUMENTO: documento,
        'NOMBRE Y (O) RAZON': clientName,
        DETALLE: sale.detail ?? '',
        BBVA: bbva, BCP: bcp, EFECTIVO: efectivo, IZIPAY: izipay,
        TOTAL: bbva + bcp + efectivo + izipay,
      };
    });
  };

  const handlePreview = async () => {
    if (!startDate || !endDate || startDate > endDate) { setError('Rango de fechas inválido.'); return; }
    setIsLoading(true); setError(null); setPreviewRows(null); setIsDataCurrent(false);
    try {
      setPreviewRows(await fetchData());
      setIsDataCurrent(true);
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Error desconocido.'); }
    finally { setIsLoading(false); }
  };

  const handleExport = () => {
    if (!previewRows?.length) return;
    const ws = XLSX.utils.json_to_sheet(previewRows);
    ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 36 }, { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
    XLSX.writeFile(wb, `GOLTEX_Contabilidad_${startDate}_al_${endDate}.xlsx`);
  };

  const columns: (keyof ExcelRow)[] = ['FECHA', 'DOCUMENTO', 'NOMBRE Y (O) RAZON', 'DETALLE', 'BBVA', 'BCP', 'EFECTIVO', 'IZIPAY', 'TOTAL'];
  const totals = previewRows?.reduce(
    (acc, r) => ({ BBVA: acc.BBVA + r.BBVA, BCP: acc.BCP + r.BCP, EFECTIVO: acc.EFECTIVO + r.EFECTIVO, IZIPAY: acc.IZIPAY + r.IZIPAY, TOTAL: acc.TOTAL + r.TOTAL }),
    { BBVA: 0, BCP: 0, EFECTIVO: 0, IZIPAY: 0, TOTAL: 0 }
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <main className="flex-1 min-w-0">
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
                  <h1 className="text-base font-bold text-gray-900 leading-none">Motor de Exportación Contable</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Ventas COMPLETED (GOLTEX S.A.C.)</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-screen-xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex gap-4 flex-1">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Fecha Inicio
                  </label>
                  <input
                    type="date"
                    className="h-11 px-4 rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white text-gray-900 font-medium focus:border-indigo-500 focus:outline-none transition-colors"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setIsDataCurrent(false); }}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-500" /> Fecha Fin
                  </label>
                  <input
                    type="date"
                    className="h-11 px-4 rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white text-gray-900 font-medium focus:border-indigo-500 focus:outline-none transition-colors"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setIsDataCurrent(false); }}
                  />
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                {!isDataCurrent && (
                  <button
                    onClick={handlePreview}
                    disabled={isLoading}
                    className={`h-11 px-6 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md ${
                      isLoading
                        ? 'bg-indigo-300 text-white cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0'
                    }`}
                  >
                    {isLoading ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Cargando...</>
                    ) : (
                      <><Eye className="w-4 h-4" /> Previsualizar</>
                    )}
                  </button>
                )}
                {isDataCurrent && (
                  <button onClick={handleExport}
                    className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 transition-colors shadow-md border-2 border-emerald-600">
                    <Download className="w-4 h-4" /> Exportar Excel
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {previewRows && !error && (
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-bold">{previewRows.length} ventas</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-xl">
                  <Database className="w-4 h-4" />
                  <span className="font-bold">Total: S/ {totals?.TOTAL.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {previewRows && !error && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                <h2 className="text-lg font-bold text-gray-900">Vista previa de ventas</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="px-6 py-4 text-left font-bold whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{row.FECHA}</td>
                        <td className="px-6 py-4 font-mono text-gray-700 whitespace-nowrap">{row.DOCUMENTO}</td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{row['NOMBRE Y (O) RAZON']}</td>
                        <td className="px-6 py-4 text-gray-700 max-w-xs">{row.DETALLE}</td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{fmt(row.BBVA)}</td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{fmt(row.BCP)}</td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{fmt(row.EFECTIVO)}</td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{fmt(row.IZIPAY)}</td>
                        <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">{fmt(row.TOTAL)}</td>
                      </tr>
                    ))}
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
