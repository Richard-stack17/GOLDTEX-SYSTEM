"use client";
import { CajaModals } from './components/CajaModals';

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Separator,
} from "@goltex/ui";
import {
  CreditCard, Banknote, Smartphone, RefreshCw,
  CheckCircle2, AlertCircle, ArrowLeft, Clock, Receipt, XCircle,
  LayoutGrid, List, Trash2, Delete, Sun, Moon, FileText, User, Printer, Lock, Layers,
  ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Database, Landmark
} from "lucide-react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useTableSort } from "../hooks/useTableSort";
import { supabase } from "../lib/supabase";
import {
  formatTicketHash,
  parseInternalTicketNum,
  starsoftDocNumFromTicket,
} from "../lib/ticket-sequence";
import { useRole } from "../context/RoleContext";
import { AccessDeniedView } from "../components/AccessDeniedView";
import { useTheme } from "../context/ThemeContext";
import { useStore } from "../context/StoreContext";
import { requestBluetoothDevice, printSaleReceipt, silentPrintSaleReceipt } from '../configuracion/utils/printerEngine';
import { useIsNativeAndroid } from '../lib/platform';

// ─────────────── Types ───────────────
type SaleStatus = "PENDING" | "COMPLETED" | "CANCELLED";
type StatusFilter = "PENDING" | "COMPLETED" | "CANCELLED" | "ALL";
type PaymentMethod = "EFECTIVO" | "BCP" | "BBVA" | "IZIPAY";
type VoucherType = "TICKET" | "BOLETA" | "FACTURA";

type PendingTicket = {
  id: string;
  proforma_number: string | null;
  invoice_number?: string | null;
  document_number?: string | null;
  internal_ticket_number: number | null;
  total: number;
  detail: string;
  status: SaleStatus;
  created_at: string;
  updated_at?: string;
  voucher_type?: VoucherType | null;
  voucher_doc_number?: string | null;
  transactions?: any[];
  items?: any[] | string;
  parent_sale_id?: string | null;
  source_type?: string | null;
  children?: any[] | null;
  _consolidated_tickets?: any[];
  cashier_id?: string | null;
  seller_id?: string | null;
  cashier?: {
    username: string;
    employees?: { full_name: string }[] | { full_name: string } | null;
  } | null;
};

type DocField = "docNumber" | "docName" | null;

const PAYMENT_METHODS: { id: PaymentMethod; label: string; sub: string; Icon: React.ElementType }[] = [
  { id: "EFECTIVO", label: "Efectivo", sub: "Dinero en mano", Icon: Banknote },
  { id: "BCP", label: "BCP", sub: "Yape / Transf.", Icon: Smartphone },
  { id: "BBVA", label: "BBVA", sub: "Plin / Transf.", Icon: Smartphone },
  { id: "IZIPAY", label: "Izipay", sub: "+ Recargo 4%", Icon: CreditCard },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "PENDING", label: "Pendientes" },
  { id: "COMPLETED", label: "Pagados" },
  { id: "CANCELLED", label: "Anulados" },
  { id: "ALL", label: "Todos" },
];

const VOUCHER_TYPES: { id: VoucherType; label: string }[] = [
  { id: "TICKET", label: "Ticket / Simple" },
  { id: "BOLETA", label: "Boleta (DNI)" },
  { id: "FACTURA", label: "Factura (RUC)" },
];

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


// ─────────────── Component ───────────────

function getCashierDisplayName(cashier: { username: string; employees?: { full_name: string }[] | { full_name: string } | null } | null | undefined): string {
  if (!cashier) return '—';
  const emp = cashier.employees;
  if (Array.isArray(emp) && emp.length > 0) return emp[0]?.full_name || cashier.username || '—';
  if (emp && !Array.isArray(emp)) return (emp as { full_name: string }).full_name || cashier.username || '—';
  return cashier.username || '—';
}

