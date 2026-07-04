"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Separator,
} from "@goltex/ui";
import {
  CreditCard, Banknote, Smartphone, RefreshCw,
  CheckCircle2, AlertCircle, ArrowLeft, Clock, Receipt, XCircle,
  LayoutGrid, List, Trash2, Delete, Sun, Moon, FileText, User,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  formatTicketHash,
  parseInternalTicketNum,
  starsoftDocNumFromTicket,
} from "../lib/ticket-sequence";
import { useRole } from "../context/RoleContext";
import { useTheme } from "../context/ThemeContext";

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
};

type DocField = "docNumber" | "docName" | null;

const PAYMENT_METHODS: { id: PaymentMethod; label: string; sub: string; Icon: React.ElementType }[] = [
  { id: "EFECTIVO", label: "Efectivo", sub: "Dinero en mano", Icon: Banknote },
  { id: "BCP",      label: "BCP",      sub: "Yape / Transf.", Icon: Smartphone },
  { id: "BBVA",     label: "BBVA",     sub: "Plin / Transf.", Icon: Smartphone },
  { id: "IZIPAY",   label: "Izipay",   sub: "+ Recargo 4%",   Icon: CreditCard },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "PENDING",   label: "Pendientes" },
  { id: "COMPLETED", label: "Pagados" },
  { id: "CANCELLED", label: "Anulados" },
  { id: "ALL",       label: "Todos" },
];

const VOUCHER_TYPES: { id: VoucherType; label: string; icon: string }[] = [
  { id: "TICKET",  label: "Ticket / Simple", icon: "🎫" },
  { id: "BOLETA",  label: "Boleta (DNI)",    icon: "📄" },
  { id: "FACTURA", label: "Factura (RUC)",   icon: "🏢" },
];

