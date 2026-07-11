'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../context/RoleContext';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { 
  Search, FileSpreadsheet, Trash2, Calendar, Filter, 
  ChevronDown, ChevronUp, AlertCircle, ShoppingBag, ArrowLeft
} from 'lucide-react';
import { formatTicketHash, parseInternalTicketNum } from '../lib/ticket-sequence';

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
  document_number: string;
  issue_date: string;
  total: number;
  status: string;
  items: SaleItem[];
  customers?: {
    business_name: string;
    ruc: string;
  };
  transactions?: any[];
};

export default function HistorialProformasPage() {
  const router = useRouter();
  const { role, isHydrated } = useRole();

  // Redirect if not ADMIN
  useEffect(() => {
    if (isHydrated && role !== 'ADMIN') {
      router.push('/hub');
    }
  }, [role, isHydrated, router]);

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
          id, internal_ticket_number, document_number, issue_date, total, status, items,
          customers ( business_name, ruc ),
          transactions ( payment_method, amount, sequence )
        `)
        .gte('issue_date', startDate)
        .lte('issue_date', endDate)
        .order('issue_date', { ascending: false })
        .order('id', { ascending: false });

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
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
    if (role === 'ADMIN') {
      loadData();
    }
  }, [startDate, endDate, statusFilter, role]);

  // Derived state
  const filteredSales = useMemo(() => {
    if (!searchTerm) return sales;
    const lower = searchTerm.toLowerCase();
    return sales.filter(s => 
      s.document_number?.toLowerCase().includes(lower) ||
      s.customers?.business_name?.toLowerCase().includes(lower) ||
      s.customers?.ruc?.toLowerCase().includes(lower)
    );
  }, [sales, searchTerm]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage) || 1;
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
      const { error: err } = await supabase
        .from('sales')
        .update({ status: 'CANCELLED' })
        .eq('id', saleToCancel.id);
        
      if (err) throw err;
      
      setSales(prev => prev.map(s => s.id === saleToCancel.id ? { ...s, status: 'CANCELLED' } : s));
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

  if (!isHydrated || role !== 'ADMIN') return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Link href="/hub" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <FileSpreadsheet className="w-6 h-6 text-teal-600" />
              Historial de Proformas
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Módulo de auditoría y control (ADMIN)</p>
          </div>
          <button
            onClick={() => router.push('/hub')}
            className="text-sm font-bold text-gray-600 hover:text-gray-900 bg-gray-100 px-4 py-2 rounded-xl transition-colors"
          >
            Volver al Hub
          </button>
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

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-xl text-sm font-bold text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="COMPLETED">Cobrados (COMPLETED)</option>
                <option value="PENDING">Pendientes (PENDING)</option>
                <option value="CANCELLED">Anulados (CANCELLED)</option>
              </select>
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
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">Ticket</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">Documento</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">Monto</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">Confección</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">BCP</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">BBVA</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs">Izipay</th>
                  <th className="px-4 py-3 font-extrabold uppercase tracking-wider text-xs text-right">Total</th>
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
                    if (Array.isArray(sale.items)) {
                      const confItem = sale.items.find((i: any) => i.id === 'confeccion-item' || i.name === 'COSTO POR CONFECCIÓN');
                      if (confItem) confeccionAmt += ((confItem as any).quantity * (confItem as any).price) || (confItem as any).editedPrice || 0;
                      const taxiItem = sale.items.find((i: any) => i.id === 'taxi-item' || i.name === 'COSTO POR TAXI');
                      if (taxiItem) confeccionAmt += ((taxiItem as any).quantity * (taxiItem as any).price) || (taxiItem as any).editedPrice || 0;
                    }

                    const montoCalculado = rawEfectivoAmt - confeccionAmt;
                    const montoAmt = montoCalculado > 0 ? montoCalculado : 0;

                    const fmt = (n: number) => {
                      if (sale.status === "PENDING") return "—";
                      return n === 0 ? "—" : `S/ ${n.toFixed(2)}`;
                    };

                    return (
                      <React.Fragment key={sale.id}>
                        <tr className={`hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}>
                          <td className="px-4 py-3 font-mono font-bold text-gray-700 whitespace-nowrap">
                            <div className="font-black text-sm">{formatTicketHash(ticketNo)}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                            {sale.document_number}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-700 whitespace-nowrap">{fmt(montoAmt)}</td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-700 whitespace-nowrap">{fmt(confeccionAmt)}</td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-700 whitespace-nowrap">{fmt(bcpAmt)}</td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-700 whitespace-nowrap">{fmt(bbvaAmt)}</td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-700 whitespace-nowrap">{fmt(izipayAmt)}</td>
                          <td className="px-4 py-3 font-extrabold text-teal-700 text-right whitespace-nowrap">
                            {sale.status === "PENDING" ? "—" : `S/ ${sale.total.toFixed(2)}`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                              sale.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                              sale.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {sale.status}
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
                              {!isCancelled && (
                                <button
                                  onClick={() => handleSoftDelete(sale.id, sale.status, sale.document_number)}
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
                                <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                                  <ShoppingBag className="w-4 h-4" /> Desglose de Ítems
                                </h4>
                                {Array.isArray(sale.items) && sale.items.length > 0 ? (
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
                                      {sale.items.map((item, i) => (
                                        <tr key={i}>
                                          <td className="py-2 font-bold text-gray-700">{item.name}</td>
                                          <td className="py-2 text-center font-medium text-gray-600">{item.quantity}</td>
                                          <td className="py-2 text-right font-medium text-gray-600">S/ {item.editedPrice.toFixed(2)}</td>
                                          <td className="py-2 text-right font-extrabold text-gray-800">S/ {(item.quantity * item.editedPrice).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
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
                Página {currentPage} de {totalPages} ({filteredSales.length} registros)
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