function TicketTableRow({
  ticket,
  onSaveRow,
  isEditingRef,
  formatTicketHash,
  parseInternalTicketNum,
  starsoftDocNum,
  inlineCellCls,
  spinnerOff,
  statusBadge,
  handleCancel,
  openModal,
  handleReprint,
  showToast,
  permissions,
  isSelected,
  onToggleSelect,
  showCashierName,
  onOpenCashierInfo,
}: any) {
  const txs = ticket.transactions || [];
  const sumBy = (m: string) => txs.filter((t: any) => t.payment_method === m).reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const rawEfectivoAmt = sumBy("EFECTIVO") || 0;
  const bcpAmt = sumBy("BCP") || 0;
  const izipayAmt = sumBy("IZIPAY") || 0;
  const bbvaAmt = sumBy("BBVA") || 0;

  const izipayTx = txs.find((t: any) => t.payment_method === 'IZIPAY');
  const displayIzipayRate = izipayTx?.surcharge_pct && izipayTx.surcharge_pct > 0 ? izipayTx.surcharge_pct : 4;
  const rawIzipayFee = izipayAmt > 0 ? (izipayAmt - (izipayAmt / (1 + displayIzipayRate / 100))) : 0;
  let izipayFee = Math.round(rawIzipayFee * 10) / 10;
  if (izipayAmt > 0 && izipayFee < 0.50) izipayFee = 0.50;

  let confeccionAmt = 0;
  const itemsArray = Array.isArray(ticket.items) ? ticket.items : [];
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

  // Initialize with exact raw amounts, no deductions.
  const initialBuffer = {
    monto: (rawEfectivoAmt === 0 || isNaN(rawEfectivoAmt)) ? '' : String(rawEfectivoAmt),
    confeccion: (confeccionAmt === 0 || isNaN(confeccionAmt)) ? '' : String(confeccionAmt),
    bcp: (bcpAmt === 0 || isNaN(bcpAmt)) ? '' : String(bcpAmt),
    bbva: (bbvaAmt === 0 || isNaN(bbvaAmt)) ? '' : String(bbvaAmt),
    izipay: (izipayAmt === 0 || isNaN(izipayAmt)) ? '' : String(izipayAmt)
  };

  const [rowBuffer, setRowBuffer] = useState(initialBuffer);
  const [isFocusedRow, setIsFocusedRow] = useState(false);

  useEffect(() => {
    if (!isFocusedRow) {
      setRowBuffer(initialBuffer);
    }
  }, [ticket, isFocusedRow]);

  const handleFocus = () => {
    setIsFocusedRow(true);
    isEditingRef.current = true;
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!document.activeElement?.closest(`#ticket-row-${ticket.id}`)) {
        setIsFocusedRow(false);
        isEditingRef.current = false;
      }
    }, 0);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const targetInput = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();

      const typedSuma = (Number(rowBuffer.monto) || 0) + (Number(rowBuffer.bcp) || 0) + (Number(rowBuffer.bbva) || 0) + (Number(rowBuffer.izipay) || 0);
      if (Math.abs(typedSuma - ticket.total) > 0.01) {
        showToast("La suma de los pagos debe coincidir con el total del ticket", "error");
        setRowBuffer(initialBuffer);
        targetInput?.blur();
        return;
      }

      const success = await onSaveRow(ticket, rowBuffer);
      if (success) {
        showToast("Ticket actualizado correctamente", "success");
      } else {
        setRowBuffer(initialBuffer);
      }
      targetInput?.blur();
    }
    if (e.key === 'Escape') {
      setRowBuffer(initialBuffer);
      targetInput?.blur();
    }
  };

  const handleChange = (field: string, val: string) => {
    setRowBuffer(prev => ({ ...prev, [field]: val }));
  };

  const ticketNo = parseInternalTicketNum(ticket);
  const sunatDoc = starsoftDocNum(ticket);
  const badge = statusBadge(ticket.status);

  return (
    <tr
      id={`ticket-row-${ticket.id}`}
      className={`hover:bg-secondary/30 transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''}`}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={(e) => {
        if (permissions?.caja_cobro_consolidado && onToggleSelect) {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) return;
          if (ticket.status !== 'PENDING') {
            showToast("Solo se pueden unificar proformas pendientes", "error");
            return;
          }
          onToggleSelect(ticket.id);
        }
      }}
    >
      {permissions?.caja_cobro_consolidado && (
        <td className="px-4 py-4 text-center w-12" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {
                if (ticket.status !== 'PENDING') {
                  showToast("Solo se pueden unificar proformas pendientes", "error");
                  return;
                }
                onToggleSelect(ticket.id);
              }}
              disabled={ticket.status !== 'PENDING'}
              className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </div>
        </td>
      )}
      <td className="px-4 py-3">
        {(() => {
          const isConsolidated = ticket.source_type === 'CONSOLIDATED' || (Array.isArray(ticket.children) && ticket.children.length > 0);
          const childTickets = Array.isArray(ticket.children) && ticket.children.length > 0
            ? ticket.children
            : (Array.isArray(ticket._consolidated_tickets) ? ticket._consolidated_tickets : []);
          const childNums = childTickets.map((c: any) => c.internal_ticket_number || parseInternalTicketNum(c)).filter(Boolean);

          if (isConsolidated && childNums.length > 0) {
            return (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {childNums.map((num: number, idx: number) => (
                    <React.Fragment key={idx}>
                      <span className="font-black text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded-md shadow-sm">
                        #{num}
                      </span>
                      {idx < childNums.length - 1 && <span className="text-xs font-bold text-muted-foreground">+</span>}
                    </React.Fragment>
                  ))}
                </div>
                <span className="inline-flex items-center w-fit px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                  UNIFICADO ({childNums.length})
                </span>
              </div>
            );
          }

          return (
            <div className="flex items-center gap-1.5">
              <div className="font-black text-lg">{formatTicketHash(ticketNo)}</div>
              {isConsolidated && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                  UNIFICADO
                </span>
              )}
            </div>
          );
        })()}
        {sunatDoc && (
          <span className="text-[11px] text-muted-foreground font-mono block mt-0.5">Doc: {sunatDoc}</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground font-mono">
        {(() => {
          const isConsolidated = ticket.source_type === 'CONSOLIDATED' || (Array.isArray(ticket.children) && ticket.children.length > 0);
          const childTickets = Array.isArray(ticket.children) && ticket.children.length > 0
            ? ticket.children
            : (Array.isArray(ticket._consolidated_tickets) ? ticket._consolidated_tickets : []);

          if (isConsolidated) {
            const docNames = childTickets.map((c: any) => c.proforma_number || (c.internal_ticket_number ? `TKT-${String(c.internal_ticket_number).padStart(4, '0')}` : '')).filter(Boolean);
            return (
              <div className="flex flex-col gap-0.5">
                {docNames.length > 0 ? (
                  docNames.map((docName: string, idx: number) => (
                    <span key={idx} className="font-bold text-xs text-indigo-700 dark:text-indigo-300 tracking-tight">
                      {docName}
                    </span>
                  ))
                ) : (
                  <span className="font-bold text-xs text-indigo-700 dark:text-indigo-300">
                    {ticket.proforma_number || 'UNIFICADO'}
                  </span>
                )}
                {ticket.invoice_number && <div className="text-[10px] text-emerald-600 font-bold font-sans">{ticket.invoice_number}</div>}
              </div>
            );
          }

          return (
            <div>
              <div className="text-xs">{ticket.proforma_number || '—'}</div>
              {ticket.invoice_number && <div className="text-[10px] text-emerald-600 font-bold font-sans">{ticket.invoice_number}</div>}
            </div>
          );
        })()}
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
        {ticket.status === "PENDING" ? (
          <span className="px-4 font-mono font-bold text-gray-400 text-right block w-full">—</span>
        ) : (
          <input type="number" step="0.01" placeholder="0.00"
            value={rowBuffer.monto}
            onChange={(e) => handleChange('monto', e.target.value)}
            onKeyDown={handleKeyDown}
            onWheel={(e) => e.currentTarget.blur()}
            className={`${inlineCellCls} text-right text-gray-700 dark:text-gray-200 ${spinnerOff}`}
          />
        )}
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
        {ticket.status === "PENDING" ? (
          <span className="px-4 font-mono font-bold text-gray-400 text-right block w-full">—</span>
        ) : (
          <input type="number" step="0.01" placeholder="0.00"
            value={rowBuffer.bcp}
            onChange={(e) => handleChange('bcp', e.target.value)}
            onKeyDown={handleKeyDown}
            onWheel={(e) => e.currentTarget.blur()}
            className={`${inlineCellCls} text-right text-gray-700 dark:text-gray-200 ${spinnerOff}`}
          />
        )}
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
        {ticket.status === "PENDING" ? (
          <span className="px-4 font-mono font-bold text-gray-400 text-right block w-full">—</span>
        ) : (
          <input type="number" step="0.01" placeholder="0.00"
            value={rowBuffer.bbva}
            onChange={(e) => handleChange('bbva', e.target.value)}
            onKeyDown={handleKeyDown}
            onWheel={(e) => e.currentTarget.blur()}
            className={`${inlineCellCls} text-right text-gray-700 dark:text-gray-200 ${spinnerOff}`}
          />
        )}
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
        {ticket.status === "PENDING" ? (
          <span className="px-4 font-mono font-bold text-gray-400 text-right block w-full">—</span>
        ) : (
          <input type="number" step="0.01" placeholder="0.00"
            readOnly={true}
            disabled={true}
            value={rowBuffer.izipay}
            onChange={(e) => handleChange('izipay', e.target.value)}
            onKeyDown={handleKeyDown}
            onWheel={(e) => e.currentTarget.blur()}
            className={`${inlineCellCls} text-right bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 opacity-75 font-semibold ${spinnerOff}`}
          />
        )}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {ticket.status === "PENDING" ? (
          <div className="flex flex-col items-end leading-none">
            <span className="font-black text-orange-500 text-lg">
              S/ {ticket.total.toFixed(2)}
            </span>
            <span className="text-[10px] font-bold text-orange-500/80 uppercase mt-1">
              Por cobrar
            </span>
          </div>
        ) : ticket.status === "CANCELLED" ? (
          <span className="font-black text-muted-foreground/60 line-through text-lg">
            S/ {ticket.total.toFixed(2)}
          </span>
        ) : (() => {
          const typedSuma = (Number(rowBuffer.monto) || 0) + (Number(rowBuffer.bcp) || 0) + (Number(rowBuffer.bbva) || 0) + (Number(rowBuffer.izipay) || 0);
          const isMatch = Math.abs(typedSuma - ticket.total) < 0.01;

          return (
            <div className="flex flex-col items-end leading-none">
              <span className="font-black text-emerald-500 dark:text-emerald-400 text-lg">
                S/ {ticket.total.toFixed(2)}
              </span>

              {(izipayFee > 0 || confeccionAmt > 0) && (
                <div className="flex flex-wrap justify-end gap-1.5 mt-1.5">
                  {izipayFee > 0 && (
                    <span className="bg-rose-50 text-rose-600 border border-rose-200/60 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-sm">
                      IZI {displayIzipayRate}%: S/ {izipayFee.toFixed(2)}
                    </span>
                  )}
                  {confeccionAmt > 0 && (
                    <span className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/60 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-sm">
                      SERV: S/ {confeccionAmt.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </td>
      <td className="px-3 py-3 text-center">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${badge.classes}`}>
          {badge.label}
        </span>
      </td>
      {showCashierName && (
        <td className="px-3 py-3 whitespace-nowrap">
          {ticket.status !== 'PENDING' && ticket.cashier ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCashierInfo?.({
                  name: getCashierDisplayName(ticket.cashier),
                  username: ticket.cashier?.username || '',
                  doc: ticket.proforma_number || (ticket.internal_ticket_number ? `#${ticket.internal_ticket_number}` : 'Ticket'),
                  date: ticket.updated_at || ticket.created_at,
                });
              }}
              title="Ver detalle del cajero"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-border/70 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group/cashier focus:outline-none"
            >
              <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center shrink-0 group-hover/cashier:bg-indigo-200 dark:group-hover/cashier:bg-indigo-800 transition-colors">
                <User className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-xs font-semibold text-foreground truncate max-w-[95px] block underline decoration-dotted decoration-indigo-400/40 underline-offset-2">
                {getCashierDisplayName(ticket.cashier)}
              </span>
            </button>
          ) : (
            <span className="text-xs text-muted-foreground/40 font-mono">—</span>
          )}
        </td>
      )}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="flex justify-end gap-1.5">
          {ticket.status === "PENDING" ? (
            <>
              {permissions?.delete_sales && (
                <button
                  onClick={() => handleCancel(ticket)}
                  className="px-2.5 py-1 rounded-lg text-xs text-red-500 bg-red-500/10 hover:bg-red-500/20 font-bold transition-colors"
                >
                  Anular
                </button>
              )}
              <button
                onClick={() => openModal(ticket)}
                className="px-3.5 py-1 rounded-lg text-xs text-white bg-orange-600 hover:bg-orange-500 font-bold shadow-md shadow-orange-500/20 transition-all"
              >
                Cobrar
              </button>
            </>
          ) : ticket.status === "COMPLETED" ? (
            permissions?.delete_sales ? (
              <button
                onClick={() => handleCancel(ticket)}
                title="Anular ticket pagado"
                className="px-2.5 py-1 rounded-lg text-xs text-red-500 bg-red-500/10 hover:bg-red-500/20 font-bold transition-colors border border-red-500/20"
              >
                Anular
              </button>
            ) : (
              <span className="text-xs text-muted-foreground/40 font-mono">—</span>
            )
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export default function CajaPage() {
  const { role, username, isHydrated, permissions } = useRole();
  const { activeStore, activeStoreId, isAllStoresMode, isLoadingStores } = useStore();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const isNativeAndroid = useIsNativeAndroid();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [tickets, setTickets] = useState<PendingTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [ticketToCancel, setTicketToCancel] = useState<PendingTicket | null>(null);
  const [activeCashierInfo, setActiveCashierInfo] = useState<{ name: string; username: string; doc: string; date?: string } | null>(null);
  const isEditingRef = useRef(false);

  // ── Filtro Multi-Select de Cajeros ──
  const [selectedCashierIds, setSelectedCashierIds] = useState<Set<string>>(new Set());
  const [isCashierDropdownOpen, setIsCashierDropdownOpen] = useState(false);
  const cashierDropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cashierDropdownRef.current && !cashierDropdownRef.current.contains(e.target as Node)) {
        setIsCashierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Settings ──
  const [settings, setSettings] = useState<{ izipay_debit_fee: number; izipay_credit_fee: number }>({
    izipay_debit_fee: 4,
    izipay_credit_fee: 5
  });
  const [izipayVariant, setIzipayVariant] = useState<'DEBIT' | 'CREDIT'>('DEBIT');

  // ── Cobro Consolidado ──
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());

  const toggleTicketSelection = (id: string) => {
    const newSet = new Set(selectedTicketIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTicketIds(newSet);
  };

  // ── Printer state ──
  const [activePrinter, setActivePrinter] = useState<any>(null);
  const [btDeviceObj, setBtDeviceObj] = useState<any>(null);

  useEffect(() => {
    async function loadPrinter() {
      try {
        let query = supabase.from('printers').select('*').order('auto_print', { ascending: false }).limit(1);
        if (activeStoreId) query = query.eq('store_id', activeStoreId);
        const { data } = await query.maybeSingle();
        if (data) {
          setActivePrinter(data);
          try { localStorage.setItem('cached_printer_config', JSON.stringify(data)); } catch (_) { }
          if (data.type === 'bluetooth') {
            const nav = navigator as any;
            if (nav.bluetooth && nav.bluetooth.getDevices) {
              try {
                const devices = await nav.bluetooth.getDevices();
                if (devices.length > 0) {
                  setBtDeviceObj(devices[0]);
                }
              } catch (e) {
                console.warn('No silent BT access', e);
              }
            }
          }
        }
      } catch (e) {
        console.warn('📌 [Modo Avión / Offline] No se pudo cargar impresora de Supabase en Caja, usando caché:', e);
        try {
          const cached = localStorage.getItem('cached_printer_config');
          if (cached) setActivePrinter(JSON.parse(cached));
        } catch (_) { }
      }
    }
    loadPrinter();
  }, [activeStoreId]);

  const spinnerOff = '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
  const inlineCellCls = 'h-7 px-1.5 border-2 border-transparent hover:border-indigo-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white text-xs font-bold w-full focus:outline-none transition-colors';

  // ── Payment modal ──
  const [selectedTicket, setSelectedTicket] = useState<PendingTicket | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePayMethod, setActivePayMethod] = useState<PaymentMethod>("EFECTIVO");
  const [paymentAmounts, setPaymentAmounts] = useState<Record<PaymentMethod, string>>({
    EFECTIVO: "", BCP: "", BBVA: "", IZIPAY: "",
  });

  // ── Review / Confirm modal ──
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Success Modal & Print ──
  const [successSaleData, setSuccessSaleData] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (!showSuccessModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        setShowSuccessModal(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSuccessModal]);


  // ── Voucher / Comprobante ──
  const [voucherType, setVoucherType] = useState<VoucherType>("TICKET");
  const [docNumber, setDocNumber] = useState("");
  const [docName, setDocName] = useState("");
  const [activeDocField, setActiveDocField] = useState<DocField>(null);

  // ── Print preview state ──
  const [lastSaleInfo, setLastSaleInfo] = useState<{
    ticketNum: number | null; docNum: string; items: any[]; total: number; izipayFee?: number;
  } | null>(null);

  const [focusedMethod, setFocusedMethod] = useState<string | null>(null);

  // ── Customer Autocomplete ──
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerResults, setCustomerResults] = useState<{ id: string, doc_number: string, business_name: string, document_type?: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!customerQuery || customerQuery.trim().length < 2) {
      setCustomerResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, doc_number, business_name, document_type")
        .or(`doc_number.ilike.%${customerQuery}%,business_name.ilike.%${customerQuery}%`)
        .limit(15);

      if (data && data.length > 0) {
        let filtered = data;
        if (voucherType === "BOLETA") {
          // Exclude RUC 20 and 11-digit RUCs strictly! Only DNI / CE (8-9 digits)
          filtered = data.filter(c => {
            const doc = (c.doc_number || "").trim();
            const type = (c.document_type || "").toUpperCase();
            if (type === "RUC" || doc.length === 11 || doc.startsWith("20")) return false;
            return true;
          });
        } else if (voucherType === "FACTURA") {
          // Include ONLY RUCs (11-digit documents)
          filtered = data.filter(c => {
            const doc = (c.doc_number || "").trim();
            const type = (c.document_type || "").toUpperCase();
            return type === "RUC" || doc.length === 11;
          });
        }
        setCustomerResults(filtered.slice(0, 5));
        setShowDropdown(filtered.length > 0);
      } else {
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery, voucherType]);

  const selectCustomer = (c: { id: string, doc_number: string, business_name: string, document_type?: string }) => {
    setSelectedCustomerId(c.id);
    const cleanDoc = (c.doc_number || "").replace(/\D/g, "");
    if (voucherType === "BOLETA" && cleanDoc.length > 8) {
      setDocNumber(cleanDoc.slice(0, 8));
    } else if (voucherType === "FACTURA" && cleanDoc.length > 11) {
      setDocNumber(cleanDoc.slice(0, 11));
    } else {
      setDocNumber(cleanDoc);
    }
    setDocName(c.business_name || "");
    setShowDropdown(false);
    setCustomerQuery("");
  };

  // ── Derived payment values ──
  const ticketTotal = selectedTicket?.total ?? 0;
  const izipayAmount = parseFloat(paymentAmounts["IZIPAY"]) || 0;

  const izipayRate = izipayVariant === 'DEBIT' ? settings.izipay_debit_fee : settings.izipay_credit_fee;
  const rawIzipayFee = izipayAmount > 0 ? (izipayAmount - (izipayAmount / (1 + izipayRate / 100))) : 0;
  let izipayFee = Math.round(rawIzipayFee * 10) / 10;
  if (izipayAmount > 0 && izipayFee < 0.50) {
    izipayFee = 0.50;
  }
  const finalTotal = ticketTotal + izipayFee;
  const totalPaid = Object.values(paymentAmounts).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);

  const totalServices = useMemo(() => {
    if (!selectedTicket) return 0;
    let itemsArray = [];
    if (Array.isArray(selectedTicket.items)) {
      itemsArray = selectedTicket.items;
    } else if (typeof selectedTicket.items === 'string') {
      try { itemsArray = JSON.parse(selectedTicket.items); } catch (e) { }
    }

    if (itemsArray.length > 0) {
      const services = itemsArray.filter((i: any) => {
        if (i.is_service === true) return true;
        const name = (i.name || '').toUpperCase();
        return name === 'CONFECCIÓN' || name === 'TAXI';
      });
      return services.reduce((acc: number, item: any) => acc + (item.editedPrice * (item.quantity || 1)), 0);
    }
    return 0;
  }, [selectedTicket]);

  // Voucher validation
  const needsDocInfo = voucherType === "BOLETA" || voucherType === "FACTURA";
  const docNumberValid = !needsDocInfo || (
    voucherType === "BOLETA" ? /^\d{8}$/.test(docNumber) :
      voucherType === "FACTURA" ? /^\d{11}$/.test(docNumber) : true
  );
  const docNameValid = !needsDocInfo || docName.trim().length >= 3;
  const canConfirm = Math.round(totalPaid * 100) === Math.round(finalTotal * 100) && finalTotal > 0 && docNumberValid && docNameValid;

  // ─────────────── Data Fetching ───────────────
  const fetchTickets = useCallback(async (silent = false) => {
    if (isLoadingStores || !activeStoreId) return;
    if (!silent) setIsLoading(true);
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" });
    const todayStr = formatter.format(now);

    let query = supabase
      .from("sales")
      .select("id, proforma_number, invoice_number, internal_ticket_number, total, detail, items, status, created_at, updated_at, voucher_type, voucher_doc_number, seller_id, cashier_id, parent_sale_id, source_type, seller:profiles!seller_id(username), cashier:profiles!cashier_id(username, employees:employees!employee_id(full_name)), transactions(payment_method, amount, surcharge_pct, surcharge_amount), children:sales!parent_sale_id(id, internal_ticket_number, proforma_number, total, items, seller_id, seller:profiles!seller_id(username))")
      .eq("record_date", todayStr)
      .is("parent_sale_id", null)
      .order("created_at", { ascending: true });

    if (activeStoreId) {
      query = query.eq("store_id", activeStoreId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setTickets(data as unknown as PendingTicket[]);
      setLastRefresh(new Date());
    }
    if (!silent) setIsLoading(false);
  }, [activeStoreId, isLoadingStores]);

  useEffect(() => {
    async function loadSettings() {
      let stQuery = supabase.from('settings').select('*');
      if (activeStoreId) stQuery = stQuery.eq('store_id', activeStoreId);
      const { data } = await stQuery;
      if (data) {
        const debit = data.find(s => s.key === 'izipay_debit_fee')?.value;
        const credit = data.find(s => s.key === 'izipay_credit_fee')?.value;
        setSettings({
          izipay_debit_fee: debit ? Number(debit) : 4,
          izipay_credit_fee: credit ? Number(credit) : 5
        });
      }
    }
    loadSettings();
  }, [activeStoreId]);

  useEffect(() => {
    if (isLoadingStores || !activeStoreId) return;
    fetchTickets(false);

    const channelName = activeStoreId ? `caja_tickets_${activeStoreId}` : 'caja_tickets_all';

    const cajaChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales"
        },
        () => {
          fetchTickets(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions"
        },
        () => {
          fetchTickets(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cajaChannel);
    };
  }, [activeStoreId, isLoadingStores, fetchTickets]);

  // ── Lista de cajeros únicos para el filtro ──
  const uniqueCashiers = useMemo(() => {
    const map = new Map<string, { id: string; displayName: string }>();
    tickets.forEach(t => {
      if (t.cashier_id && t.cashier) {
        const emp = (t.cashier as any).employees;
        const name = (Array.isArray(emp) && emp.length > 0)
          ? (emp[0].full_name || t.cashier.username)
          : (emp?.full_name || t.cashier.username);
        if (!map.has(t.cashier_id)) {
          map.set(t.cashier_id, { id: t.cashier_id, displayName: name });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [tickets]);

  // ── Filtered & Sorted tickets ──
  const enrichedFilteredTickets = useMemo(() => {
    let base = statusFilter === "ALL"
      ? tickets
      : tickets.filter(t => t.status === statusFilter);

    // Aplicar filtro de cajero si hay seleccionados
    if (selectedCashierIds.size > 0) {
      base = base.filter(t => t.cashier_id != null && selectedCashierIds.has(t.cashier_id));
    }

    return base.map(t => {
      const txs = t.transactions || [];
      const sumBy = (m: string) => txs.filter((tx: any) => tx.payment_method === m).reduce((s: number, tx: any) => s + (tx.amount || 0), 0);

      const childTickets = Array.isArray(t.children) && t.children.length > 0
        ? t.children
        : (Array.isArray(t._consolidated_tickets) ? t._consolidated_tickets : []);
      const childNums = childTickets.map((c: any) => c.internal_ticket_number || parseInternalTicketNum(c)).filter(Boolean);

      const parsedNum = parseInternalTicketNum(t);
      const effectiveTicketNum = t.internal_ticket_number != null && t.internal_ticket_number > 0
        ? t.internal_ticket_number
        : (childNums.length > 0 ? Math.min(...childNums) : (parsedNum ?? 0));

      return {
        ...t,
        internal_ticket_number: effectiveTicketNum,
        efectivo_amt: sumBy("EFECTIVO"),
        bcp_amt: sumBy("BCP"),
        bbva_amt: sumBy("BBVA"),
        izipay_amt: sumBy("IZIPAY"),
      };
    });
  }, [tickets, statusFilter, selectedCashierIds]);

  const { items: sortedTickets, requestSort, sortConfig } = useTableSort(enrichedFilteredTickets, {
    key: 'internal_ticket_number',
    direction: 'asc'
  });

  const filteredTotal = enrichedFilteredTickets.reduce((s, t) => s + t.total, 0);

  // ── Desglose de totales por método de pago (Estilo Contabilidad) ──
  const breakdownTotals = useMemo(() => {
    let cobrado = 0;
    let pendiente = 0;
    let efectivo = 0;
    let bcp = 0;
    let bbva = 0;
    let izipay = 0;

    enrichedFilteredTickets.forEach(t => {
      if (t.status === "COMPLETED") {
        cobrado += (t.total || 0);
        efectivo += (t.efectivo_amt || 0);
        bcp += (t.bcp_amt || 0);
        bbva += (t.bbva_amt || 0);
        izipay += (t.izipay_amt || 0);
      } else if (t.status === "PENDING") {
        pendiente += (t.total || 0);
      }
    });

    const bancos = bcp + bbva + izipay;

    return { cobrado, pendiente, bancos, efectivo, bcp, bbva, izipay };
  }, [enrichedFilteredTickets]);

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/50 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary font-bold" />
    );
  };

  // ─────────────── Handlers ───────────────
  const handleNumpadKey = (key: string) => {
    setActiveDocField(null);
    const currentVal = paymentAmounts[activePayMethod] || "";
    let nextVal = currentVal;

    if (key === "DEL") {
      nextVal = currentVal.slice(0, -1);
    } else if (key === ".") {
      if (!currentVal.includes(".")) {
        nextVal = currentVal === "" ? "0." : currentVal + ".";
      }
    } else {
      if (currentVal === "0") {
        nextVal = key;
      } else {
        const [ints, decs] = currentVal.split(".");
        if (decs && decs.length >= 2) return;
        if (ints && ints.length >= 6 && !currentVal.includes(".")) return;
        nextVal = currentVal + key;
      }
    }

    if (nextVal === "" || /^\d*\.?\d{0,2}$/.test(nextVal)) {
      setPaymentAmounts(prev => ({ ...prev, [activePayMethod]: nextVal }));
    }
  };

  // ── Row save ──────────────────────────────────────────────────────────────
  const handleSaveCajaRow = async (ticket: PendingTicket, rowBuffer: any): Promise<boolean> => {
    try {
      const bcp = parseFloat(rowBuffer.bcp) || 0;
      const bbva = parseFloat(rowBuffer.bbva) || 0;
      const izipay = parseFloat(rowBuffer.izipay) || 0;
      const monto = parseFloat(rowBuffer.monto) || 0;

      const methods = [
        { name: "EFECTIVO", amount: monto },
        { name: "BCP", amount: bcp },
        { name: "BBVA", amount: bbva },
        { name: "IZIPAY", amount: izipay }
      ];

      for (const m of methods) {
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('sale_id', ticket.id)
          .eq('payment_method', m.name)
          .maybeSingle();

        if (existingTx) {
          if (m.amount > 0) {
            await supabase.from('transactions').update({ amount: m.amount }).eq('id', existingTx.id);
          } else {
            await supabase.from('transactions').delete().eq('id', existingTx.id);
          }
        } else if (m.amount > 0) {
          await supabase.from('transactions').insert({
            sale_id: ticket.id,
            payment_method: m.name,
            amount: m.amount,
            surcharge_pct: 0,
            surcharge_amount: 0,
            sequence: 99,
            original_detail: 'Ajuste manual de caja'
          });
        }
      }

      fetchTickets();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Phase 1: open the review pop-up (NO DB write yet)
  const openReview = () => {
    if (!canConfirm) return;
    setIsReviewing(true);
  };

  // Phase 2: actually write to DB (guarded by isSubmitting)
  const handleFinalSubmit = async () => {
    if (!selectedTicket || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let cashierId: string | null = null;
      if (username) {
        try {
          const { data: profData } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
          if (profData?.id) cashierId = profData.id;
        } catch (e) { }
      }

      const isConsolidated = (selectedTicket as any).source_type === "CONSOLIDATED";
      const nowIso = new Date().toISOString();

      let targetSaleId = selectedTicket.id;
      let internalTicketNum = selectedTicket.internal_ticket_number;

      // --- Optimistic Concurrency Control ---
      const idsToCheck = isConsolidated ? (selectedTicket as any)._consolidated_tickets.map((t: any) => t.id) : [selectedTicket.id];
      const { data: statusData, error: statusErr } = await supabase.from('sales').select('id, status').in('id', idsToCheck);

      if (statusErr) throw statusErr;
      if (!statusData || statusData.some(t => t.status !== 'PENDING')) {
        showToast("⚠️ Error: Uno o más tickets ya fueron cobrados o anulados por otro usuario.", "error");
        setIsSubmitting(false);
        fetchTickets(); // Refrescar la lista
        return;
      }
      // --------------------------------------

      if (isConsolidated) {
        const todayLimaStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        const hijas = (selectedTicket as any)._consolidated_tickets || [];
        const hijasNums = hijas.map((h: any) => h.internal_ticket_number || parseInternalTicketNum(h)).filter(Boolean);
        const hijasDocNames = hijas.map((h: any) => h.proforma_number || (h.internal_ticket_number ? `TKT-${String(h.internal_ticket_number).padStart(4, '0')}` : '')).filter(Boolean);

        const combinedDocNum = hijasDocNames.length > 0 ? hijasDocNames.join(' + ') : `UNIF #${hijasNums.join(' + #')}`;
        const combinedDetail = `Cobro Unificado (${hijas.length} tickets): ${hijasNums.map((n: number) => '#' + n).join(' + ')}`;
        const primarySellerId = hijas.find((h: any) => h.seller_id)?.seller_id || cashierId;

        // 1. Crear Venta Padre
        const { data: padreData, error: errPadre } = await supabase.from('sales').insert({
          total: finalTotal,
          source_type: 'CONSOLIDATED',
          status: 'COMPLETED',
          store_id: activeStoreId,
          cashier_id: cashierId,
          seller_id: primarySellerId,
          customer_id: selectedCustomerId || null,
          proforma_number: combinedDocNum,
          detail: combinedDetail,
          items: (selectedTicket as any).items || [], // Todos los items combinados
          voucher_type: voucherType,
          voucher_doc_number: needsDocInfo ? docNumber : null,
          voucher_doc_name: needsDocInfo ? docName.trim() : null,
          record_date: todayLimaStr,
          issue_date: todayLimaStr,
        }).select('id, internal_ticket_number, proforma_number').single();

        if (errPadre) throw errPadre;
        targetSaleId = padreData.id;
        internalTicketNum = padreData.internal_ticket_number;

        // 2. Actualizar Ventas Hijas
        const hijasIds = hijas.map((h: any) => h.id);

        const { error: errHijas } = await supabase.from('sales').update({
          status: 'COMPLETED',
          parent_sale_id: targetSaleId,
          cashier_id: cashierId,
          updated_at: nowIso
        }).in('id', hijasIds);

        if (errHijas) throw errHijas;
      } else {
        if (internalTicketNum == null || internalTicketNum <= 0) {
          throw new Error("No se pudo determinar el número interno del ticket.");
        }

        const updatePayload: Record<string, unknown> = {
          status: "COMPLETED",
          total: finalTotal,
          invoice_number: null,
          voucher_type: voucherType,
          voucher_doc_number: needsDocInfo ? docNumber : String(internalTicketNum),
          voucher_doc_name: needsDocInfo ? docName.trim() : null,
          cashier_id: cashierId,
          updated_at: nowIso,
        };
        if (selectedCustomerId) {
          updatePayload.customer_id = selectedCustomerId;
        }

        const { error: updateErr } = await supabase
          .from("sales")
          .update(updatePayload)
          .eq("id", targetSaleId);
        if (updateErr) throw updateErr;
      }

      // 3. Insertar Transacciones (siempre a la Venta Padre o Venta Normal)
      const txsToInsert = [];
      let sequence = 1;

      for (const [method, amountStr] of Object.entries(paymentAmounts)) {
        let amount = parseFloat(amountStr) || 0;
        if (amount <= 0) continue;

        const isIzipay = method === "IZIPAY";
        const surchargePct = isIzipay ? izipayRate : 0.0;
        const surchargeAmt = isIzipay ? izipayFee : 0.0;

        txsToInsert.push({
          sale_id: targetSaleId,
          payment_method: method,
          amount: amount,
          surcharge_pct: surchargePct,
          surcharge_amount: surchargeAmt,
          sequence: sequence++,
          original_detail: isConsolidated ? `Cobro Consolidado en Caja — ${method}` : `Cobro en Caja — ${method}`,
        });
      }

      if (txsToInsert.length > 0) {
        const { error: txErr } = await supabase.from("transactions").insert(txsToInsert);
        if (txErr) throw txErr;
      }

      // ── Módulo de Impresión Integrada ──
      const saleDataForPrint = {
        ...selectedTicket,
        id: targetSaleId,
        internal_ticket_number: internalTicketNum,
        total: finalTotal,
        voucher_type: voucherType,
        voucher_doc_number: needsDocInfo ? docNumber : (isConsolidated ? null : String(internalTicketNum)),
        items: (selectedTicket as any).items || [],
        customer_name: docName,
        comment: isConsolidated ? "Cobro Consolidado" : (selectedTicket as any).detail,
      };

      setSuccessSaleData(saleDataForPrint);
      setShowSuccessModal(true);

      if (isConsolidated) {
        setTickets((prev) => prev.filter((t) => !selectedTicketIds.has(t.id)));
        setSelectedTicketIds(new Set());
      } else {
        setTickets((prev) => prev.filter((t) => t.id !== targetSaleId));
      }
      closeModal();
      fetchTickets();
    } catch (err: any) {
      const errorMsg = err?.message || err?.details || err?.hint || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      console.error("Fallo en BD:", errorMsg, err);
      showToast("Error BD: " + errorMsg, "error");
      setIsSubmitting(false);
    }
  };

  const handleCancelTicket = (ticket: PendingTicket, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTicketToCancel(ticket);
  };

  const confirmCancelTicket = async () => {
    if (!ticketToCancel) return;
    setIsProcessing(true);
    try {
      const updated_at = new Date().toISOString();
      let cancellerId: string | null = null;
      if (username) {
        try {
          const { data: profData } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
          if (profData?.id) cancellerId = profData.id;
        } catch (e) { }
      }

      const { error } = await supabase.rpc('cancel_pos_ticket', {
        p_sale_id: ticketToCancel.id,
        p_cancel_reason: "Anulado por el Cajero",
        p_cancelled_by_id: cancellerId
      });
      if (error) throw error;

      if (ticketToCancel.source_type === 'CONSOLIDATED') {
        await supabase
          .from('sales')
          .update({
            status: "CANCELLED",
            cancelled_by_id: cancellerId,
            updated_at: updated_at
          })
          .eq('parent_sale_id', ticketToCancel.id);
      }

      setTickets((prev) => prev.map(t => t.id === ticketToCancel.id ? {
        ...t,
        status: "CANCELLED",
        updated_at: updated_at
      } : t));
      if (selectedTicket?.id === ticketToCancel.id) closeModal();
    } catch (err) {
      console.error(err);
      showToast("Error al anular el ticket.", "error");
    } finally {
      setIsProcessing(false);
      setTicketToCancel(null);
    }
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setSelectedTicket(null);
    setIsReviewing(false);
    setIsSubmitting(false);
    setActivePayMethod("EFECTIVO");
    setPaymentAmounts({ EFECTIVO: "", BCP: "", BBVA: "", IZIPAY: "" });
    setVoucherType("TICKET");
    setDocNumber("");
    setDocName("");
    setActiveDocField(null);
  };

  const openModal = (ticket: PendingTicket) => {
    setSelectedTicket(ticket);
    setIsReviewing(false);
    setIsSubmitting(false);
    setActivePayMethod("EFECTIVO");
    setPaymentAmounts({ EFECTIVO: "", BCP: "", BBVA: "", IZIPAY: "" });
    setVoucherType("TICKET");
    setDocNumber("");
    setDocName("");
    setActiveDocField(null);
    // Auto-focus the Efectivo input after the modal renders
    setTimeout(() => {
      const el = document.getElementById("payment-input-EFECTIVO");
      if (el) (el as HTMLInputElement).focus();
    }, 80);
  };

  const setFullAmount = (method: PaymentMethod, overrideRate?: number) => {
    setActiveDocField(null);
    let basePaidOthers = 0;
    for (const [m, valStr] of Object.entries(paymentAmounts)) {
      if (m === method) continue;
      const v = parseFloat(valStr) || 0;
      if (m === "IZIPAY") {
        const rate = izipayVariant === 'DEBIT' ? settings.izipay_debit_fee : settings.izipay_credit_fee;
        const rawFee = v > 0 ? (v - (v / (1 + rate / 100))) : 0;
        let fee = Math.round(rawFee * 10) / 10;
        if (v > 0 && fee < 0.50) fee = 0.50;
        basePaidOthers += (v - fee);
      } else {
        basePaidOthers += v;
      }
    }
    const baseRemaining = Math.max(0, ticketTotal - basePaidOthers);

    if (method === "IZIPAY") {
      const activeRate = overrideRate !== undefined ? overrideRate : (izipayVariant === 'DEBIT' ? settings.izipay_debit_fee : settings.izipay_credit_fee);
      const rawFee = baseRemaining * (activeRate / 100);
      let fee = Math.round(rawFee * 10) / 10;
      if (baseRemaining > 0 && fee < 0.50) fee = 0.50;
      const izipayTotal = baseRemaining + fee;
      setPaymentAmounts(prev => ({ ...prev, [method]: izipayTotal.toFixed(2) }));
    } else {
      setPaymentAmounts(prev => ({ ...prev, [method]: baseRemaining.toFixed(2) }));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentId: PaymentMethod) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    // Move to next input; if at last input and fully paid, focus the Confirmar button
    const order = PAYMENT_METHODS.map(m => m.id);
    const currentIdx = order.indexOf(currentId);
    const nextId = order[currentIdx + 1];
    if (nextId) {
      const nextInput = document.getElementById(`payment-input-${nextId}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    } else {
      // Last field — focus the Confirmar Cobro button
      const confirmBtn = document.getElementById("btn-confirmar-cobro");
      if (confirmBtn) (confirmBtn as HTMLButtonElement).focus();
    }
  };



  // ── Format helpers ──
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  const starsoftDocNum = (ticket: PendingTicket) => starsoftDocNumFromTicket(ticket);

  const statusBadge = (status: SaleStatus) => {
    if (status === "PENDING") return { label: "Pendiente", classes: "bg-orange-500/20 text-orange-500 border border-orange-500/30" };
    if (status === "COMPLETED") return { label: "Pagado", classes: "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" };
    return { label: "Anulado", classes: "bg-red-500/20 text-red-500 border border-red-500/30" };
  };

  if (!isHydrated) return null;
  if (isNativeAndroid) {
    return (
      <AccessDeniedView
        moduleName="Caja"
        customReason="El módulo de Caja está disponible exclusivamente desde la versión Web."
      />
    );
  }
  if (!permissions?.access_caja) {
    return <AccessDeniedView moduleName="Caja" />;
  }

  if (isAllStoresMode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background min-h-screen">
        <div className="max-w-md w-full p-8 text-center space-y-6 bg-card border border-border rounded-2xl shadow-xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Bloqueo Operativo</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              La Caja es un módulo físico. No puedes procesar cobros en modo consolidado ("Todas las Tiendas").
              <br /><br />
              Por favor, selecciona una tienda específica en el menú superior para poder operar.
            </p>
          </div>
          <button className="w-full font-bold h-12 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg" onClick={() => router.push('/hub')}>
            Volver al Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header className="bg-card border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-6 shadow-sm shrink-0">
        <div className="flex items-center gap-4 pt-2 sm:pt-0 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-foreground truncate">Módulo de Caja</h1>
                {activeStore && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider truncate max-w-[120px]">
                    {activeStore.name}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Cobro de Tickets Pendientes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide w-full sm:w-auto pb-1 sm:pb-0">
          {/* Status Filter Pills */}
          <div className="flex bg-secondary rounded-lg p-1 gap-1">
            {STATUS_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${statusFilter === id
                  ? id === "PENDING" ? "bg-orange-500 text-white"
                    : id === "COMPLETED" ? "bg-emerald-600 text-white"
                      : id === "CANCELLED" ? "bg-red-500 text-white"
                        : "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary hover:bg-muted transition-colors border border-border"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>


          <span className="text-xs text-muted-foreground flex items-center gap-1.5 border-l border-border pl-3">
            <Clock className="w-3.5 h-3.5" />
            {lastRefresh.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>



          <button
            onClick={() => fetchTickets(false)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-muted-foreground text-xs font-bold transition-colors border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </header>

      {/* ── Summary bar ── */}
      <div className="px-4 sm:px-6 pt-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 p-3 bg-secondary/30 rounded-xl">
          <div className="flex items-center gap-2.5 shrink-0">
            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="text-orange-500 font-black text-lg">{sortedTickets.length}</span>
            <span className="text-muted-foreground text-sm font-medium">
              tickets {
                statusFilter === "PENDING" ? "pendientes" :
                  statusFilter === "COMPLETED" ? "pagados" :
                    statusFilter === "CANCELLED" ? "anulados" : "en total"
              }
            </span>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-between lg:justify-end gap-3 w-full lg:w-auto">
            {/* Badges de Contabilidad */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Badge Cobrado */}
              {(statusFilter === "ALL" || statusFilter === "COMPLETED" || breakdownTotals.cobrado > 0) && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-lg shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-extrabold text-[10px]">COBRADO:</span>
                  <span className="font-bold font-mono">S/ {breakdownTotals.cobrado.toFixed(2)}</span>
                </div>
              )}

              {/* Badge Por Cobrar */}
              {(statusFilter === "ALL" || statusFilter === "PENDING" || breakdownTotals.pendiente > 0) && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-lg shadow-sm">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-extrabold text-[10px]">POR COBRAR:</span>
                  <span className="font-bold font-mono">S/ {breakdownTotals.pendiente.toFixed(2)}</span>
                </div>
              )}

              {breakdownTotals.bancos > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/60 px-2.5 py-1 rounded-lg shadow-sm">
                  <Landmark className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-extrabold text-[10px]">BANCOS:</span>
                  <span className="font-bold font-mono">S/ {breakdownTotals.bancos.toFixed(2)}</span>
                </div>
              )}

              {breakdownTotals.bcp > 0 && (
                <div className="flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/60 px-2.5 py-1 rounded-lg shadow-sm">
                  <span className="font-extrabold text-[10px]">BCP:</span>
                  <span className="font-bold font-mono">S/ {breakdownTotals.bcp.toFixed(2)}</span>
                </div>
              )}

              {breakdownTotals.bbva > 0 && (
                <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 rounded-lg shadow-sm">
                  <span className="font-extrabold text-[10px]">BBVA:</span>
                  <span className="font-bold font-mono">S/ {breakdownTotals.bbva.toFixed(2)}</span>
                </div>
              )}

              {breakdownTotals.efectivo > 0 && (
                <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-lg shadow-sm">
                  <span className="font-extrabold text-[10px]">EFECTIVO:</span>
                  <span className="font-bold font-mono">S/ {breakdownTotals.efectivo.toFixed(2)}</span>
                </div>
              )}

              {breakdownTotals.izipay > 0 && (
                <div className="flex items-center gap-1 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 px-2.5 py-1 rounded-lg shadow-sm">
                  <span className="font-extrabold text-[10px]">IZIPAY:</span>
                  <span className="font-bold font-mono">S/ {breakdownTotals.izipay.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Separador vertical */}
            {permissions?.view_cashier_name && uniqueCashiers.length > 0 && (
              <div className="hidden sm:block w-px h-5 bg-border shrink-0" />
            )}

            {/* Filtro Multi-Select de Cajeros */}
            {permissions?.view_cashier_name && uniqueCashiers.length > 0 && (
              <div className="relative shrink-0" ref={cashierDropdownRef}>
                <button
                  onClick={() => setIsCashierDropdownOpen(prev => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${selectedCashierIds.size > 0
                    ? 'bg-indigo-500 text-white border-indigo-600 shadow-md shadow-indigo-500/30'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground shadow-sm'
                    }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Cajero
                  {selectedCashierIds.size > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/30 text-white text-[10px] font-black">
                      {selectedCashierIds.size}
                    </span>
                  )}
                  <svg className={`w-3 h-3 transition-transform ${isCashierDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isCashierDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-border flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Filtrar por cajero</span>
                      {selectedCashierIds.size > 0 && (
                        <button
                          onClick={() => setSelectedCashierIds(new Set())}
                          className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <div className="py-1 max-h-56 overflow-y-auto">
                      {uniqueCashiers.map(cashier => (
                        <label
                          key={cashier.id}
                          className="flex items-center gap-2.5 px-3 py-2 hover:bg-secondary cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCashierIds.has(cashier.id)}
                            onChange={() => {
                              const next = new Set(selectedCashierIds);
                              if (next.has(cashier.id)) next.delete(cashier.id);
                              else next.add(cashier.id);
                              setSelectedCashierIds(next);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-foreground truncate">{cashier.displayName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}


          </div>
        </div>
      </div>

      {/* ── Ticket List ── */}
      <main className="flex-1 p-4 sm:p-6">
        {(isLoadingStores || !activeStoreId || (isLoading && tickets.length === 0)) ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
            <RefreshCw className="w-10 h-10 animate-spin" />
            <p className="font-medium">Cargando tickets del día...</p>
          </div>
        ) : sortedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <p className="text-xl font-bold">
              {statusFilter === "PENDING" ? "¡Todo cobrado!" : "Sin resultados"}
            </p>
            <p className="text-muted-foreground text-sm">
              {statusFilter === "ALL"
                ? "No hay tickets por el momento."
                : `No hay tickets ${STATUS_FILTERS.find(f => f.id === statusFilter)?.label.toLowerCase()} por el momento.`}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-screen-xl mx-auto">
            {sortedTickets.map((ticket) => {
              const time = formatTime(ticket.created_at);
              const badge = statusBadge(ticket.status);
              const ticketNo = parseInternalTicketNum(ticket);
              const sunatDoc = starsoftDocNum(ticket);
              return (
                <div key={ticket.id} className="relative group">
                  <div
                    className={`w-full bg-card border-2 rounded-2xl p-5 text-left transition-all ${ticket.status === "PENDING"
                      ? "border-orange-500/30 hover:border-orange-500 hover:shadow-xl hover:shadow-orange-500/10 active:scale-[0.97] cursor-pointer"
                      : ticket.status === "COMPLETED"
                        ? "border-emerald-500/20 opacity-90 cursor-default"
                        : "border-red-500/20 opacity-60 cursor-default"
                      }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex flex-col min-w-0">
                        {(() => {
                          const isConsolidated = ticket.source_type === 'CONSOLIDATED' || (Array.isArray(ticket.children) && ticket.children.length > 0);
                          const childTickets = Array.isArray(ticket.children) && ticket.children.length > 0
                            ? ticket.children
                            : (Array.isArray(ticket._consolidated_tickets) ? ticket._consolidated_tickets : []);
                          const childNums = childTickets.map((c: any) => c.internal_ticket_number || parseInternalTicketNum(c)).filter(Boolean);

                          if (isConsolidated && childNums.length > 0) {
                            return (
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {childNums.map((num: number, idx: number) => (
                                    <React.Fragment key={idx}>
                                      <span className="font-black text-2xl text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-xl shadow-sm">
                                        #{num}
                                      </span>
                                      {idx < childNums.length - 1 && <span className="text-sm font-bold text-muted-foreground">+</span>}
                                    </React.Fragment>
                                  ))}
                                </div>
                                <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                                  UNIFICADO ({childNums.length} TICKETS)
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div className={`text-6xl font-black leading-none ${ticket.status === "PENDING" ? "text-foreground group-hover:text-orange-500 transition-colors" : "text-muted-foreground/50"}`}>
                              {formatTicketHash(ticketNo)}
                            </div>
                          );
                        })()}
                        {sunatDoc && (
                          <span className="text-xs text-muted-foreground font-mono mt-1.5">
                            Doc: {sunatDoc}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="space-y-2 border-t border-border pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs font-mono">{time}</span>
                        <span className="text-muted-foreground text-xs font-mono truncate max-w-[120px]">{ticket.proforma_number || ticket.invoice_number}</span>
                      </div>
                      <div className="text-muted-foreground text-xs truncate">{ticket.detail.split('\n')[0]}...</div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-muted-foreground text-sm font-bold">Total:</span>
                        <span className="text-2xl font-black font-mono">S/ {ticket.total.toFixed(2)}</span>
                      </div>

                      {ticket.status === "PENDING" ? (
                        <div className="flex gap-2">

                          <button
                            onClick={() => openModal(ticket)}
                            className="flex-[2] mt-3 h-10 rounded-xl text-white bg-orange-600 hover:bg-orange-500 font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center"
                          >
                            Cobrar
                          </button>
                        </div>
                      ) : ticket.status === "COMPLETED" ? (
                        <div className="flex flex-col gap-2 mt-3">
                          <span className="w-full h-10 rounded-xl text-white bg-blue-600 font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-default">
                            Completado
                          </span>
                          {permissions?.view_cashier_name && ticket.cashier && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center shrink-0">
                                <User className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <span className="text-[11px] font-semibold text-muted-foreground truncate">
                                Cobró: {getCashierDisplayName(ticket.cashier)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {ticket.status === "PENDING" && permissions?.delete_sales && (
                    <button
                      onClick={(e) => handleCancelTicket(ticket, e)}
                      className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 hover:scale-110"
                      title="Anular Ticket"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  {ticket.status === "COMPLETED" && permissions?.delete_sales && (
                    <button
                      onClick={(e) => handleCancelTicket(ticket, e)}
                      className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 hover:scale-110"
                      title="Anular ticket pagado"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-screen-xl mx-auto rounded-xl border border-border bg-card">
            <div className="w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
              <table className="w-full text-left text-sm">
                <thead className="bg-background text-muted-foreground border-b border-border select-none">
                  <tr>
                    {permissions?.caja_cobro_consolidado && (
                      <th className="p-2.5 w-10 text-center">
                        <CheckSquare className="w-4 h-4 mx-auto text-muted-foreground" />
                      </th>
                    )}
                    <th
                      onClick={() => requestSort("internal_ticket_number" as any)}
                      className="px-4 py-3 font-bold cursor-pointer group hover:text-foreground transition-colors"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span>Ticket</span>
                        {renderSortIcon("internal_ticket_number")}
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("proforma_number" as any)}
                      className="px-4 py-3 font-bold cursor-pointer group hover:text-foreground transition-colors"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span>Documento</span>
                        {renderSortIcon("proforma_number")}
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("efectivo_amt" as any)}
                      className="px-2 py-3 font-bold text-right cursor-pointer group hover:text-foreground transition-colors w-24"
                    >
                      <div className="inline-flex items-center justify-end gap-1.5 w-full">
                        <span>Efectivo</span>
                        {renderSortIcon("efectivo_amt")}
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("bcp_amt" as any)}
                      className="px-2 py-3 font-bold text-right cursor-pointer group hover:text-foreground transition-colors w-24"
                    >
                      <div className="inline-flex items-center justify-end gap-1.5 w-full">
                        <span>BCP</span>
                        {renderSortIcon("bcp_amt")}
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("bbva_amt" as any)}
                      className="px-2 py-3 font-bold text-right cursor-pointer group hover:text-foreground transition-colors w-24"
                    >
                      <div className="inline-flex items-center justify-end gap-1.5 w-full">
                        <span>BBVA</span>
                        {renderSortIcon("bbva_amt")}
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("izipay_amt" as any)}
                      className="px-2 py-3 font-bold text-right cursor-pointer group hover:text-foreground transition-colors w-24"
                    >
                      <div className="inline-flex items-center justify-end gap-1.5 w-full">
                        <span>Izipay</span>
                        {renderSortIcon("izipay_amt")}
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("total" as any)}
                      className="px-4 py-3 font-bold text-right whitespace-nowrap cursor-pointer group hover:text-foreground transition-colors"
                    >
                      <div className="inline-flex items-center justify-end gap-1.5 w-full">
                        <span>Total</span>
                        {renderSortIcon("total")}
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("status" as any)}
                      className="px-3 py-3 font-bold text-center cursor-pointer group hover:text-foreground transition-colors"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span>Estado</span>
                        {renderSortIcon("status")}
                      </div>
                    </th>
                    {permissions?.view_cashier_name && (
                      <th className="px-3 py-3 font-bold whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>Cobró</span>
                        </div>
                      </th>
                    )}
                    <th className="px-4 py-3 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedTickets.map((ticket) => (
                    <TicketTableRow
                      key={ticket.id}
                      ticket={ticket}
                      onSaveRow={handleSaveCajaRow}
                      isEditingRef={isEditingRef}
                      formatTicketHash={formatTicketHash}
                      parseInternalTicketNum={parseInternalTicketNum}
                      starsoftDocNum={starsoftDocNum}
                      inlineCellCls={inlineCellCls}
                      spinnerOff={spinnerOff}
                      statusBadge={statusBadge}
                      handleCancel={(t: any) => handleCancelTicket(t)}
                      openModal={openModal}
                      handleReprint={() => { }}
                      showToast={showToast}
                      permissions={permissions}
                      isSelected={selectedTicketIds.has(ticket.id)}
                      showCashierName={!!permissions?.view_cashier_name}
                      onOpenCashierInfo={(info: any) => setActiveCashierInfo(info)}
                      onToggleSelect={(id: string) => {
                        const newSet = new Set(selectedTicketIds);
                        if (newSet.has(id)) newSet.delete(id);
                        else newSet.add(id);
                        setSelectedTicketIds(newSet);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <ConfirmDialog
        isOpen={!!ticketToCancel}
        onCancel={() => setTicketToCancel(null)}
        onConfirm={confirmCancelTicket}
        title="Anular Proforma/Venta"
        description={`¿Estás seguro de que deseas anular el documento ${ticketToCancel?.proforma_number || ticketToCancel?.invoice_number || ''}?`}
        isLoading={isProcessing}
      />

      <CajaModals
        selectedTicket={selectedTicket}
        closeModal={closeModal}
        formatTicketHash={formatTicketHash}
        parseInternalTicketNum={parseInternalTicketNum}
        totalServices={totalServices}
        focusedMethod={focusedMethod}
        setPaymentAmounts={setPaymentAmounts}
        PAYMENT_METHODS={PAYMENT_METHODS}
        paymentAmounts={paymentAmounts}
        setFullAmount={setFullAmount}
        izipayVariant={izipayVariant}
        setIzipayVariant={setIzipayVariant}
        settings={settings}
        handleInputKeyDown={handleInputKeyDown}
        setFocusedMethod={setFocusedMethod}
        finalTotal={finalTotal}
        izipayFee={izipayFee}
        ticketTotal={ticketTotal}
        izipayRate={izipayRate}
        VOUCHER_TYPES={VOUCHER_TYPES}
        voucherType={voucherType}
        setVoucherType={setVoucherType}
        setSelectedCustomerId={setSelectedCustomerId}
        docNumber={docNumber}
        setDocNumber={setDocNumber}
        docName={docName}
        setDocName={setDocName}
        needsDocInfo={needsDocInfo}
        setCustomerQuery={setCustomerQuery}
        docNumberValid={docNumberValid}
        docNameValid={docNameValid}
        showDropdown={showDropdown}
        customerResults={customerResults}
        selectCustomer={selectCustomer}
        canConfirm={canConfirm}
        openReview={openReview}
        isReviewing={isReviewing}
        setIsReviewing={setIsReviewing}
        isSubmitting={isSubmitting}
        handleFinalSubmit={handleFinalSubmit}
        showSuccessModal={showSuccessModal}
        successSaleData={successSaleData}
        setShowSuccessModal={setShowSuccessModal}
      />

      {/* ── Modal / Nota Blanca de Detalle de Cajero (Cero scrollbars, cero overflow) ── */}
      {activeCashierInfo && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActiveCashierInfo(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-card border border-border shadow-2xl rounded-2xl p-5 max-w-xs w-full animate-in zoom-in-95 duration-150 text-foreground relative"
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Detalle de Cobro</h4>
                  <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">{activeCashierInfo.doc}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveCashierInfo(null)}
                className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-0.5">
                  Cobrado por
                </span>
                <p className="text-sm font-bold text-foreground">
                  {activeCashierInfo.name}
                </p>
              </div>

              {activeCashierInfo.username && (
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-0.5">
                    Cuenta de Usuario
                  </span>
                  <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    @{activeCashierInfo.username}
                  </p>
                </div>
              )}

              {activeCashierInfo.date && (
                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-0.5">
                      Fecha y Hora
                    </span>
                    <p className="text-xs font-semibold text-foreground">
                      {new Intl.DateTimeFormat('es-PE', {
                        timeZone: 'America/Lima',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      }).format(new Date(activeCashierInfo.date))}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveCashierInfo(null)}
              className="mt-4 w-full py-2 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-xl transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      {/* ── Floating Bar for Consolidated Billing ── */}
      {selectedTicketIds.size > 0 && !selectedTicket && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-gray-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-sm font-black shadow-lg shadow-indigo-500/50">{selectedTicketIds.size}</span>
            <span className="text-sm font-bold uppercase tracking-wider text-gray-300">Unificando {selectedTicketIds.size} proforma{selectedTicketIds.size !== 1 ? 's' : ''}</span>
          </div>
          <div className="w-px h-8 bg-gray-700/50"></div>
          {selectedTicketIds.size < 2 ? (
            <div className="flex flex-col items-center gap-0.5">
              <button
                disabled
                className="bg-gray-600 text-gray-400 px-6 py-2.5 rounded-full font-black text-sm cursor-not-allowed opacity-60 flex items-center gap-2"
              >
                COBRAR (S/ {sortedTickets.filter(t => selectedTicketIds.has(t.id)).reduce((sum, t) => sum + (t.total || 0), 0).toFixed(2)})
              </button>
              <span className="text-[10px] text-gray-400 font-semibold">Selecciona al menos 2 tickets para unificar</span>
            </div>
          ) : (
            <button
              onClick={() => {
                const selected = sortedTickets.filter(t => selectedTicketIds.has(t.id));
                const total = selected.reduce((sum, t) => sum + (t.total || 0), 0);
                const items = selected.flatMap(t => (t as any).items || []);
                const primarySellerId = selected.find((t: any) => t.seller_id)?.seller_id || null;
                const consolidated: any = {
                  id: "CONSOLIDATED",
                  proforma_number: "MÚLTIPLE",
                  internal_ticket_number: 999999,
                  total: total,
                  items: items,
                  status: "PENDING",
                  source_type: "CONSOLIDATED",
                  seller_id: primarySellerId,
                  cashier_id: null,
                  _consolidated_tickets: selected
                };
                setSelectedTicket(consolidated);
                setPaymentAmounts({ EFECTIVO: "", BCP: "", BBVA: "", IZIPAY: "" });
                setActivePayMethod("EFECTIVO");
              }}
              className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-full font-black text-sm transition-all shadow-lg shadow-orange-600/30 flex items-center gap-2 transform hover:scale-105 active:scale-95"
            >
              COBRAR (S/ {sortedTickets.filter(t => selectedTicketIds.has(t.id)).reduce((sum, t) => sum + (t.total || 0), 0).toFixed(2)})
            </button>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
