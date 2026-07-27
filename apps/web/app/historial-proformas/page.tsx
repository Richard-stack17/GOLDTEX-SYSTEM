'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../context/RoleContext';
import { AccessDeniedView } from '../components/AccessDeniedView';
import { supabase } from '../lib/supabase';
import { useStore } from '../context/StoreContext';
import StoreSwitcher from "../components/StoreSwitcher";
import Link from 'next/link';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useTableSort } from '../hooks/useTableSort';
import {
  Search, ClipboardList, Trash2, Calendar, Filter,
  ChevronDown, ChevronUp, AlertCircle, ShoppingBag, ArrowLeft,
  UserCheck, CreditCard, XCircle, User, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { formatTicketHash, parseInternalTicketNum } from '../lib/ticket-sequence';

const formatPeruDateTimeFull = (isoString?: string | null) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

const limaToday = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
};

// Type definitions
type SaleItem = {
  id: string;
  name: string;
  quantity: number;
  editedPrice: number;
  code: string;
};

type SaleRow = {
  id: string;
  internal_ticket_number: number | null;
  proforma_number: string | null;
  invoice_number: string | null;
  voucher_type?: string | null;
  voucher_doc_name?: string | null;
  voucher_doc_number?: string | null;
  issue_date: string;
  total: number;
  status: string;
  items: SaleItem[];
  customers?: {
    business_name: string;
    doc_number: string;
    document_type?: string;
  };
  transactions?: any[];
  created_at?: string;
  updated_at?: string;
};