// ─────────────── Component ───────────────
export default function CajaPage() {
  const { role, isHydrated } = useRole();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [tickets, setTickets] = useState<PendingTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");

  // ── Payment modal ──
  const [selectedTicket, setSelectedTicket] = useState<PendingTicket | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePayMethod, setActivePayMethod] = useState<PaymentMethod>("EFECTIVO");
  const [paymentAmounts, setPaymentAmounts] = useState<Record<PaymentMethod, string>>({
    EFECTIVO: "", BCP: "", BBVA: "", IZIPAY: "",
  });

  // ── Voucher / Comprobante ──
  const [voucherType, setVoucherType] = useState<VoucherType>("TICKET");
  const [docNumber, setDocNumber] = useState("");
  const [docName, setDocName] = useState("");
  const [activeDocField, setActiveDocField] = useState<DocField>(null);

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
  const izipayFee = izipayAmount - (izipayAmount / 1.04);
  const finalTotal = ticketTotal + izipayFee;
  const totalPaid = Object.values(paymentAmounts).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  const vuelto = Math.round(totalPaid * 100) >= Math.round(finalTotal * 100)
    ? Math.round((totalPaid - finalTotal) * 100) / 100
    : 0;

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
      .select("id, document_number, internal_ticket_number, total, detail, status, created_at, voucher_type, voucher_doc_number")
      .eq("record_date", todayStr)
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (!error && data) {
      setTickets(data as PendingTicket[]);
      setLastRefresh(new Date());
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
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

  const handleConfirmPayment = async () => {
    if (!selectedTicket || !canConfirm) return;
    setIsProcessing(true);

    try {
      const starsoftDoc = `B002-${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
      const internalTicketNum = selectedTicket.internal_ticket_number;
      if (internalTicketNum == null || internalTicketNum <= 0) {
        throw new Error("No se pudo determinar el número interno del ticket.");
      }

      const updatePayload: Record<string, unknown> = {
        status: "COMPLETED",
        total: finalTotal,
        document_number: starsoftDoc,
        voucher_type: voucherType,
        voucher_doc_number: needsDocInfo ? docNumber : String(internalTicketNum),
        voucher_doc_name: needsDocInfo ? docName.trim() : null,
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
        const surchargePct = isIzipay ? 4.0 : 0.0;
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

      setTickets((prev) => prev.filter((t) => t.id !== selectedTicket.id));
      closeModal();
      fetchTickets();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al procesar el cobro.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelTicket = async (ticket: PendingTicket, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`¿Estás seguro de que deseas anular el ${ticket.document_number}?`)) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("sales")
        .update({ status: "CANCELLED" })
        .eq("id", ticket.id);
      if (error) throw error;

      setTickets((prev) => prev.map(t => t.id === ticket.id ? { ...t, status: "CANCELLED" } : t));
      if (selectedTicket?.id === ticket.id) closeModal();
    } catch (err) {
      console.error(err);
      alert("Error al anular el ticket.");
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    if (isProcessing) return;
    setSelectedTicket(null);
    setActivePayMethod("EFECTIVO");
    setPaymentAmounts({ EFECTIVO: "", BCP: "", BBVA: "", IZIPAY: "" });
    setVoucherType("TICKET");
    setDocNumber("");
    setDocName("");
    setActiveDocField(null);
  };

  const openModal = (ticket: PendingTicket) => {
    setSelectedTicket(ticket);
    setActivePayMethod("EFECTIVO");
    setPaymentAmounts({ EFECTIVO: "", BCP: "", BBVA: "", IZIPAY: "" });
    setVoucherType("TICKET");
    setDocNumber("");
    setDocName("");
    setActiveDocField(null);
  };

  const setFullAmount = (method: PaymentMethod) => {
    setActiveDocField(null);
    let basePaidOthers = 0;
    for (const [m, valStr] of Object.entries(paymentAmounts)) {
      if (m === method) continue;
      const v = parseFloat(valStr) || 0;
      if (m === "IZIPAY") {
        basePaidOthers += v / 1.04;
      } else {
        basePaidOthers += v;
      }
    }
    const baseRemaining = Math.max(0, ticketTotal - basePaidOthers);

    if (method === "IZIPAY") {
      const izipayTotal = baseRemaining * 1.04;
      setPaymentAmounts(prev => ({ ...prev, [method]: izipayTotal.toFixed(2) }));
    } else {
      setPaymentAmounts(prev => ({ ...prev, [method]: baseRemaining.toFixed(2) }));
    }
  };

  const docNumberMaxLen = voucherType === "BOLETA" ? 8 : 11;

  const handleDocNumericKey = (key: string) => {
    if (key === "DEL") {
      setDocNumber((prev) => {
        const next = prev.slice(0, -1);
        setCustomerQuery(next);
        return next;
      });
      return;
    }
    if (key === "CLEAR") {
      setDocNumber("");
      setCustomerQuery("");
      return;
    }
    setDocNumber((prev) => {
      if (prev.length >= docNumberMaxLen) return prev;
      const next = prev + key;
      setCustomerQuery(next);
      return next;
    });
  };

  const handleDocTextKey = (key: string) => {
    if (key === "DEL") {
      setDocName((prev) => {
        const next = prev.slice(0, -1);
        setCustomerQuery(next);
        return next;
      });
      return;
    }
    if (key === "SPACE") {
      setDocName((prev) => {
        const next = `${prev} `;
        setCustomerQuery(next);
        return next;
      });
      return;
    }
    setDocName((prev) => {
      const next = prev + key;
      setCustomerQuery(next);
      return next;
    });
  };

  // ── Format helpers ──
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  const starsoftDocNum = (ticket: PendingTicket) => starsoftDocNumFromTicket(ticket);

  const statusBadge = (status: SaleStatus) => {
    if (status === "PENDING")   return { label: "Pendiente", classes: "bg-orange-500/20 text-orange-500 border border-orange-500/30" };
    if (status === "COMPLETED") return { label: "Pagado",    classes: "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" };
    return                             { label: "Anulado",   classes: "bg-red-500/20 text-red-500 border border-red-500/30" };
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
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                  statusFilter === id
                    ? id === "PENDING"   ? "bg-orange-500 text-white"
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
          Auto-actualiza cada 30s
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
                  <button
                    onClick={() => ticket.status === "PENDING" ? openModal(ticket) : undefined}
                    disabled={ticket.status !== "PENDING"}
                    className={`w-full bg-card border-2 rounded-2xl p-5 text-left transition-all ${
                      ticket.status === "PENDING"
                        ? "border-orange-500/30 hover:border-orange-500 hover:shadow-xl hover:shadow-orange-500/10 active:scale-[0.97] cursor-pointer"
                        : ticket.status === "COMPLETED"
                        ? "border-emerald-500/20 opacity-75 cursor-default"
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
                        {ticket.status === "PENDING" && (
                          <span className="text-muted-foreground text-xs font-mono truncate max-w-[120px]">{ticket.document_number}</span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-xs truncate">{ticket.detail.split('\n')[0]}...</div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-muted-foreground text-sm font-bold">Total:</span>
                        <span className="text-2xl font-black font-mono">S/ {ticket.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </button>
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
                  <th className="px-6 py-4 font-bold">Hora</th>
                  <th className="px-6 py-4 font-bold">Documento</th>
                  <th className="px-6 py-4 font-bold">Estado</th>
                  <th className="px-6 py-4 font-bold">Total</th>
                  <th className="px-6 py-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTickets.map((ticket) => {
                  const badge = statusBadge(ticket.status);
                  const ticketNo = parseInternalTicketNum(ticket);
                  const sunatDoc = starsoftDocNum(ticket);
                  return (
                    <tr key={ticket.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-black text-xl">{formatTicketHash(ticketNo)}</div>
                        {sunatDoc && (
                          <span className="text-xs text-muted-foreground font-mono">Doc: {sunatDoc}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono">{formatTime(ticket.created_at)}</td>
                      <td className="px-6 py-4 text-muted-foreground font-mono">{ticket.document_number}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-emerald-500 text-lg">S/ {ticket.total.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {ticket.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleCancelTicket(ticket)}
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
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════
          PAYMENT MODAL (SPLIT PAYMENTS - NUMPAD TÁCTIL)
          ════════════════════════════════════════ */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent
          onClose={closeModal}
          className="w-[92vw] max-w-6xl h-[85vh] sm:max-w-6xl bg-card border-border text-foreground p-0 overflow-hidden flex flex-col"
        >
          {/* Header — identificación del ticket */}
          <div className="px-8 py-5 border-b border-border bg-background/50 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-3 flex-wrap">
                <span>Cobrar Ticket {selectedTicket ? formatTicketHash(parseInternalTicketNum(selectedTicket)) : ""}</span>
                <span className="text-sm font-mono text-muted-foreground font-normal">{selectedTicket?.document_number}</span>
              </DialogTitle>
              <DialogDescription className="hidden">Modal de cobro con teclado táctil</DialogDescription>
            </DialogHeader>
          </div>

          {/* Cuerpo — split 65% scroll / 35% fijo */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Columna izquierda (65%) — scrollable */}
            <div className="w-[65%] flex-1 overflow-y-auto p-8 pr-5 space-y-6">
              <div className="space-y-4">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Métodos de Pago</span>
                {PAYMENT_METHODS.map(({ id, label, sub, Icon }) => {
                  const amount = paymentAmounts[id];
                  const isSelected = activePayMethod === id && activeDocField === null;
                  const hasValue = parseFloat(amount) > 0;

                  return (
                    <div
                      key={id}
                      onClick={() => { setActiveDocField(null); setActivePayMethod(id); }}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-orange-500 bg-orange-500/10 shadow-lg"
                          : "border-border bg-background/30 hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-orange-500 text-white" : hasValue ? "bg-orange-500/20 text-orange-500" : "bg-secondary text-muted-foreground"
                      }`}>
                        <Icon className="w-7 h-7" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground text-xl leading-tight">{label}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">{sub}</div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setActiveDocField(null); setActivePayMethod(id); setFullAmount(id); }}
                          className="text-sm font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-lg transition-colors touch-manipulation"
                        >
                          Exacto
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveDocField(null); setActivePayMethod(id); }}
                          className={`min-w-[8.5rem] bg-background border rounded-xl py-3 px-4 text-right font-mono font-bold text-xl transition-colors touch-manipulation ${
                            isSelected ? "border-orange-500 text-foreground ring-2 ring-orange-500/20" : "border-border text-muted-foreground"
                          }`}
                        >
                          S/ {amount || "0.00"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tipo de comprobante + inputs cliente */}
              <div className="pt-5 border-t border-border">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Tipo de Comprobante</span>
                </div>
                <div className="flex gap-3 mb-4">
                  {VOUCHER_TYPES.map(({ id, label, icon }) => (
                    <button
                      key={id}
                      onClick={() => { setVoucherType(id); setDocNumber(""); setDocName(""); setActiveDocField(null); }}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl border-2 text-base font-bold transition-all touch-manipulation ${
                        voucherType === id
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                    >
                      <span className="text-2xl">{icon}</span>
                      <span className="text-center leading-tight">{label}</span>
                    </button>
                  ))}
                </div>

                {needsDocInfo && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 relative">
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        readOnly
                        inputMode="none"
                        placeholder={voucherType === "BOLETA" ? "DNI (8 dígitos)" : "RUC (11 dígitos)"}
                        value={docNumber}
                        onFocus={() => {
                          setActiveDocField("docNumber");
                          if (customerResults.length > 0) setShowDropdown(true);
                        }}
                        className={`w-full pl-12 pr-16 py-4 rounded-xl border-2 bg-background text-foreground font-mono text-xl font-bold outline-none transition-colors cursor-pointer touch-manipulation ${
                          activeDocField === "docNumber" ? "border-indigo-500 ring-2 ring-indigo-500/20" : ""
                        } ${
                          docNumber && !docNumberValid
                            ? "border-red-500"
                            : docNumberValid && docNumber
                            ? "border-emerald-500"
                            : activeDocField !== "docNumber" ? "border-border" : ""
                        }`}
                      />
                      {docNumber && (
                        <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold ${docNumberValid ? "text-emerald-500" : "text-red-500"}`}>
                          {docNumber.length}/{voucherType === "BOLETA" ? 8 : 11}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        readOnly
                        inputMode="none"
                        placeholder={voucherType === "BOLETA" ? "Nombre completo del cliente" : "Razón Social"}
                        value={docName}
                        onFocus={() => {
                          setActiveDocField("docName");
                          if (customerResults.length > 0) setShowDropdown(true);
                        }}
                        className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 bg-background text-foreground text-xl font-bold outline-none transition-colors cursor-pointer touch-manipulation ${
                          activeDocField === "docName" ? "border-indigo-500 ring-2 ring-indigo-500/20" : ""
                        } ${
                          docName && !docNameValid
                            ? "border-red-500"
                            : docNameValid && docName
                            ? "border-emerald-500"
                            : activeDocField !== "docName" ? "border-border" : ""
                        }`}
                      />
                    </div>

                    {showDropdown && (
                      <div className="absolute top-[100%] mt-1 left-0 right-0 bg-card border border-border shadow-xl rounded-xl z-50 overflow-hidden flex flex-col">
                        <div className="px-3 py-2 bg-secondary/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border flex justify-between items-center">
                          Coincidencias
                          <button onClick={() => setShowDropdown(false)} className="hover:text-foreground">✕</button>
                        </div>
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors border-b border-border/50 last:border-0 flex flex-col gap-0.5"
                          >
                            <span className="font-bold text-foreground text-sm truncate">{c.business_name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{c.ruc || "Sin doc."}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {(!docNumberValid && docNumber) && (
                      <p className="text-red-500 text-base font-bold">
                        {voucherType === "BOLETA" ? "El DNI debe tener 8 dígitos." : "El RUC debe tener 11 dígitos."}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Resumen de pago (scroll con el contenido izquierdo) */}
              <div className="pt-5 border-t border-border space-y-4">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-muted-foreground font-bold">Total Ingresado:</span>
                  <span className="text-xl font-bold font-mono">S/ {totalPaid.toFixed(2)}</span>
                </div>
                {vuelto > 0 && (
                  <div className="flex items-center justify-between bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
                    <span className="text-emerald-600 dark:text-emerald-400 font-black text-lg">VUELTO A ENTREGAR:</span>
                    <span className="text-3xl font-black text-emerald-500 font-mono">S/ {vuelto.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Columna derecha (35%) — fija: total + teclado */}
            <div className="w-[35%] shrink-0 border-l border-border bg-secondary/20 p-5 flex flex-col gap-5 overflow-hidden self-stretch">
              <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-5 shrink-0">
                <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider block mb-2">Total a Pagar</span>
                <span className="text-5xl font-black text-emerald-500 font-mono leading-none block">
                  S/ {finalTotal.toFixed(2)}
                </span>
                {izipayFee > 0 && (
                  <span className="text-orange-500 text-sm font-bold mt-3 block">
                    Recargo Izipay: S/ {izipayFee.toFixed(2)}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-4 flex-1 min-h-0">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                  Teclado:{" "}
                  <span className={`font-bold ${
                    activeDocField === "docNumber" || activeDocField === "docName"
                      ? "text-indigo-500"
                      : "text-orange-500"
                  }`}>
                    {activeDocField === "docNumber"
                      ? (voucherType === "BOLETA" ? "DNI" : "RUC")
                      : activeDocField === "docName"
                      ? "Nombre"
                      : activePayMethod}
                  </span>
                </span>

                {activeDocField === "docNumber" ? (
                  <div className="grid grid-cols-3 gap-2 bg-background/60 p-4 rounded-2xl border border-border/80">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleDocNumericKey(num)}
                        className="h-16 text-lg font-bold rounded-xl bg-secondary hover:bg-muted active:bg-indigo-500 active:text-white transition-colors touch-manipulation"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleDocNumericKey("CLEAR")}
                      className="h-16 text-base font-bold rounded-xl bg-secondary/60 hover:bg-muted active:bg-red-500/20 active:text-red-600 transition-colors touch-manipulation"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDocNumericKey("0")}
                      className="h-16 text-lg font-bold rounded-xl bg-secondary hover:bg-muted active:bg-indigo-500 active:text-white transition-colors touch-manipulation"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDocNumericKey("DEL")}
                      className="h-16 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition-colors touch-manipulation"
                    >
                      <Delete className="w-6 h-6" />
                    </button>
                  </div>
                ) : activeDocField === "docName" ? (
                  <div className="bg-background/60 p-4 rounded-2xl border border-border/80 flex flex-col gap-2">
                    {["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"].map((row) => (
                      <div key={row} className="flex gap-2 justify-center">
                        {row.split("").map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleDocTextKey(key)}
                            className="h-14 flex-1 max-w-[44px] text-lg font-bold rounded-xl bg-secondary hover:bg-muted active:bg-indigo-500 active:text-white transition-colors touch-manipulation"
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    ))}
                    <div className="flex gap-2 justify-center mt-1">
                      <button
                        type="button"
                        onClick={() => handleDocTextKey("SPACE")}
                        className="h-14 flex-1 text-base font-bold rounded-xl bg-secondary hover:bg-muted active:bg-indigo-500 active:text-white transition-colors touch-manipulation uppercase"
                      >
                        Espacio
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDocTextKey("DEL")}
                        className="h-14 px-6 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition-colors touch-manipulation"
                      >
                        <Delete className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 bg-background/60 p-4 rounded-2xl border border-border/80">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleNumpadKey(num)}
                        className="h-16 text-lg font-bold rounded-xl bg-secondary hover:bg-muted active:bg-orange-500 active:text-white transition-colors touch-manipulation"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleNumpadKey(".")}
                      className="h-16 text-lg font-bold rounded-xl bg-secondary hover:bg-muted active:bg-orange-500 active:text-white transition-colors touch-manipulation"
                    >
                      .
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadKey("0")}
                      className="h-16 text-lg font-bold rounded-xl bg-secondary hover:bg-muted active:bg-orange-500 active:text-white transition-colors touch-manipulation"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadKey("DEL")}
                      className="h-16 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition-colors touch-manipulation"
                    >
                      <Delete className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer fijo — acciones */}
          <div className="shrink-0 border-t border-border px-8 py-5 bg-card flex gap-4">
            <button
              onClick={closeModal}
              className="h-14 flex-1 rounded-xl border-2 border-border text-muted-foreground hover:bg-secondary font-bold text-lg transition-colors flex items-center justify-center gap-2 touch-manipulation"
            >
              <XCircle className="w-5 h-5" /> VOLVER
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={!canConfirm || isProcessing}
              className={`h-14 flex-[2] rounded-xl font-black text-lg uppercase tracking-wide transition-all flex items-center justify-center gap-2 touch-manipulation ${
                !canConfirm || isProcessing
                  ? "bg-secondary text-muted-foreground cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/30"
              }`}
            >
              {isProcessing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Procesando...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Confirmar Cobro</>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
