"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Separator,
} from "@goltex/ui";
import {
  CreditCard, Banknote, Smartphone, RefreshCw,
  CheckCircle2, AlertCircle, ArrowLeft, Clock, Receipt, XCircle,
  LayoutGrid, List, Trash2, Delete, Sun, Moon, FileText, User, Printer, Lock,
  ArrowUpDown, ArrowUp, ArrowDown
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
  voucher_type?: VoucherType | null;
  voucher_doc_number?: string | null;
  transactions?: any[];
  items?: any[] | string;
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
  permissions
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
    <tr id={`ticket-row-${ticket.id}`} className="hover:bg-secondary/30 transition-colors" onFocus={handleFocus} onBlur={handleBlur}>
      <td className="px-6 py-4">
        <div className="font-black text-xl">{formatTicketHash(ticketNo)}</div>
        {sunatDoc && (
          <span className="text-xs text-muted-foreground font-mono">Doc: {sunatDoc}</span>
        )}
      </td>
      <td className="px-6 py-4 text-muted-foreground font-mono">
        <div>{ticket.proforma_number}</div>
        {ticket.invoice_number && <div className="text-[10px] text-emerald-600 font-bold">{ticket.invoice_number}</div>}
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
      <td className="px-6 py-4 text-right whitespace-nowrap">
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
      <td className="px-6 py-4 text-center">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${badge.classes}`}>
          {badge.label}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-2">
          {ticket.status === "PENDING" ? (
            <>

              {permissions?.delete_sales && (
                <button
                  onClick={() => handleCancel(ticket)}
                  className="px-3 py-1.5 rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500/20 font-bold transition-colors"
                >
                  Anular
                </button>
              )}
              <button
                onClick={() => openModal(ticket)}
                className="px-4 py-1.5 rounded-lg text-white bg-orange-600 hover:bg-orange-500 font-bold shadow-lg shadow-orange-500/20 transition-all"
              >
                Cobrar
              </button>
            </>
          ) : ticket.status === "COMPLETED" ? (
            <span className="text-sm font-semibold text-purple-600">Completado</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export default function CajaPage() {
  const { role, username, isHydrated, permissions } = useRole();
  const { activeStore, activeStoreId, isAllStoresMode } = useStore();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  
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
  const isEditingRef = useRef(false);

  // ── Settings ──
  const [settings, setSettings] = useState<{ izipay_debit_fee: number; izipay_credit_fee: number }>({
    izipay_debit_fee: 4,
    izipay_credit_fee: 5
  });
  const [izipayVariant, setIzipayVariant] = useState<'DEBIT' | 'CREDIT'>('DEBIT');

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
          try { localStorage.setItem('cached_printer_config', JSON.stringify(data)); } catch (_) {}
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
        } catch (_) {}
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
  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" });
    const todayStr = formatter.format(now);

    let query = supabase
      .from("sales")
      .select("id, proforma_number, invoice_number, internal_ticket_number, total, detail, items, status, created_at, voucher_type, voucher_doc_number, seller_id, cashier_id, seller:profiles!seller_id(username), transactions(payment_method, amount, surcharge_pct, surcharge_amount)")
      .eq("record_date", todayStr)
      .order("created_at", { ascending: true });

    if (activeStoreId) {
      query = query.eq("store_id", activeStoreId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setTickets(data as PendingTicket[]);
      setLastRefresh(new Date());
    }
    setIsLoading(false);
  }, [activeStoreId]);

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
    fetchTickets();

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
        (payload) => {
          fetchTickets();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions"
        },
        (payload) => {
          fetchTickets();
        }
      )
      .subscribe();

    const interval = setInterval(fetchTickets, 5000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(cajaChannel);
    };
  }, [activeStoreId, fetchTickets]);

  // ── Filtered & Sorted tickets ──
  const enrichedFilteredTickets = useMemo(() => {
    const base = statusFilter === "ALL"
      ? tickets
      : tickets.filter(t => t.status === statusFilter);

    return base.map(t => {
      const txs = t.transactions || [];
      const sumBy = (m: string) => txs.filter((tx: any) => tx.payment_method === m).reduce((s: number, tx: any) => s + (tx.amount || 0), 0);
      return {
        ...t,
        efectivo_amt: sumBy("EFECTIVO"),
        bcp_amt: sumBy("BCP"),
        bbva_amt: sumBy("BBVA"),
        izipay_amt: sumBy("IZIPAY"),
      };
    });
  }, [tickets, statusFilter]);

  const { items: sortedTickets, requestSort, sortConfig } = useTableSort(enrichedFilteredTickets, {
    key: 'internal_ticket_number',
    direction: 'desc'
  });

  const filteredTotal = enrichedFilteredTickets.reduce((s, t) => s + t.total, 0);

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
      const internalTicketNum = selectedTicket.internal_ticket_number;
      if (internalTicketNum == null || internalTicketNum <= 0) {
        throw new Error("No se pudo determinar el número interno del ticket.");
      }

      let cashierId: string | null = null;
      if (username) {
        try {
          const { data: profData } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
          if (profData?.id) cashierId = profData.id;
        } catch (e) {}
      }

      const updatePayload: Record<string, unknown> = {
        status: "COMPLETED",
        total: finalTotal,
        invoice_number: null,
        voucher_type: voucherType,
        voucher_doc_number: needsDocInfo ? docNumber : String(internalTicketNum),
        voucher_doc_name: needsDocInfo ? docName.trim() : null,
        cashier_id: cashierId,
        updated_at: new Date().toISOString(),
      };
      if (selectedCustomerId) {
        updatePayload.customer_id = selectedCustomerId;
      }

      const { error: updateErr } = await supabase
        .from("sales")
        .update(updatePayload)
        .eq("id", selectedTicket.id);
      if (updateErr) throw updateErr;

      const txsToInsert = [];
      let sequence = 1;

      for (const [method, amountStr] of Object.entries(paymentAmounts)) {
        let amount = parseFloat(amountStr) || 0;
        if (amount <= 0) continue;

        const isIzipay = method === "IZIPAY";
        const surchargePct = isIzipay ? izipayRate : 0.0;
        const surchargeAmt = isIzipay ? izipayFee : 0.0;

        txsToInsert.push({
          sale_id: selectedTicket.id,
          payment_method: method,
          amount: amount,
          surcharge_pct: surchargePct,
          surcharge_amount: surchargeAmt,
          sequence: sequence++,
          original_detail: `Cobro en Caja — ${method}`,
        });
      }

      if (txsToInsert.length > 0) {
        const { error: txErr } = await supabase.from("transactions").insert(txsToInsert);
        if (txErr) throw txErr;
      }

      // ── Módulo de Impresión Integrada ──
      const saleDataForPrint = {
        ...selectedTicket,
        ...updatePayload,
        items: (selectedTicket as any).items || [],
        customer_name: docName,
        comment: (selectedTicket as any).detail,
      };

      setSuccessSaleData(saleDataForPrint);
      setShowSuccessModal(true);



      setTickets((prev) => prev.filter((t) => t.id !== selectedTicket.id));
      closeModal();
      fetchTickets();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al procesar el cobro.");
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
        } catch (e) {}
      }

      const { error } = await supabase.rpc('cancel_pos_ticket', {
        p_sale_id: ticketToCancel.id,
        p_cancel_reason: "Anulado por el Cajero",
        p_cancelled_by_id: cancellerId
      });
      if (error) throw error;

      setTickets((prev) => prev.map(t => t.id === ticketToCancel.id ? {
        ...t,
        status: "CANCELLED",
        updated_at: updated_at
      } : t));
      if (selectedTicket?.id === ticketToCancel.id) closeModal();
    } catch (err) {
      console.error(err);
      alert("Error al anular el ticket.");
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
              <br/><br/>
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
      <header className="bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-0 min-h-[4rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold leading-none truncate">Módulo de Caja</h1>
                {activeStore && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider truncate max-w-[120px]">
                    {activeStore.name}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">Cobro de Tickets Pendientes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            onClick={fetchTickets}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-muted-foreground text-xs font-bold transition-colors border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </header>

      {/* ── Summary bar ── */}
      <div className="bg-card/60 border-b border-border/50 px-6 py-3 flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          <span className="text-orange-500 font-black text-lg">{sortedTickets.length}</span>
          <span className="text-muted-foreground text-sm font-medium">
            tickets {
              statusFilter === "PENDING" ? "pendientes" :
                statusFilter === "COMPLETED" ? "pagados" :
                  statusFilter === "CANCELLED" ? "anulados" : "en total"
            }
          </span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {statusFilter === "PENDING" ? "Por cobrar:" : "Monto:"}
          </span>
          <span className="text-foreground font-black text-lg font-mono">S/ {filteredTotal.toFixed(2)}</span>
        </div>
        <div className="ml-auto text-xs text-muted-foreground font-mono">
          Auto-actualiza cada 5s
        </div>
      </div>

      {/* ── Ticket List ── */}
      <main className="flex-1 p-6">
        {isLoading && tickets.length === 0 ? (
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
              No hay tickets {STATUS_FILTERS.find(f => f.id === statusFilter)?.label.toLowerCase()} por el momento.
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
                        <div className={`text-6xl font-black leading-none ${ticket.status === "PENDING" ? "text-foreground group-hover:text-orange-500 transition-colors" : "text-muted-foreground/50"}`}>
                          {formatTicketHash(ticketNo)}
                        </div>
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
                        <span className="w-full mt-3 h-10 rounded-xl text-white bg-blue-600 font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-default">
                          Completado
                        </span>
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
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-screen-xl mx-auto overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-background text-muted-foreground border-b border-border select-none">
                <tr>
                  <th
                    onClick={() => requestSort("internal_ticket_number" as any)}
                    className="px-6 py-4 font-bold cursor-pointer group hover:text-foreground transition-colors"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>Ticket</span>
                      {renderSortIcon("internal_ticket_number")}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSort("proforma_number" as any)}
                    className="px-6 py-4 font-bold cursor-pointer group hover:text-foreground transition-colors"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>Documento</span>
                      {renderSortIcon("proforma_number")}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSort("efectivo_amt" as any)}
                    className="px-6 py-4 font-bold text-right cursor-pointer group hover:text-foreground transition-colors"
                  >
                    <div className="inline-flex items-center justify-end gap-1.5 w-full">
                      <span>Efectivo</span>
                      {renderSortIcon("efectivo_amt")}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSort("bcp_amt" as any)}
                    className="px-6 py-4 font-bold text-right cursor-pointer group hover:text-foreground transition-colors"
                  >
                    <div className="inline-flex items-center justify-end gap-1.5 w-full">
                      <span>BCP</span>
                      {renderSortIcon("bcp_amt")}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSort("bbva_amt" as any)}
                    className="px-6 py-4 font-bold text-right cursor-pointer group hover:text-foreground transition-colors"
                  >
                    <div className="inline-flex items-center justify-end gap-1.5 w-full">
                      <span>BBVA</span>
                      {renderSortIcon("bbva_amt")}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSort("izipay_amt" as any)}
                    className="px-6 py-4 font-bold text-right cursor-pointer group hover:text-foreground transition-colors"
                  >
                    <div className="inline-flex items-center justify-end gap-1.5 w-full">
                      <span>Izipay</span>
                      {renderSortIcon("izipay_amt")}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSort("total" as any)}
                    className="px-6 py-4 font-bold text-right whitespace-nowrap cursor-pointer group hover:text-foreground transition-colors"
                  >
                    <div className="inline-flex items-center justify-end gap-1.5 w-full">
                      <span>Total</span>
                      {renderSortIcon("total")}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSort("status" as any)}
                    className="px-6 py-4 font-bold cursor-pointer group hover:text-foreground transition-colors"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>Estado</span>
                      {renderSortIcon("status")}
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold text-right">Acciones</th>
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
                  />
                ))}
              </tbody>
            </table>
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

      {/* ════════════════════════════════════════
          PAYMENT MODAL (OPTIMIZADO PARA PC / TECLADO FÍSICO)
          ════════════════════════════════════════ */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent
          onClose={closeModal}
          className="w-[92vw] max-w-4xl max-h-[90vh] bg-card border-border text-foreground p-0 overflow-hidden flex flex-col"
        >
          {/* Header — identificación del ticket */}
          <div className="px-8 py-5 border-b border-border bg-background/50 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-3 flex-wrap">
                <span>Cobrar Ticket {selectedTicket ? formatTicketHash(parseInternalTicketNum(selectedTicket)) : ""}</span>
                <span className="text-sm font-mono text-muted-foreground font-normal">{selectedTicket?.proforma_number || selectedTicket?.invoice_number}</span>
              </DialogTitle>
              <DialogDescription className="hidden">Modal de cobro para PC</DialogDescription>
            </DialogHeader>
          </div>

          {/* Cuerpo */}
          <div className="px-8 pt-8 pb-14 space-y-8 flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Columna Izquierda: Métodos de Pago */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Métodos de Pago</span>
                  {totalServices > 0 && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!focusedMethod) return;
                        setPaymentAmounts(prev => ({
                          ...prev,
                          [focusedMethod]: totalServices.toFixed(2)
                        }));
                      }}
                      className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold px-4 py-1.5 rounded-full transition-colors border border-purple-200"
                    >
                      Atajo Servicios
                    </button>
                  )}
                </div>
                {PAYMENT_METHODS.map(({ id, label, Icon }) => {
                  const amount = paymentAmounts[id];
                  const hasValue = parseFloat(amount) > 0;

                  return (
                    <div
                      key={id}
                      className="flex flex-col gap-3 p-4 rounded-2xl border border-border bg-background/30 transition-all duration-300"
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${hasValue ? "bg-orange-500/20 text-orange-500" : "bg-secondary text-muted-foreground"
                          }`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground text-base leading-tight">{label}</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {id !== 'IZIPAY' && (
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={(e) => {
                                e.preventDefault();
                                setFullAmount(id);
                                setTimeout(() => {
                                  document.getElementById(`payment-input-${id}`)?.focus();
                                }, 0);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                }
                              }}
                              className="text-xs font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Exacto
                            </button>
                          )}
                          
                          {id === 'IZIPAY' && (
                            <div className="flex gap-1.5 animate-in slide-in-from-right-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIzipayVariant('DEBIT');
                                  setFullAmount(id, settings.izipay_debit_fee);
                                  setTimeout(() => document.getElementById(`payment-input-${id}`)?.focus(), 0);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${izipayVariant === 'DEBIT' ? 'bg-orange-100 text-orange-700 shadow-sm border border-orange-200' : 'bg-transparent text-muted-foreground border border-border hover:bg-secondary'}`}
                              >
                                {settings.izipay_debit_fee}%
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIzipayVariant('CREDIT');
                                  setFullAmount(id, settings.izipay_credit_fee);
                                  setTimeout(() => document.getElementById(`payment-input-${id}`)?.focus(), 0);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${izipayVariant === 'CREDIT' ? 'bg-orange-100 text-orange-700 shadow-sm border border-orange-200' : 'bg-transparent text-muted-foreground border border-border hover:bg-secondary'}`}
                              >
                                {settings.izipay_credit_fee}%
                              </button>
                            </div>
                          )}

                          <input
                            type="number"
                            id={`payment-input-${id}`}
                            value={amount}
                            min={0}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (parseFloat(val) < 0) {
                                setPaymentAmounts(prev => ({ ...prev, [id]: "0" }));
                              } else {
                                setPaymentAmounts(prev => ({ ...prev, [id]: val }));
                              }
                            }}
                            onFocus={() => setFocusedMethod(id)}
                            onKeyDown={(e) => handleInputKeyDown(e, id)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="0.00"
                            step="1"
                            className="w-28 bg-background border border-border rounded-lg py-1.5 px-3 text-right font-mono font-bold text-base transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/25 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Columna Derecha: Resumen & Cliente */}
              <div className="space-y-6">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider block mb-1">Total a Pagar</span>
                  <span className="text-4xl font-black text-emerald-500 font-mono leading-none block">
                    S/ {finalTotal.toFixed(2)}
                  </span>
                  {izipayFee > 0 && (
                    <span className="text-sm font-medium text-emerald-800/80 dark:text-emerald-200/80 mt-2 block">
                      Ticket: S/ {ticketTotal.toFixed(2)} + <span className="text-rose-600 dark:text-rose-400 font-bold">Recargo ({izipayRate}%): S/ {izipayFee.toFixed(2)}</span>
                    </span>
                  )}
                  {totalServices > 0 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-500/20">
                      <span className="text-xs text-emerald-700/80 font-medium">
                        (Incluye S/ {totalServices.toFixed(2)} en servicios)
                      </span>
                    </div>
                  )}
                </div>

                {/* Tipo de comprobante + inputs cliente */}
                <div className="space-y-4">
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider block">Comprobante</span>
                  <div className="flex gap-2">
                    {VOUCHER_TYPES.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setVoucherType(id);
                          setSelectedCustomerId(null);
                          if (id === "TICKET") {
                            setDocNumber("");
                            setDocName("CLIENTE VARIOS");
                          } else {
                            if (docName === "CLIENTE VARIOS") setDocName("");
                            setDocNumber("");
                          }
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${voucherType === id
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground/40"
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {needsDocInfo && (
                    <div className="space-y-3 relative">
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          placeholder={voucherType === "BOLETA" ? "DNI (8 dígitos)" : "RUC (11 dígitos)"}
                          value={docNumber}
                          maxLength={voucherType === "BOLETA" ? 8 : 11}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, "");
                            if (voucherType === "BOLETA" && val.length > 8) val = val.slice(0, 8);
                            if (voucherType === "FACTURA" && val.length > 11) val = val.slice(0, 11);
                            setDocNumber(val);
                            setCustomerQuery(val);
                          }}
                          className={`w-full pl-9 pr-12 py-2 rounded-lg border bg-background text-foreground font-mono text-sm outline-none transition-colors ${docNumber && !docNumberValid
                            ? "border-red-500"
                            : docNumberValid && docNumber
                              ? "border-emerald-500"
                              : "border-border"
                            }`}
                        />
                      </div>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          placeholder={voucherType === "BOLETA" ? "Nombre completo" : "Razón Social"}
                          value={docName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDocName(val);
                            setCustomerQuery(val);
                          }}
                          className={`w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-foreground text-sm outline-none transition-colors ${docName && !docNameValid
                            ? "border-red-500"
                            : docNameValid && docName
                              ? "border-emerald-500"
                              : "border-border"
                            }`}
                        />
                      </div>

                      {showDropdown && (
                        <div className="absolute top-[100%] mt-1 left-0 right-0 bg-card border border-border shadow-xl rounded-lg z-50 overflow-hidden flex flex-col">
                          {customerResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCustomer(c)}
                              className="w-full text-left px-3 py-2.5 hover:bg-secondary transition-colors border-b border-border/50 last:border-0 flex flex-col"
                            >
                              <span className="font-bold text-foreground text-xs truncate">{c.business_name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{c.doc_number || "Sin doc."}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer fijo — acciones */}
          <div className="shrink-0 border-t border-border px-8 pt-6 pb-8 bg-card flex gap-4">
            <button
              onClick={closeModal}
              className="h-12 flex-1 rounded-xl border border-border text-muted-foreground hover:bg-secondary font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" /> VOLVER
            </button>
            <button
              id="btn-confirmar-cobro"
              onClick={openReview}
              disabled={!canConfirm}
              className={`h-12 flex-[2] rounded-xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${!canConfirm
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/30"
                }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Confirmar Cobro
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════
          REVIEW MODAL — confirm before DB write
          ════════════════════════════════════════ */}
      {isReviewing && selectedTicket && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border-2 border-border rounded-2xl shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border bg-background/50">
              <div className="text-lg font-black text-foreground">Revisar y Confirmar</div>
              <div className="text-xs text-muted-foreground mt-0.5">Verifica los datos antes de guardar</div>
            </div>

            {/* Summary Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Bloque 1: Comprobante y Cliente */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1">
                <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  COMPROBANTE
                </span>
                <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {voucherType === "TICKET" ? (
                    "Ticket / Simple"
                  ) : voucherType === "BOLETA" ? (
                    `Boleta ${docNumber ? `— ${docNumber}` : ""}`
                  ) : (
                    `Factura ${docNumber ? `— ${docNumber}` : ""}`
                  )}
                </div>
                {docName && (
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    {docName}
                  </div>
                )}
              </div>

              {/* Bloque 2: Desglose de Pago */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  Desglose de Pago
                </span>
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {PAYMENT_METHODS.filter(m => parseFloat(paymentAmounts[m.id]) > 0).map(m => (
                    <div key={m.id} className="flex justify-between items-center py-1.5 text-sm">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        {m.label}
                        {m.id === "IZIPAY" && izipayFee > 0 && (
                          <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-extrabold border border-amber-200">
                            +S/ {izipayFee.toFixed(2)} ({izipayRate}%)
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        S/ {parseFloat(paymentAmounts[m.id]).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloque 3: Total Cobrado */}
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Total Cobrado
                </span>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  S/ {finalTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setIsReviewing(false)}
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-xl border border-border text-muted-foreground hover:bg-secondary font-bold text-sm transition-colors"
              >
                ← Volver
              </button>
              <button
                id="btn-review-confirm"
                autoFocus
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className={`flex-[2] h-11 rounded-xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${isSubmitting
                  ? "bg-emerald-800 text-emerald-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                  }`}
              >
                {isSubmitting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> CONFIRMAR</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Print Modal ── */}
      {showSuccessModal && successSaleData && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">¡Venta Exitosa!</h2>
            <p className="text-gray-500 text-center mb-6">El cobro ha sido procesado correctamente.</p>



            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full font-bold py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              CERRAR
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