export default function HistorialProformasPage() {
  const router = useRouter();
  const { role, username, isHydrated, permissions } = useRole();
  const { activeStoreId } = useStore();

  // State
  const todayLima = limaToday();
  const [startDate, setStartDate] = useState(todayLima);
  const [endDate, setEndDate] = useState(todayLima);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('sales')
        .select(`
          id, internal_ticket_number, proforma_number, invoice_number, voucher_type, voucher_doc_name, voucher_doc_number, issue_date, created_at, updated_at, total, status, items, seller_id, cashier_id, cancelled_by_id,
          seller:profiles!seller_id(username),
          cashier:profiles!cashier_id(username),
          cancelled_by:profiles!cancelled_by_id(username),
          customers ( business_name, doc_number, document_type ),
          transactions ( payment_method, amount, sequence, created_at )
        `)
        .gte('issue_date', startDate)
        .lte('issue_date', endDate)
        .order('created_at', { ascending: false })
        .order('internal_ticket_number', { ascending: false })
        .order('id', { ascending: false });

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }
      if (activeStoreId) {
        query = query.eq('store_id', activeStoreId);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      setSales((data as any) || []);
      setCurrentPage(1); // Reset page on new load
    } catch (err: any) {
      setError(err.message || 'Error al cargar el historial');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (permissions?.access_proformas) {
      loadData();
    }
  }, [startDate, endDate, statusFilter, activeStoreId, permissions]);

  // Derived state & sorting
  const baseFilteredSales = useMemo(() => {
    if (!searchTerm) return sales;
    const lower = searchTerm.toLowerCase();
    return sales.filter(s =>
      s.proforma_number?.toLowerCase().includes(lower) ||
      s.invoice_number?.toLowerCase().includes(lower) ||
      s.voucher_doc_name?.toLowerCase().includes(lower) ||
      s.voucher_doc_number?.toLowerCase().includes(lower) ||
      s.customers?.business_name?.toLowerCase().includes(lower) ||
      s.customers?.doc_number?.toLowerCase().includes(lower)
    );
  }, [sales, searchTerm]);

  const { items: sortedSales, requestSort, sortConfig } = useTableSort(baseFilteredSales, {
    key: 'internal_ticket_number',
    direction: 'desc'
  });

  const renderSortIcon = (key: keyof SaleRow) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-teal-600 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-teal-600 font-bold" />
    );
  };

  const totalPages = Math.ceil(sortedSales.length / itemsPerPage) || 1;
  const paginatedSales = sortedSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handlers
  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Modals State ──
  const [saleToCancel, setSaleToCancel] = useState<{ id: string, document_number: string } | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  const confirmCancelSale = async () => {
    if (!saleToCancel) return;
    setIsCanceling(true);
    try {
      const nowIso = new Date().toISOString();
      let cancellerId: string | null = null;
      if (username) {
        try {
          const { data: profData } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
          if (profData?.id) cancellerId = profData.id;
        } catch (e) {}
      }

      const { error: err } = await supabase
        .from('sales')
        .update({ 
          status: 'CANCELLED',
          updated_at: nowIso,
          cancelled_by_id: cancellerId
        })
        .eq('id', saleToCancel.id);

      if (err) throw err;

      setSales(prev => prev.map(s => s.id === saleToCancel.id ? { 
        ...s, 
        status: 'CANCELLED', 
        updated_at: nowIso,
        cancelled_by_id: cancellerId,
        cancelled_by: { username }
      } : s));
    } catch (err: any) {
      alert(err.message || 'Error al anular');
    } finally {
      setIsCanceling(false);
      setSaleToCancel(null);
    }
  };

  const handleSoftDelete = (id: string, currentStatus: string, document_number: string) => {
    if (currentStatus === 'CANCELLED') return;
    setSaleToCancel({ id, document_number });
  };

  if (!isHydrated) return null;
  if (!permissions?.access_proformas) {
    return <AccessDeniedView moduleName="Historial de Proformas" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm px-6 h-16 flex items-center shrink-0">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hub" className="text-gray-500 hover:text-gray-900 transition-colors p-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shadow-sm">
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-none">
                  Historial de Proformas
                </h1>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Módulo de auditoría y control (ADMIN)</p>
              </div>
            </div>
          </div>
          <StoreSwitcher />
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-3 py-2 border rounded-xl text-sm font-bold text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-gray-400 font-bold">hasta</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-3 py-2 border rounded-xl text-sm font-bold text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="h-8 w-px bg-gray-200 mx-2" />

            <div className="flex bg-gray-100 rounded-lg p-1 gap-1 border border-gray-200">
              {[
                { id: "ALL", label: "Todos" },
                { id: "COMPLETED", label: "Cobrados" },
                { id: "PENDING", label: "Pendientes" },
                { id: "CANCELLED", label: "Anulados" }
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${statusFilter === id
                    ? id === "PENDING" ? "bg-orange-500 text-white shadow-sm"
                      : id === "COMPLETED" ? "bg-emerald-600 text-white shadow-sm"
                        : id === "CANCELLED" ? "bg-red-500 text-white shadow-sm"
                          : "bg-gray-800 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente o documento..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm font-bold text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <th
                    onClick={() => requestSort('internal_ticket_number')}
                    className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs cursor-pointer select-none hover:bg-gray-100/80 transition-colors group"
                    title="Ordenar por número de ticket"
                  >
                    <div className="flex items-center gap-1">
                      <span>Ticket</span>
                      {renderSortIcon('internal_ticket_number')}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSort('proforma_number')}
                    className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs cursor-pointer select-none hover:bg-gray-100/80 transition-colors group"
                    title="Ordenar por documento"
                  >
                    <div className="flex items-center gap-1">
                      <span>Documento</span>
                      {renderSortIcon('proforma_number')}
                    </div>
                  </th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">Efectivo</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">Servicios</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">BCP</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">BBVA</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">Izipay</th>
                  <th
                    onClick={() => requestSort('total')}
                    className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs text-right cursor-pointer select-none hover:bg-gray-100/80 transition-colors group"
                    title="Ordenar por monto total"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total</span>
                      {renderSortIcon('total')}
                    </div>
                  </th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs text-center">Estado</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400 font-bold">
                      Cargando historial...
                    </td>
                  </tr>
                ) : paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400 font-bold">
                      No se encontraron resultados.
                    </td>
                  </tr>
                ) : (
                  paginatedSales.map((sale) => {
                    const isExpanded = expandedRows[sale.id];
                    const isCancelled = sale.status === 'CANCELLED';

                    const ticketNo = parseInternalTicketNum(sale);
                    const txs = sale.transactions || [];
                    const sumBy = (m: string) => txs.filter(t => t.payment_method === m).reduce((s, t) => s + t.amount, 0);
                    const rawEfectivoAmt = sumBy("EFECTIVO");
                    const bcpAmt = sumBy("BCP");
                    const izipayAmt = sumBy("IZIPAY");
                    const bbvaAmt = sumBy("BBVA");

                    let confeccionAmt = 0;
                    const itemsArray = Array.isArray(sale.items) ? sale.items : [];
                    if (itemsArray.length > 0) {
                      const services = itemsArray.filter((i: any) => {
                        if (i.is_service === true) return true;
                        const name = (i.name || '').toUpperCase();
                        return name === 'CONFECCIÓN' || name === 'TAXI' || name.includes('CONFECCIÓN') || name.includes('TAXI');
                      });
                      confeccionAmt = services.reduce((acc: number, item: any) => {
                        const q = parseFloat(item.quantity) || 1;
                        const ep = item.editedPrice !== undefined ? parseFloat(item.editedPrice) : parseFloat(item.price) || 0;
                        return acc + (ep * q);
                      }, 0);
                    }

                    const montoAmt = rawEfectivoAmt; // No deductimos los servicios del efectivo, mostramos la realidad.

                    const fmtAmt = (n: number, color: string) => {
                      if (sale.status === "PENDING" || n === 0) return <span className="text-gray-300 font-medium">—</span>;
                      return <span className={`font-black ${color}`}>S/ {n.toFixed(2)}</span>;
                    };

                    return (
                      <React.Fragment key={sale.id}>
                        <tr className={`hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}>
                          <td className="px-4 py-3 font-mono font-bold text-gray-700 whitespace-nowrap">
                            <div className="font-black text-sm">{formatTicketHash(ticketNo)}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                            {(() => {
                              const ticketCode = (sale.proforma_number && sale.proforma_number.startsWith("TKT"))
                                ? sale.proforma_number
                                : (formatTicketHash(ticketNo) || sale.proforma_number || "---");

                              const fiscalDoc = sale.invoice_number
                                || (sale.proforma_number && !sale.proforma_number.startsWith("TKT") ? sale.proforma_number : null);

                              const rawVoucher = (sale.voucher_type || (fiscalDoc?.startsWith("B") || fiscalDoc?.startsWith("BV") ? "BOLETA" : fiscalDoc?.startsWith("F") || fiscalDoc?.startsWith("FT") ? "FACTURA" : "TICKET")).toUpperCase();

                              return (
                                <div>
                                  <div className="font-extrabold text-slate-900 text-xs">{ticketCode}</div>
                                  {fiscalDoc && (
                                    <div className="text-[11px] text-emerald-600 font-bold font-mono tracking-tight">{fiscalDoc}</div>
                                  )}
                                  {rawVoucher === "BOLETA" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 mt-1">
                                      BOLETA
                                    </span>
                                  ) : rawVoucher === "FACTURA" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                                      FACTURA
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 mt-1">
                                      TICKET / SIMPLE
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">{fmtAmt(montoAmt, "text-emerald-600")}</td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">{fmtAmt(confeccionAmt, "text-fuchsia-600")}</td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">{fmtAmt(bcpAmt, "text-orange-600")}</td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">{fmtAmt(bbvaAmt, "text-sky-600")}</td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">{fmtAmt(izipayAmt, "text-rose-600")}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {sale.status === "PENDING" ? (
                              <span className="text-gray-300 font-medium">—</span>
                            ) : (
                              <span className="inline-block bg-teal-700 text-white font-black px-2.5 py-1 rounded-lg shadow-sm text-xs tracking-wide">
                                S/ {sale.total.toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${sale.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                              sale.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                              {sale.status === 'COMPLETED' ? 'Completado' : sale.status === 'PENDING' ? 'Pendiente' : 'Anulado'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => toggleRow(sale.id)}
                                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                title="Ver Detalles"
                              >
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </button>
                              {!isCancelled && permissions?.history_cancel_proforma && (
                                <button
                                  onClick={() => handleSoftDelete(sale.id, sale.status, sale.proforma_number || sale.invoice_number || '')}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Anular"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/80 border-b border-gray-200">
                            <td colSpan={10} className="px-8 py-4">
                              <div className="bg-white border rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                  <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <ShoppingBag className="w-4 h-4" /> Desglose de Ítems
                                  </h4>
                                  {(() => {
                                    const sellerName = (sale as any).seller?.username || 'ADMIN';
                                    const cashierName = (sale as any).cashier?.username;
                                    const createdTime = formatPeruDateTimeFull(sale.created_at);
                                    
                                    const txList = Array.isArray(sale.transactions) ? sale.transactions : [];
                                    const rawTxTime = txList.find((t: any) => t?.created_at)?.created_at || (txList[0] as any)?.created_at;
                                    const cobradoTime = formatPeruDateTimeFull(rawTxTime || (sale.updated_at !== sale.created_at ? sale.updated_at : null) || sale.created_at);
                                    const anuladoTime = formatPeruDateTimeFull(sale.updated_at || sale.created_at);

                                    const isPaid = sale.status === 'COMPLETED' || !!cashierName || (sale.transactions && sale.transactions.length > 0);
                                    const isCancelled = sale.status === 'CANCELLED';

                                    const cust = sale.customers;
                                    const rawName = (sale.voucher_doc_name || cust?.business_name || "CLIENTE VARIOS").trim();
                                    const isVarios = rawName.toUpperCase() === "CLIENTE VARIOS";
                                    const clientName = isVarios ? "CLIENTE VARIOS" : rawName;
                                    const clientDoc = sale.voucher_doc_number || cust?.doc_number || "";
                                    const docTypeLabel = sale.voucher_type === 'BOLETA' ? 'DNI' : sale.voucher_type === 'FACTURA' ? 'RUC' : (cust?.document_type || (clientDoc.length === 11 ? "RUC" : clientDoc ? "DNI" : ""));
                                    const showDoc = !isVarios && Boolean(clientDoc) && clientDoc !== "00000000000";
                                    const docInfo = showDoc ? ` (${docTypeLabel}: ${clientDoc})` : "";

                                    return (
                                      <div className="flex flex-wrap items-center gap-2">
                                        {/* 1. Cliente */}
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-800 rounded-full text-xs font-bold">
                                          <User className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                          <span>CLIENTE: <strong className="uppercase">{clientName}</strong><span className="text-[10px] text-slate-500 font-mono">{docInfo}</span></span>
                                        </div>

                                        {/* 2. Atendido */}
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold">
                                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span>ATENDIDO POR: <strong className="uppercase">{sellerName}</strong></span>
                                          {createdTime && <span className="text-[10px] text-emerald-700 font-mono font-medium">({createdTime})</span>}
                                        </div>

                                        {/* 3. Cobrado (Si existió cobro) */}
                                        {isPaid && (
                                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-xs font-bold">
                                            <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            <span>COBRADO POR: <strong className="uppercase">{cashierName || 'ADMIN'}</strong></span>
                                            {cobradoTime && <span className="text-[10px] text-blue-700 font-mono font-medium">({cobradoTime})</span>}
                                          </div>
                                        )}

                                        {/* 4. Anulado (Si fue anulada) */}
                                        {isCancelled && (
                                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-full text-xs font-bold">
                                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                            <span>ANULADO POR: <strong className="uppercase">{(sale as any).cancelled_by?.username || 'ADMIN'}</strong></span>
                                            {anuladoTime && <span className="text-[10px] text-rose-700 font-mono font-medium">({anuladoTime})</span>}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                                {Array.isArray(sale.items) && sale.items.length > 0 ? (
                                   (() => {
                                     const itemsArray = Array.isArray(sale.items) ? sale.items : [];
                                     const itemsSubtotal = itemsArray.reduce((acc: number, item: any) => {
                                       const q = parseFloat(item.quantity) || 1;
                                       const ep = item.editedPrice !== undefined ? parseFloat(item.editedPrice) : parseFloat(item.price) || 0;
                                       return acc + (q * ep);
                                     }, 0);

                                     const rawSurcharge = sale.total > itemsSubtotal ? sale.total - itemsSubtotal : 0;
                                     const surcharge = Math.round(rawSurcharge * 100) / 100;
                                     const hasSurcharge = surcharge >= 0.01;

                                     const txList = Array.isArray(sale.transactions) ? sale.transactions : [];
                                     const izipayTx = txList.find((t: any) => t.payment_method === 'IZIPAY' || (t.surcharge_pct && t.surcharge_pct > 0));
                                     const dbSurchargePct = izipayTx?.surcharge_pct != null && Number(izipayTx.surcharge_pct) > 0 ? Number(izipayTx.surcharge_pct).toFixed(1) : null;
                                     const surchargePct = dbSurchargePct ?? (itemsSubtotal > 0 ? ((surcharge / itemsSubtotal) * 100).toFixed(1) : "0.0");

                                     return (
                                       <table className="w-full text-xs">
                                         <thead>
                                           <tr className="text-gray-400 border-b">
                                             <th className="text-left pb-2 font-bold uppercase">Producto/Servicio</th>
                                             <th className="text-center pb-2 font-bold uppercase">Cant.</th>
                                             <th className="text-right pb-2 font-bold uppercase">P.Unit</th>
                                             <th className="text-right pb-2 font-bold uppercase">Subtotal</th>
                                           </tr>
                                         </thead>
                                         <tbody className="divide-y divide-gray-100">
                                           {itemsArray.map((item, i) => (
                                             <tr key={i}>
                                               <td className="py-2 font-bold text-gray-700">{item.name}</td>
                                               <td className="py-2 text-center font-medium text-gray-600">{item.quantity}</td>
                                               <td className="py-2 text-right font-medium text-gray-600">S/ {item.editedPrice.toFixed(2)}</td>
                                               <td className="py-2 text-right font-extrabold text-gray-800">S/ {(item.quantity * item.editedPrice).toFixed(2)}</td>
                                             </tr>
                                           ))}
                                         </tbody>
                                         <tfoot className="border-t border-gray-200">
                                           {hasSurcharge && (
                                             <>
                                               <tr>
                                                 <td colSpan={3} className="pt-2 text-right font-medium text-gray-500">Subtotal Ítems:</td>
                                                 <td className="pt-2 text-right font-bold text-gray-700 font-mono">S/ {itemsSubtotal.toFixed(2)}</td>
                                               </tr>
                                               <tr>
                                                 <td colSpan={3} className="py-1 text-right font-bold text-amber-600">Recargo Izipay / Tarjeta ({surchargePct}%):</td>
                                                 <td className="py-1 text-right font-black text-amber-600 font-mono">+ S/ {surcharge.toFixed(2)}</td>
                                               </tr>
                                             </>
                                           )}
                                           <tr>
                                             <td colSpan={3} className="py-2 text-right font-black text-gray-900 uppercase">Total Cobrado:</td>
                                             <td className="py-2 text-right font-black text-teal-700 text-sm font-mono">S/ {sale.total.toFixed(2)}</td>
                                           </tr>
                                         </tfoot>
                                       </table>
                                     );
                                   })()
                                 ) : (
                                   <p className="text-sm text-gray-500 italic">No hay información detallada en JSON para esta venta.</p>
                                 )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!isLoading && totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">
                Página {currentPage} de {totalPages} ({sortedSales.length} registros)
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        isOpen={!!saleToCancel}
        onCancel={() => setSaleToCancel(null)}
        onConfirm={confirmCancelSale}
        title="Anular Proforma/Venta"
        description={`¿Estás seguro de anular el documento ${saleToCancel?.document_number || ''}? Esta acción no se puede deshacer.`}
        isLoading={isCanceling}
      />
    </div>
  );
}
