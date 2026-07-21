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
  LayoutGrid, List, Trash2, Delete, Sun, Moon, FileText, User, Printer
} from "lucide-react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import {
  formatTicketHash,
  parseInternalTicketNum,
  starsoftDocNumFromTicket,
} from "../lib/ticket-sequence";
import { useRole } from "../context/RoleContext";
import { useTheme } from "../context/ThemeContext";
import { requestBluetoothDevice, printSaleReceipt, silentPrintSaleReceipt } from '../configuracion/utils/printerEngine';

// ─────────────── Types ───────────────
type SaleStatus = "PENDING" | "COMPLETED" | "CANCELLED";
type StatusFilter = "PENDING" | "COMPLETED" | "CANCELLED" | "ALL";
type PaymentMethod = "EFECTIVO" | "BCP" | "BBVA" | "IZIPAY";
type VoucherType = "TICKET" | "BOLETA" | "FACTURA";

type PendingTicket = {
  id: string;
  document_number: string;
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

const VOUCHER_TYPES: { id: VoucherType; label: string; icon: string }[] = [
  { id: "TICKET", label: "Ticket / Simple", icon: "🎫" },
  { id: "BOLETA", label: "Boleta (DNI)", icon: "📄" },
  { id: "FACTURA", label: "Factura (RUC)", icon: "🏢" },
];

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
  showToast
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
      <td className="px-6 py-4 text-muted-foreground font-mono">{ticket.document_number}</td>
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
            value={rowBuffer.izipay}
            onChange={(e) => handleChange('izipay', e.target.value)}
            onKeyDown={handleKeyDown}
            onWheel={(e) => e.currentTarget.blur()}
            className={`${inlineCellCls} text-right text-gray-700 dark:text-gray-200 ${spinnerOff}`}
          />
        )}
      </td>
      <td className="px-6 py-4 text-right whitespace-nowrap">
        {ticket.status === "PENDING" ? (
          <span className="font-black text-emerald-500 dark:text-emerald-400 text-lg">—</span>
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

              <button
                onClick={() => handleCancel(ticket)}
                className="px-3 py-1.5 rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500/20 font-bold transition-colors"
              >
                Anular
              </button>
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
  const { role, username, isHydrated } = useRole();
  const { theme, toggleTheme } = useTheme();
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };
  const router = useRouter();

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
      const { data } = await supabase.from('printers').select('*').order('auto_print', { ascending: false }).limit(1).single();
      if (data) {
        setActivePrinter(data);
        if (data.type === 'bluetooth') {
          const nav = navigator as any;
          if (nav.bluetooth && nav.bluetooth.getDevices) {
            try {
              const devices = await nav.bluetooth.getDevices();
              if (devices.length > 0) {
                setBtDeviceObj(devices[0]);
              }
            } catch (e) {
              console.log('No silent BT access', e);
            }
          }
        }
      }
    }
    loadPrinter();
  }, []);

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
  const [customerResults, setCustomerResults] = useState<{ id: string, ruc: string, business_name: string }[]>([]);
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
        .select("id, ruc, business_name")
        .or(`ruc.ilike.%${customerQuery}%,business_name.ilike.%${customerQuery}%`)
        .limit(5);

      if (data && data.length > 0) {
        setCustomerResults(data);
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const selectCustomer = (c: { ruc: string, business_name: string }) => {
    setDocNumber(c.ruc || "");
    setDocName(c.business_name || "");
    setShowDropdown(false);
    setCustomerQuery("");
  };

  // ── Redirect if wrong role ──
  useEffect(() => {
    if (isHydrated && role === 'VENDEDOR') {
      router.push('/pos');
    }
  }, [isHydrated, role, router]);

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
  const vuelto = Math.round(totalPaid * 100) >= Math.round(finalTotal * 100)
    ? Math.round((totalPaid - finalTotal) * 100) / 100
    : 0;

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
  const canConfirm = Math.round(totalPaid * 100) >= Math.round(finalTotal * 100) && finalTotal > 0 && docNumberValid && docNameValid;

  // ─────────────── Data Fetching ───────────────
  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" });
    const todayStr = formatter.format(now);

    const query = supabase
      .from("sales")
      .select("id, document_number, internal_ticket_number, total, detail, items, status, created_at, voucher_type, voucher_doc_number, transactions(payment_method, amount, surcharge_pct, surcharge_amount)")
      .eq("record_date", todayStr)
      .order("created_at", { ascending: true });

    const { data, error } = await query;

    if (!error && data) {
      setTickets(data as PendingTicket[]);
      setLastRefresh(new Date());
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase.from('settings').select('*');
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
  }, []);

  useEffect(() => {
    fetchTickets();
    const channel = supabase
      .channel("caja-sales-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    const interval = setInterval(fetchTickets, 5000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchTickets]);

  // ── Filtered tickets ──
  const filteredTickets = statusFilter === "ALL"
    ? tickets
    : tickets.filter(t => t.status === statusFilter);

  const filteredTotal = filteredTickets.reduce((s, t) => s + t.total, 0);

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
      const starsoftDoc = `B002-${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
      const internalTicketNum = selectedTicket.internal_ticket_number;
      if (internalTicketNum == null || internalTicketNum <= 0) {
        throw new Error("No se pudo determinar el número interno del ticket.");
      }

      // Encode cajero into source_sheet: keep vendedor prefix, append cajero
      const cajeroTag = username ? `|CAJERO:${username}` : "";

      const updatePayload: Record<string, unknown> = {
        status: "COMPLETED",
        total: finalTotal,
        document_number: starsoftDoc,
        voucher_type: voucherType,
        voucher_doc_number: needsDocInfo ? docNumber : String(internalTicketNum),
        voucher_doc_name: needsDocInfo ? docName.trim() : null,
        source_sheet: `${(selectedTicket as any).source_sheet || ""}${cajeroTag}`,
      };

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

        if (method === "EFECTIVO" && vuelto > 0) {
          amount -= vuelto;
          if (amount <= 0) continue;
        }

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
      const currentSourceSheet = (ticketToCancel as any).source_sheet || '';
      const newSourceSheet = `${currentSourceSheet}|ANULADO:${username}`;
      const updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("sales")
        .update({
          status: "CANCELLED",
          source_sheet: newSourceSheet,
          updated_at: updated_at
        })
        .eq("id", ticketToCancel.id);
      if (error) throw error;

      setTickets((prev) => prev.map(t => t.id === ticketToCancel.id ? {
        ...t,
        status: "CANCELLED",
        source_sheet: newSourceSheet,
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

  if (!isHydrated || role === 'VENDEDOR') return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Receipt className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">Módulo de Caja</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Cobro de Tickets Pendientes</p>
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
          <span className="text-orange-500 font-black text-lg">{filteredTickets.length}</span>
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
        ) : filteredTickets.length === 0 ? (
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
            {filteredTickets.map((ticket) => {
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
                        <span className="text-muted-foreground text-xs font-mono truncate max-w-[120px]">{ticket.document_number}</span>
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
                  {ticket.status === "PENDING" && (
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
          <div className="max-w-screen-xl mx-auto overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-background text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">Ticket</th>
                  <th className="px-6 py-4 font-bold">Documento</th>
                  <th className="px-6 py-4 font-bold text-right">Efectivo</th>
                  <th className="px-6 py-4 font-bold text-right">BCP</th>
                  <th className="px-6 py-4 font-bold text-right">BBVA</th>
                  <th className="px-6 py-4 font-bold text-right">Izipay</th>
                  <th className="px-6 py-4 font-bold text-right whitespace-nowrap">Total</th>
                  <th className="px-6 py-4 font-bold">Estado</th>
                  <th className="px-6 py-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTickets.map((ticket) => (
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
        description={`¿Estás seguro de que deseas anular el documento ${ticketToCancel?.document_number || ''}?`}
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
                <span className="text-sm font-mono text-muted-foreground font-normal">{selectedTicket?.document_number}</span>
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
                
                {/* Vuelto Badge */}
                {vuelto > 0 && (
                  <div className="flex justify-end -mt-2">
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 font-bold px-4 py-1.5 rounded-full shadow-sm text-sm">
                      Vuelto: S/ {vuelto.toFixed(2)}
                    </div>
                  </div>
                )}

                {/* Tipo de comprobante + inputs cliente */}
                <div className="space-y-4">
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider block">Comprobante</span>
                  <div className="flex gap-2">
                    {VOUCHER_TYPES.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setVoucherType(id); setDocNumber(""); setDocName(""); }}
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
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
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
                              <span className="font-mono text-[10px] text-muted-foreground">{c.ruc || "Sin doc."}</span>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border-2 border-border rounded-2xl shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border bg-background/50">
              <div className="text-lg font-black text-foreground">Revisar y Confirmar</div>
              <div className="text-xs text-muted-foreground mt-0.5">Verifica los datos antes de guardar</div>
            </div>

            {/* Summary */}
            <div className="px-6 py-5 space-y-4">
              {/* Comprobante */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Comprobante</span>
                <span className="font-bold text-foreground">
                  {voucherType === "TICKET" ? "🎫 Ticket / Simple" : voucherType === "BOLETA" ? `📄 Boleta — ${docNumber} ${docName}` : `🏢 Factura — ${docNumber} ${docName}`}
                </span>
              </div>

              {/* Payment breakdown */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase">Desglose de Pago</div>
                {PAYMENT_METHODS.filter(m => parseFloat(paymentAmounts[m.id]) > 0).map(m => (
                  <div key={m.id} className="flex justify-between items-center text-sm">
                    <span className="font-bold text-foreground flex items-center gap-2">
                      {m.label}
                      {m.id === "IZIPAY" && izipayFee > 0 && (
                        <span className="text-[10px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded font-black border border-orange-200">
                          +S/ {izipayFee.toFixed(2)} ({izipayRate}%)
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-bold text-foreground">S/ {parseFloat(paymentAmounts[m.id]).toFixed(2)}</span>
                  </div>
                ))}
                {vuelto > 0 && (
                  <div className="flex justify-between items-center text-sm text-rose-600 border-t border-border pt-2 mt-1">
                    <span className="font-bold">Vuelto a entregar</span>
                    <span className="font-mono font-black">S/ {vuelto.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mt-2">
                <span className="text-sm font-bold text-emerald-700 uppercase">Total Cobrado</span>
                <span className="text-3xl font-black text-emerald-600 font-mono">S/ {finalTotal.toFixed(2)}</span>
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
