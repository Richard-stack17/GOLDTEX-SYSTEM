"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button, Card, CardContent, Dialog, DialogContent,
  DialogHeader, DialogTitle, Input, Separator,
} from "@goltex/ui";
export type Product = {
  id: string;
  familyId: string;
  name: string;
  sku?: string;
  price: number;
  stock?: number;
  code: string;
  is_service?: boolean;
};

export type Family = {
  id: string;
  name: string;
  code: string;
  color?: string;
};
import {
  Search, ArrowLeft, Trash2, Printer,
  Delete, ShoppingCart, XCircle, RefreshCw,
  Clock, CheckCircle2, Sun, Moon, Scissors, Car, Eye
} from "lucide-react";
import { db, type LocalService } from "../lib/localDb";
import { supabase } from "../lib/supabase";
import { requestBluetoothDevice, printSaleReceipt, silentPrintSaleReceipt } from "../configuracion/utils/printerEngine";
import ReceiptPreview from "../components/ReceiptPreview";
import {
  computeNextDailyTicketNumber,
  formatTicketHash,
  parseInternalTicketNum,
  starsoftDocNumFromTicket,
} from "../lib/ticket-sequence";
import { useRole } from "../context/RoleContext";
import { useTheme } from "../context/ThemeContext";
import { hasModuleAccess } from "../lib/permissions";

type CartItem = Product & { quantity: number; editedPrice: number; is_service?: boolean };
// Tipo para items de servicio (no son telas, no extienden Product completo)
type ServiceCartItem = {
  id: string; code: string; name: string; price: number;
  editedPrice: number; quantity: number; familyId: string;
  stock?: number; description?: string; category?: string; color?: string;
  is_service?: boolean;
};
type SaleStatus = "PENDING" | "COMPLETED" | "CANCELLED";
type VoucherType = "TICKET" | "BOLETA" | "FACTURA";

type HistoryTicket = {
  id: string;
  document_number: string;
  internal_ticket_number: number | null;
  total: number;
  detail: string;
  status: SaleStatus;
  created_at: string;
  voucher_type?: VoucherType | null;
  voucher_doc_number?: string | null;
  source_sheet?: string | null;
  transactions?: { payment_method: string; amount: number; surcharge_amount?: number }[];
};

export default function POSPage() {
  const { role, username, isHydrated } = useRole();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [showConfigAlert, setShowConfigAlert] = useState(false);
  const [previewTicketData, setPreviewTicketData] = useState<any>(null);
  const [hasPosAccess, setHasPosAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!isHydrated) return;
      const ok = await hasModuleAccess(role, "pos");
      if (!ok) {
        router.replace("/hub");
      } else {
        setHasPosAccess(true);
      }
    };
    checkAccess();
  }, [role, isHydrated, router]);

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
              console.log('No silent BT access in POS', e);
            }
          }
        }
      }
    }
    loadPrinter();
  }, []);


  // ── Cart ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ticketNumber, setTicketNumber] = useState<number>(1);
  const [isEmitting, setIsEmitting] = useState(false);
  const [lastSaleInfo, setLastSaleInfo] = useState<{
    ticketNum: number | null; docNum: string; items: any[]; total: number; izipayFee?: number;
  } | null>(null);

  // ── Caja Actions ──
  const [closingCajaLoading, setClosingCajaLoading] = useState(false);
  const [cajaSummaryOpen, setCajaSummaryOpen] = useState(false);
  const [cajaSummary, setCajaSummary] = useState<{ efectivo: number; bcp: number; bbva: number; izipay: number; total: number } | null>(null);

  const handleCloseCajaAttempt = async () => {
    setClosingCajaLoading(true);
    setCajaSummaryOpen(true);
    
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" });
      const todayStr = formatter.format(now);
      
      const { data, error } = await supabase
        .from('sales')
        .select('transactions(payment_method, amount)')
        .eq('record_date', todayStr)
        .eq('status', 'COMPLETED');
        
      if (error) throw error;
      
      let efe = 0, bcp = 0, bbva = 0, izi = 0;
      data?.forEach(sale => {
        sale.transactions?.forEach((tx: any) => {
          if (tx.payment_method === 'EFECTIVO') efe += tx.amount;
          else if (tx.payment_method === 'BCP') bcp += tx.amount;
          else if (tx.payment_method === 'BBVA') bbva += tx.amount;
          else if (tx.payment_method === 'IZIPAY') izi += tx.amount;
        });
      });
      
      setCajaSummary({ efectivo: efe, bcp: bcp, bbva: bbva, izipay: izi, total: efe + bcp + bbva + izi });
    } catch (e: any) {
      alert("Error al obtener resumen: " + e.message);
      setCajaSummaryOpen(false);
    } finally {
      setClosingCajaLoading(false);
    }
  };

  const confirmCloseCaja = () => {
    setIsCajaOpen(false);
    localStorage.setItem("isCajaOpen", "false");
    setCajaSummaryOpen(false);
  };

  // ── Vendedor History ──
  const [rightPanelMode, setRightPanelMode] = useState<"cart" | "history">("cart");
  const [historyTickets, setHistoryTickets] = useState<HistoryTicket[]>([]);

  // ── Numpad (productos de tela) ──
  const [numpadProduct, setNumpadProduct] = useState<Product | null>(null);
  const [numpadField, setNumpadField] = useState<"qty" | "price">("qty");
  const [numpadQty, setNumpadQty] = useState<string>("");
  const [numpadPrice, setNumpadPrice] = useState<string>("");

  // (Modales de Servicios eliminados en favor del flujo unificado Numpad)

  // ── Catalog ──
  const [search, setSearch] = useState("");
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [qwertyOpen, setQwertyOpen] = useState(false);
  const [familyPage, setFamilyPage] = useState(1);
  const familyPageSize = 12;
  const [searchPage, setSearchPage] = useState(1);
  const searchPageSize = 12;
  const [exitGuardOpen, setExitGuardOpen] = useState(false);

  // ── Helpers ──
  const getLimaTodayStr = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" });
    return formatter.format(now);
  };

  const starsoftDocNum = (ticket: HistoryTicket) => starsoftDocNumFromTicket(ticket);

  const handleBackClick = () => {
    if (viewMode === 'SERVICES') {
      setViewMode('FAMILIES');
      return;
    }
    
    if (activeFamily !== null) {
      setActiveFamily(null);
      setSearch("");
      setQwertyOpen(false);
      return;
    }
    
    if (cart.length === 0) {
      router.push("/hub");
    } else {
      setExitGuardOpen(true);
    }
  };

  const [isCajaOpen, setIsCajaOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("isCajaOpen");
      return saved !== "false";
    }
    return true;
  });

  const localServices = useLiveQuery(() => db.services.toArray(), []) || [];
  const localFamilies = useLiveQuery(() => db.families.toArray(), []) || [];
  const localProductsRaw = useLiveQuery(() => db.products.toArray(), []) || [];

  const sortByNumericPrefix = (a: any, b: any) => {
    const valA = `${a.code || ""} ${a.name || ""}`.trim();
    const valB = `${b.code || ""} ${b.name || ""}`.trim();
    return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
  };

  const families: Family[] = localFamilies.map(f => ({
    id: f.id,
    name: f.name,
    code: f.code || "",
    color: "" // Default or extract if needed
  })).sort(sortByNumericPrefix);

  const products: Product[] = localProductsRaw.map(p => ({
    id: p.id,
    familyId: p.family_id,
    name: p.name,
    sku: p.sku,
    price: p.price,
    stock: p.stock,
    code: p.code || p.sku || "",
  })).sort(sortByNumericPrefix);

  const quickAccessServices = localServices.filter(s => s.is_quick_access).sort((a, b) => a.name.localeCompare(b.name));
  const otherServices = localServices.filter(s => !s.is_quick_access).sort((a, b) => a.name.localeCompare(b.name));
  
  const [viewMode, setViewMode] = useState<'FAMILIES' | 'SERVICES'>('FAMILIES');

  // ── Handlers de Servicios (Obsoletos, se usa Numpad) ──
  // Ya no usamos modales separados para servicios


  const handleExitWithoutSaving = () => {
    setCart([]);
    setExitGuardOpen(false);
    router.push("/hub");
  };

  // ── Fetch logic ──
  const fetchTodayTicketNumber = useCallback(async () => {
    const todayStr = getLimaTodayStr();

    const { data } = await supabase
      .from("sales")
      .select("internal_ticket_number")
      .eq("record_date", todayStr)
      .eq("source_type", "POS");

    setTicketNumber(computeNextDailyTicketNumber(data ?? []));
  }, []);

  const fetchHistory = useCallback(async () => {
    const todayStr = getLimaTodayStr();
    const { data } = await supabase
      .from("sales")
      .select("*, transactions(payment_method, amount, surcharge_amount)")
      .eq("record_date", todayStr)
      .eq("source_type", "POS")
      .order("created_at", { ascending: false });
    if (data) setHistoryTickets(data as HistoryTicket[]);
  }, []);

  useEffect(() => { fetchTodayTicketNumber(); }, [fetchTodayTicketNumber]);
  useEffect(() => { if (rightPanelMode === "history") fetchHistory(); }, [rightPanelMode, fetchHistory]);

  // ── Catalog logic ──
  const handleQwertyKey = (key: string) => {
    setSearchPage(1);
    if (key === "DEL") {
      const next = search.slice(0, -1);
      setSearch(next);
      if (!next) setActiveFamily(null);
    } else if (key === "SPACE") {
      setSearch((p) => p + " ");
    } else {
      setSearch((p) => p + key);
    }
  };

  const matchedFamilies = search
    ? families.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()) || f.code.includes(search))
    : [];
  const matchedProducts = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.includes(search))
    : activeFamily
      ? products.filter((p) => p.familyId === activeFamily.id)
      : [];

  const combinedSearchResults = search
    ? [
      ...matchedFamilies.map((f) => ({ type: "family" as const, data: f })),
      ...matchedProducts.map((p) => ({ type: "product" as const, data: p })),
    ]
    : [];
  const totalSearchPages = Math.ceil(combinedSearchResults.length / searchPageSize);
  const paginatedSearchResults = search
    ? combinedSearchResults.slice((searchPage - 1) * searchPageSize, searchPage * searchPageSize)
    : [];
  const searchFamiliesInPage = paginatedSearchResults.filter((i) => i.type === "family").map((i) => i.data as Family);
  const searchProductsInPage = paginatedSearchResults.filter((i) => i.type === "product").map((i) => i.data as Product);

  // ── Numpad logic ──
  const openNumpad = (product: Product, existing?: CartItem) => {
    setNumpadProduct(product);
    if (product.is_service) {
      setNumpadField("price");
      setNumpadQty("1"); // Services don't need quantity modification usually, or they use 1
      setNumpadPrice(existing?.editedPrice.toString() ?? "");
    } else {
      setNumpadField("qty");
      setNumpadQty(existing?.quantity.toString() ?? "");
      setNumpadPrice(existing?.editedPrice.toString() ?? product.price.toString());
    }
  };

  const handleNumpadKey = (key: string) => {
    if (numpadField === "qty") {
      if (key === "DEL") setNumpadQty((p) => p.slice(0, -1));
      else if (key === ".") return;
      else if (numpadQty === "" && key === "0") return;
      else if (numpadQty.length < 4) setNumpadQty((p) => p + key);
    } else {
      if (key === "DEL") setNumpadPrice((p) => p.slice(0, -1));
      else if (key === "." && numpadPrice.includes(".")) return;
      else if (numpadPrice.length < 7) setNumpadPrice((p) => p + key);
    }
  };

  const handleNumpadOk = () => {
    if (!numpadProduct) return;
    const qty = numpadProduct.is_service ? 1 : parseInt(numpadQty, 10);
    const price = parseFloat(numpadPrice);
    if (!isNaN(qty) && qty > 0 && !isNaN(price) && price >= 0) {
      setCart((prev) => {
        const exists = prev.find((i) => i.id === numpadProduct.id);
        if (exists) return prev.map((i) => i.id === numpadProduct.id ? { ...i, quantity: qty, editedPrice: price } : i);
        return [...prev, { ...numpadProduct, quantity: qty, editedPrice: price }];
      });
    }
    setNumpadProduct(null);
  };

  const removeFromCart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const deleteDraftTicket = () => {
    if (window.confirm("¿Eliminar este borrador? No quedará ningún registro.")) {
      setCart([]);
    }
  };

  const total = cart.reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);
  const totalServices = cart.filter(i => i.is_service).reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);
  const previewQty = numpadProduct?.is_service ? 1 : (parseInt(numpadQty, 10) || 0);
  const previewPrice = parseFloat(numpadPrice) || 0;
  const previewSubtotal = previewQty * previewPrice;

  // ── Emit Ticket (PENDING — mostrador, no cobro) ──
  const handleEmitTicket = async () => {
    if (!isCajaOpen) {
      alert("Caja Cerrada. Debe realizar la apertura de caja para emitir tickets.");
      return;
    }
    if (cart.length === 0) return;
    setIsEmitting(true);
    try {
      let customerId = "00000000-0000-0000-0000-000000000000";
      const { data: customerData } = await supabase
        .from("customers").select("id").eq("business_name", "CLIENTE VARIOS").limit(1);
      if (customerData && customerData.length > 0) {
        customerId = customerData[0]!.id;
      } else {
        const { data: newCustomer } = await supabase
          .from("customers")
          .insert({ business_name: "CLIENTE VARIOS", ruc: "00000000000", document_type: "SIN_DOC", is_frequent: false })
          .select("id").single();
        if (newCustomer) customerId = newCustomer.id;
      }

      const todayStr = getLimaTodayStr();

      const { data: todayTickets } = await supabase
        .from("sales")
        .select("internal_ticket_number")
        .eq("record_date", todayStr)
        .eq("source_type", "POS");

      const nextInternalNum = computeNextDailyTicketNumber(todayTickets ?? []);
      const docNum = `TKT-${todayStr.replace(/-/g, "")}-${String(nextInternalNum).padStart(4, "0")}`;

      /**
       * Formatea el detalle de cada ítem según su tipo:
       * - Telas: "CODE NOMBRE — Xm × S/ Y.YY"
       * - Confección/Taxi (servicios sin MTS): "CODE: NOMBRE — S/ Y.YY"
       */
      const formatItemDetail = (i: CartItem): string => {
        if (i.is_service) {
          return `${i.code}: ${i.name} — S/ ${i.editedPrice.toFixed(2)}`;
        }
        return `${i.code} ${i.name} — ${i.quantity}m × S/ ${i.editedPrice.toFixed(2)}`;
      };

      const { error: saleError } = await supabase.from("sales").insert({
        customer_id: customerId,
        document_number: docNum,
        internal_ticket_number: nextInternalNum,
        document_type: "TICKET",
        issue_date: todayStr,
        record_date: todayStr,
        detail: cart.map(formatItemDetail).join('\n'),
        items: cart,
        total: total,
        source_sheet: `VENDEDOR:${username || "Propietario"}`,
        source_type: "POS",
        is_fractional: false,
        status: "PENDING",
      });
      if (saleError) throw saleError;

      // Snapshot para impresión
      setLastSaleInfo({ ticketNum: nextInternalNum, docNum, items: [...cart], total });

      // Limpiar y preparar siguiente cliente
      setCart([]);
      await fetchTodayTicketNumber();

      // Imprimir silenciosamente
      try {
        const saleDataForPrint = {
          document_number: docNum,
          customer_name: username || "Propietario",
          items: cart,
          total: total
        };
        console.log('Iniciando auto-impresión POS (Doble Copia)...');
        await silentPrintSaleReceipt(saleDataForPrint, true);
      } catch (e: any) {
        console.error('Error impresión POS:', e);
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al emitir el ticket.");
    } finally {
      setIsEmitting(false);
    }
  };

  const handleReprint = async (ticket: HistoryTicket) => {
    // Tela format:    "CODE NAME — Xm × S/ Y.YY"
    // Service format: "CODE: NAME — S/ Y.YY"
    const lines = ticket.detail.split('\n');
    const reconstructedItems: any[] = lines.map((l: string, idx: number) => {
      let code = "";
      let name = l;
      let quantity = 1;
      let editedPrice = 0;
      let basePrice = 0;

      try {
        const sepIdx = l.indexOf(' — ');
        if (sepIdx !== -1) {
          const firstPart = l.substring(0, sepIdx);
          const secondPart = l.substring(sepIdx + 3);

          if (firstPart.includes(': ')) {
            // Service item: "CODE: NAME — S/ Y.YY"
            const colonIdx = firstPart.indexOf(': ');
            code = firstPart.substring(0, colonIdx);
            name = firstPart.substring(colonIdx + 2);
            const priceMatch = secondPart.match(/S\/\s*([\d.]+)/);
            editedPrice = priceMatch ? (parseFloat(priceMatch[1] ?? '0') || 0) : 0;
            quantity = 1;
          } else {
            // Tela item: "CODE NAME — Xm × S/ Y.YY"
            const spaceIdx = firstPart.indexOf(' ');
            code = spaceIdx > -1 ? firstPart.substring(0, spaceIdx) : '';
            name = spaceIdx > -1 ? firstPart.substring(spaceIdx + 1) : firstPart;
            const matchedProd = products.find(p => p.code === code);
            if (matchedProd) basePrice = matchedProd.price;
            const mxIdx = secondPart.indexOf('m × S/ ');
            if (mxIdx !== -1) {
              quantity = parseFloat(secondPart.substring(0, mxIdx)) || 0;
              editedPrice = parseFloat(secondPart.substring(mxIdx + 7)) || 0;
            }
          }
        }
      } catch (e) {
        console.error("Error parsing detail line", e);
      }

      return { id: String(idx), code, name, price: basePrice, editedPrice, quantity, familyId: "" };
    });

    const txs = ticket.transactions ?? [];
    const izipayTx = txs.find((t) => t.payment_method === "IZIPAY");
    const izipayFeeAmt = izipayTx ? (izipayTx.surcharge_amount ?? 0) : 0;

    setLastSaleInfo({
      ticketNum: parseInternalTicketNum(ticket),
      docNum: ticket.document_number,
      items: reconstructedItems,
      total: ticket.total,
      izipayFee: izipayFeeAmt
    });

    try {
      const saleDataForPrint = {
        document_number: ticket.document_number,
        customer_name: "Cliente General",
        items: reconstructedItems,
        total: ticket.total
      };
      console.log('Iniciando reimpresión POS (Simple)...');
      await silentPrintSaleReceipt(saleDataForPrint, false);
    } catch (e: any) {
      console.error('Error reimpresión POS:', e);
    }
  };


  if (!isHydrated || !hasPosAccess) return null;

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] bg-background text-foreground overflow-hidden">

      {/* ════════════════════════════════════════
          LEFT PANEL — Catálogo de Telas
          ════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col h-full border-r border-border overflow-hidden bg-secondary/10">

        {/* Search Bar */}
        <div className="p-6 border-b border-border bg-surface z-10 flex flex-col gap-4 shadow-sm relative">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full hover:bg-secondary/50" onClick={handleBackClick}>
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <div className="relative flex-1 flex items-center">
                <Search className="absolute left-4 w-6 h-6 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar familia, código o tela..."
                  className="pl-14 h-16 bg-background text-xl rounded-2xl border-2 border-border/50 focus-visible:border-primary shadow-sm cursor-pointer"
                  value={search}
                  onClick={() => setQwertyOpen(true)}
                  readOnly
                />
              </div>
            </div>

            {/* Theme toggle + ticket badge */}
            <div className="flex items-center gap-3">
              {role === 'ADMIN' && (
                <>
                  <button
                    onClick={() => {
                      setIsCajaOpen(true);
                      localStorage.setItem("isCajaOpen", "true");
                    }}
                    className={`px-4 h-12 rounded-2xl text-xs font-black uppercase transition-all ${
                      isCajaOpen 
                        ? "bg-emerald-600/10 text-emerald-600 border border-emerald-500/30" 
                        : "bg-secondary text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500 border border-border"
                    }`}
                  >
                    Apertura de Caja
                  </button>
                  <button
                    onClick={handleCloseCajaAttempt}
                    className={`px-4 h-12 rounded-2xl text-xs font-black uppercase transition-all ${
                      !isCajaOpen 
                        ? "bg-red-600/10 text-red-600 border border-red-500/30" 
                        : "bg-secondary text-muted-foreground hover:bg-red-500/10 hover:text-red-500 border border-border"
                    }`}
                  >
                    Cerrar Caja
                  </button>
                </>
              )}
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-secondary hover:bg-muted transition-colors border border-border"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
              </button>
              <div className="bg-emerald-500/10 border-2 border-emerald-500/30 px-5 py-2 rounded-2xl flex flex-col items-center shrink-0">
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Próximo #</span>
                <span className="text-3xl font-black text-emerald-600 leading-none">{ticketNumber}</span>
              </div>
            </div>
          </div>

          {/* QWERTY */}
          {qwertyOpen && (
            <div className="absolute top-[100px] left-6 right-6 bg-card border-2 border-border/80 rounded-3xl p-5 shadow-2xl z-50 flex flex-col gap-2 animate-in fade-in duration-200">
              <button onClick={() => setQwertyOpen(false)} className="absolute right-4 top-4 text-red-500 hover:bg-red-500/10 w-10 h-10 flex items-center justify-center rounded-full font-black cursor-pointer">✕</button>
              {[["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"], ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"]].map((row, ri) => (
                <div key={ri} className="flex gap-1.5 justify-center">
                  {row.map((key) => (
                    <button key={key} onClick={() => handleQwertyKey(key)}
                      className="h-12 flex-1 max-w-[50px] bg-secondary/80 hover:bg-primary hover:text-white rounded-xl font-bold text-lg active:scale-95 transition-all touch-manipulation cursor-pointer">
                      {key}
                    </button>
                  ))}
                </div>
              ))}
              <div className="flex gap-1.5 justify-center">
                {["Z", "X", "C", "V", "B", "N", "M"].map((key) => (
                  <button key={key} onClick={() => handleQwertyKey(key)}
                    className="h-12 flex-1 max-w-[50px] bg-secondary/80 hover:bg-primary hover:text-white rounded-xl font-bold text-lg active:scale-95 transition-all touch-manipulation cursor-pointer">
                    {key}
                  </button>
                ))}
                <button onClick={() => handleQwertyKey("DEL")} className="h-12 px-5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer">
                  <Delete className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-2 justify-center mt-1">
                <button onClick={() => { setSearch(""); setActiveFamily(null); }} className="h-12 px-5 bg-secondary/40 text-muted-foreground hover:bg-secondary rounded-xl font-bold active:scale-95 transition-all cursor-pointer">Limpiar</button>
                <button onClick={() => handleQwertyKey("SPACE")} className="h-12 flex-1 max-w-[300px] bg-secondary/80 hover:bg-primary hover:text-white rounded-xl font-bold active:scale-95 transition-all uppercase cursor-pointer">Espacio</button>
                <button onClick={() => setQwertyOpen(false)} className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black active:scale-95 transition-all uppercase cursor-pointer">OK</button>
              </div>
            </div>
          )}
        </div>

        {/* Catalog Grid */}
        <div className={`flex-1 overflow-auto bg-secondary/10 flex ${numpadProduct ? "flex-col lg:grid lg:grid-cols-2" : "flex-col"}`}>
          <div className={`flex flex-col h-full overflow-auto ${numpadProduct ? "hidden lg:flex border-r border-border" : ""}`}>
          <div className="px-6 pt-6 flex justify-between items-center shrink-0">
            {viewMode === 'FAMILIES' && !activeFamily && !search ? (
              <div className="flex gap-1 bg-background border-2 border-border/60 rounded-xl p-1 shadow-sm">
                <Button variant="ghost" className="h-10 px-4 rounded-lg text-xs font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-colors" disabled={familyPage === 1} onClick={() => setFamilyPage(p => p - 1)}>Anterior</Button>
                <div className="flex items-center px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Pág {familyPage} de {Math.max(1, Math.ceil(families.length / familyPageSize))}
                </div>
                <Button variant="ghost" className="h-10 px-4 rounded-lg text-xs font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-colors" disabled={familyPage === Math.max(1, Math.ceil(families.length / familyPageSize))} onClick={() => setFamilyPage(p => p + 1)}>Siguiente</Button>
              </div>
            ) : <div />}
            {viewMode !== 'SERVICES' && (
              <Button 
                onClick={() => setViewMode('SERVICES')}
                className="rounded-xl px-6 h-12 text-sm font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                ✨ Servicios
              </Button>
            )}
          </div>
          {viewMode === 'SERVICES' ? (
            <div className="p-6">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Todos los Servicios</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {localServices.map((svc) => (
                  <button key={svc.id} onClick={() => {
                      const productObj: Product = {id: svc.id, familyId: 'SERVICE', name: svc.name, code: 'SVC', price: 0, is_service: true};
                      const existing = cart.find(i => i.id === svc.id);
                      openNumpad(productObj, existing);
                    }}
                    className="flex flex-col items-center justify-center p-6 bg-purple-50 border-2 border-purple-200 hover:bg-purple-100 transition-all active:scale-[0.96] rounded-2xl shadow-sm text-center gap-3 cursor-pointer text-purple-700">
                    <div className="text-xl font-black uppercase tracking-tight">{svc.name}</div>
                  </button>
                ))}
                {localServices.length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground text-lg">No hay servicios registrados.</div>
                )}
              </div>
            </div>
          ) : !activeFamily && !search ? (
            <div className="p-6 flex flex-col h-full">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Familias de Tela</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 flex-1 content-start">
                {families.slice((familyPage - 1) * familyPageSize, familyPage * familyPageSize).map((fam) => (
                  <button key={fam.id} onClick={() => setActiveFamily(fam)}
                    className="text-left p-3 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 flex flex-col items-start gap-1">
                    <div className="text-2xl font-black mb-1 opacity-80">{fam.code}</div>
                    <div className="text-base font-semibold tracking-tight">{fam.name}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-8">
              {search ? (
                <>
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                      Resultados ({combinedSearchResults.length}) — Pág. {searchPage}/{totalSearchPages || 1}
                    </h2>
                  </div>
                  {searchFamiliesInPage.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Familias</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchFamiliesInPage.map((fam) => (
                          <button key={fam.id}
                            onClick={() => { setActiveFamily(fam); setSearch(""); setQwertyOpen(false); }}
                            className={`text-left p-3 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer bg-glass shadow-sm ${fam.color || "border-border hover:border-primary"}`}>
                            <div className="text-2xl font-black mb-1 opacity-80">{fam.code}</div>
                            <div className="text-base font-semibold tracking-tight">{fam.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {searchProductsInPage.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Telas</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {searchProductsInPage.map((product) => (
                          <button key={product.id} onClick={() => openNumpad(product)}
                            className="flex flex-col items-center justify-center p-3 bg-glass border-2 border-border hover:border-primary/50 transition-all active:scale-[0.96] rounded-2xl shadow-sm text-center gap-2 cursor-pointer">
                            <div className="text-sm font-black uppercase tracking-tight"><span className="font-mono text-primary mr-1.5">{product.code}</span>{product.name}</div>
                            <div className="text-lg font-black text-primary">S/ {product.price.toFixed(2)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {combinedSearchResults.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground text-lg">Sin resultados para "{search}".</div>
                  )}
                  {totalSearchPages > 1 && (
                    <div className="flex justify-center gap-3 border-t border-border/55 pt-6">
                      {Array.from({ length: totalSearchPages }).map((_, i) => (
                        <Button key={i + 1} variant={searchPage === i + 1 ? "default" : "outline"}
                          className="h-14 px-8 text-lg rounded-2xl font-bold" onClick={() => setSearchPage(i + 1)}>
                          {i * searchPageSize + 1}–{Math.min((i + 1) * searchPageSize, combinedSearchResults.length)}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Familia {activeFamily?.code} — {activeFamily?.name}
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {matchedProducts.map((product) => (
                      <button key={product.id} onClick={() => openNumpad(product)}
                        className="flex flex-col items-center justify-center p-3 bg-glass border-2 border-border hover:border-primary/50 transition-all active:scale-[0.96] rounded-2xl shadow-sm text-center gap-2 cursor-pointer">
                        <div className="text-sm font-black uppercase tracking-tight"><span className="font-mono text-primary mr-1.5">{product.code}</span>{product.name}</div>
                        <div className="text-lg font-black text-primary">S/ {product.price.toFixed(2)}</div>
                      </button>
                    ))}
                    {matchedProducts.length === 0 && (
                      <div className="col-span-full py-12 text-center text-muted-foreground text-lg">Sin telas en esta categoría.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {numpadProduct && (
        <div className="flex flex-col justify-center items-center p-4 bg-background h-full overflow-auto">
          <div className="w-full max-w-[540px] bg-card rounded-3xl border-2 border-border/50 flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-border bg-surface text-center shrink-0">
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-base font-black text-muted-foreground bg-secondary px-3 py-1 rounded-lg">{numpadProduct.code}</span>
                <h3 className="text-lg font-black uppercase text-primary">{numpadProduct.name}</h3>
              </div>
            </div>

            {/* Campos Precio Fijo / Variable y Cantidad */}
            <div className="px-4 pt-3 pb-2 bg-secondary/10 border-b border-border flex flex-col gap-2">
              {!numpadProduct.is_service && (
                <div className="flex gap-3">
                  <div className="flex-1 bg-background rounded-xl border-2 border-border p-2.5 text-center opacity-60">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Precio Fijo</div>
                    <div className="text-xl font-bold">S/ {numpadProduct.price.toFixed(2)}</div>
                  </div>
                  <div className={`flex-1 rounded-xl border-2 p-2.5 text-center cursor-pointer transition-all ${numpadField === "price" ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                    onClick={() => setNumpadField("price")}>
                    <div className={`text-[10px] font-bold uppercase mb-0.5 ${numpadField === "price" ? "text-primary" : "text-muted-foreground"}`}>Precio Variable</div>
                    <div className={`text-xl font-bold ${numpadField === "price" ? "text-primary" : "text-foreground"}`}>S/ {numpadPrice || "0.00"}</div>
                  </div>
                </div>
              )}
              {numpadProduct.is_service && (
                <div className="flex gap-3">
                  <div className={`flex-1 rounded-xl border-2 p-2.5 text-center cursor-pointer transition-all border-purple-500 bg-purple-500/10`}
                    onClick={() => setNumpadField("price")}>
                    <div className={`text-[10px] font-bold uppercase mb-0.5 text-purple-600`}>Precio del Servicio</div>
                    <div className={`text-xl font-bold text-foreground`}>S/ {numpadPrice || "0.00"}</div>
                  </div>
                </div>
              )}
              {!numpadProduct.is_service && (
                <div className={`w-full rounded-xl border-2 p-2.5 text-center cursor-pointer transition-all flex items-center justify-center gap-3 ${numpadField === "qty" ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-background"}`}
                  onClick={() => setNumpadField("qty")}>
                  <div className={`text-xs font-bold uppercase ${numpadField === "qty" ? "text-emerald-600" : "text-muted-foreground"}`}>Cantidad:</div>
                  <div className={`text-4xl font-black font-mono tracking-tighter ${numpadField === "qty" ? "text-emerald-500" : "text-foreground"}`}>{numpadQty || "0"}</div>
                  <div className={`text-base font-bold uppercase ${numpadField === "qty" ? "text-emerald-600" : "text-muted-foreground"}`}>
                    mts
                  </div>
                </div>
              )}
            </div>

            {/* Teclado numérico — botones más pequeños para tablet */}
            <div className="px-4 pt-3 pb-2 grid grid-cols-3 gap-1.5 bg-card">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button key={num} onClick={() => handleNumpadKey(num)}
                  className="h-10 text-2xl font-black rounded-xl bg-secondary/50 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation">
                  {num}
                </button>
              ))}
              <button onClick={() => numpadField === "price" && handleNumpadKey(".")}
                className={`h-10 text-2xl font-black rounded-xl border-2 border-transparent transition-colors touch-manipulation ${numpadField === "price" ? "bg-secondary/50 hover:border-primary active:bg-primary active:text-white" : "bg-secondary/20 text-muted-foreground/30 cursor-not-allowed"}`}>
                .
              </button>
              <button onClick={() => handleNumpadKey("0")} className="h-10 text-2xl font-black rounded-xl bg-secondary/50 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation">0</button>
              <button onClick={() => handleNumpadKey("DEL")} className="h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border-2 border-transparent active:bg-red-500 active:text-white transition-colors touch-manipulation">
                <Delete className="w-6 h-6" />
              </button>
            </div>

            {/* Preview subtotal y botones de acción */}
            <div className="px-4 pb-4 pt-2 flex flex-col gap-2.5">
              <div className="bg-background border-2 border-border rounded-xl p-3 flex items-center justify-between gap-4">
                <div className="text-sm font-mono font-bold text-muted-foreground">
                  {numpadProduct.is_service ? `S/ ${previewPrice.toFixed(2)}` : `${previewQty} MTS × S/ ${previewPrice.toFixed(2)}`}
                </div>
                <div className="text-2xl font-black text-emerald-500 font-mono">S/ {previewSubtotal.toFixed(2)}</div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="h-14 flex-1 text-base font-bold uppercase rounded-2xl border-2" onClick={() => setNumpadProduct(null)}>Cancelar</Button>
                <Button className="h-14 flex-[2] text-xl font-black uppercase rounded-2xl shadow-xl" onClick={handleNumpadOk}
                  disabled={(!numpadProduct.is_service && (!numpadQty || parseInt(numpadQty) <= 0)) || !numpadPrice}>
                  {cart.find((c) => c.id === numpadProduct.id) ? "Actualizar" : "Agregar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>

      {/* ════════════════════════════════════════
          RIGHT PANEL — Proforma + Emitir + Historial
          ════════════════════════════════════════ */}
      <div className="w-full lg:w-[500px] flex flex-col h-[50dvh] lg:h-full bg-surface shadow-xl z-20 shrink-0 border-t lg:border-t-0 lg:border-l border-border">

        <div className="px-5 pt-5 pb-3 border-b border-border bg-card shrink-0 flex flex-col gap-3">
          <div className="flex gap-2 bg-secondary/30 p-1 rounded-xl">
            <button
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${rightPanelMode === 'cart' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setRightPanelMode('cart')}
            >
              Nueva Proforma
            </button>
            <button
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${rightPanelMode === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setRightPanelMode('history')}
            >
              Mis Proformas
            </button>
          </div>
          {rightPanelMode === 'cart' && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Resumen
              </span>
              <span className="text-xs font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">
                {cart.length} {cart.length === 1 ? "ítem" : "ítems"}
              </span>
            </div>
          )}
        </div>

        {rightPanelMode === 'cart' ? (
          <>
            {/* Cart items */}
            <div className="flex-1 overflow-auto p-2 space-y-1 bg-secondary/5">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-40">
                  <ShoppingCart className="w-20 h-20" />
                  <p className="text-xl font-bold">Proforma Vacía</p>
                  <p className="text-sm text-center">Selecciona telas del catálogo para agregar</p>
                </div>
              ) : (
                <>
                  <div className="text-center font-mono text-muted-foreground/40 text-xs tracking-widest select-none">
                    ───────────────────────────────
                  </div>
                  {cart.map((item, idx) => {
                    const isService = item.is_service;
                    const handleCardClick = () => {
                      openNumpad(item, item);
                    };
                    return (
                    <div key={item.id}>
                      <Card className="bg-background border-border shadow-sm rounded-2xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
                        onClick={handleCardClick}>
                        <CardContent className="px-2 py-1.5">
                          <div className="flex items-start justify-between mb-0.5">
                            <div className="text-xs font-bold text-foreground leading-tight flex items-start gap-1.5 flex-1 pr-2">
                              {isService && (
                                <Scissors className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                              )}
                              <span className="font-mono text-primary shrink-0 mt-px">{item.code}</span>
                              <span className="whitespace-normal text-left flex-1">{item.name} {!isService && <span className="text-[10px] text-muted-foreground ml-1 inline-block">(S/ {item.price.toFixed(2)})</span>}</span>
                            </div>
                            <button className="p-1.5 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors shrink-0"
                              onClick={(e) => removeFromCart(item.id, e)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex justify-between items-end">
                            {isService ? (
                              <div className="text-muted-foreground font-mono text-[10px] font-bold">
                                Precio: S/ {item.editedPrice.toFixed(2)}
                              </div>
                            ) : (
                              <div className="text-muted-foreground font-mono text-[10px] font-bold">
                                {item.quantity} MTS × S/ {item.editedPrice.toFixed(2)}
                              </div>
                            )}
                            <div className="text-base font-black text-foreground leading-none">
                              S/ {(item.editedPrice * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      {idx < cart.length - 1 && (
                        <div className="text-center font-mono text-muted-foreground/25 text-[10px] tracking-widest select-none py-0.5">
                          · · · · · · · · · · · · · · · ·
                        </div>
                      )}
                    </div>
                  )})}
                  <div className="text-center font-mono text-muted-foreground/40 text-xs tracking-widest select-none">
                    ───────────────────────────────
                  </div>
                </>
              )}
            </div>

            {/* Footer Cart */}
            <div className="p-3 border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.06)] shrink-0">
              {/* Botones de Servicios de Acceso Rápido */}
              {quickAccessServices.length > 0 && (
                <div className="mb-2 flex gap-2">
                  {quickAccessServices.map((svc, idx) => {
                    const existing = cart.find(i => i.id === svc.id);
                    return (
                      <Button
                        key={svc.id}
                        onClick={() => openNumpad({id: svc.id, familyId: 'SERVICE', name: svc.name, code: 'SVC', price: 0, is_service: true}, existing)}
                        variant="outline"
                        className={`flex-1 h-8 border-dashed border-2 font-bold text-[10px] flex items-center justify-center gap-2 transition-colors uppercase ${
                          existing
                            ? (idx === 1 ? "border-orange-400 text-orange-600 bg-orange-50 hover:bg-orange-100" : "border-purple-400 text-purple-600 bg-purple-50 hover:bg-purple-100")
                            : "hover:bg-primary/5 hover:text-primary"
                        }`}
                      >
                        <Scissors className="w-3 h-3" />
                        {existing ? `EDITAR ${svc.name}` : `+ ${svc.name}`}
                      </Button>
                    );
                  })}
                </div>
              )}
              {cart.length > 0 && (
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between items-center text-muted-foreground text-base font-bold">
                    <span>SUBTOTAL</span>
                    <span>S/ {total.toFixed(2)}</span>
                  </div>
                  <Separator className="opacity-40" />
                  <div className="flex justify-between items-center text-xl font-black font-mono">
                    <span>TOTAL</span>
                    <span className="text-emerald-500">S/ {total.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                {cart.length > 0 && (
                  <Button variant="ghost" className="h-12 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                    onClick={deleteDraftTicket}>
                    <XCircle className="w-5 h-5" />
                  </Button>
                )}
                <button
                  onClick={handleEmitTicket}
                  disabled={cart.length === 0 || isEmitting || !isCajaOpen}
                  className={`flex-1 h-12 rounded-xl text-sm font-black tracking-wide transition-all flex items-center justify-center gap-2 shadow-md ${cart.length === 0 || isEmitting || !isCajaOpen
                      ? "bg-secondary text-muted-foreground cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.01] active:scale-[0.99]"
                    }`}
                >
                  {isEmitting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Emitiendo...</>
                  ) : (
                    <><Printer className="w-4 h-4" /> EMITIR TICKET DE CORTE</>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* History items */
          <div className="flex-1 overflow-auto p-4 space-y-3 bg-secondary/5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase">Proformas de Hoy</span>
              <button onClick={fetchHistory} className="p-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {historyTickets.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2 opacity-60">
                <p className="text-sm">No has emitido proformas hoy.</p>
              </div>
            ) : (
              historyTickets.map((ticket) => {
                const ticketNo = parseInternalTicketNum(ticket);
                const sunatDoc = starsoftDocNum(ticket);
                return (
                  <Card key={ticket.id} className="bg-background border-border shadow-sm rounded-xl overflow-hidden">
                    <CardContent className="p-3 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col min-w-0">
                          <div className="text-base font-black text-foreground">{formatTicketHash(ticketNo)}</div>
                          {sunatDoc && (
                            <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Doc: {sunatDoc}
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${ticket.status === 'PENDING' ? 'bg-orange-500/20 text-orange-600' : ticket.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'}`}>
                          {ticket.status === 'PENDING' ? 'Pendiente' : ticket.status === 'COMPLETED' ? 'Pagado' : 'Anulado'}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs mt-0.5">
                        <span className="text-muted-foreground font-mono">{new Date(ticket.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="font-black text-emerald-500 text-sm">S/ {ticket.total.toFixed(2)}</span>
                      </div>
                      {(role === "ADMIN" || role === "MOSTRADOR") && (() => {
                          if (ticket.status === 'PENDING') {
                            return (
                              <div className="text-[10px] font-medium text-muted-foreground mt-0.5">
                                Aún no se ha cobrado
                              </div>
                            );
                          }
                          if (role === "ADMIN" && ticket.status === 'COMPLETED' && ticket.source_sheet) {
                            const cajeroMatch = (ticket.source_sheet as string).match(/CAJERO:([^|]+)/);
                            const cajeroName = cajeroMatch ? (cajeroMatch[1] ?? '').trim() : null;
                            if (cajeroName) {
                              return (
                                <div className="text-[10px] font-bold text-emerald-600 uppercase mt-0.5">
                                  CAJERO: {cajeroName}
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleReprint(ticket)}
                          className="flex-1 py-1.5 bg-secondary/50 hover:bg-secondary rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" /> REIMPRIMIR
                        </button>
                        <button
                          onClick={() => {
                            const lines = typeof ticket.detail === 'string' ? ticket.detail.split('\n').filter(l => l.trim()) : [];
                            const reconstructedItems = lines.map((l: string, idx: number) => {
                              let code = "";
                              let name = l;
                              let quantity = 1;
                              let editedPrice = 0;
                              let basePrice = 0;

                              try {
                                const sepIdx = l.indexOf(' — ');
                                if (sepIdx !== -1) {
                                  const firstPart = l.substring(0, sepIdx);
                                  const secondPart = l.substring(sepIdx + 3);

                                  if (firstPart.includes(': ')) {
                                    const colonIdx = firstPart.indexOf(': ');
                                    code = firstPart.substring(0, colonIdx);
                                    name = firstPart.substring(colonIdx + 2);
                                    const priceMatch = secondPart.match(/S\/\s*([\d.]+)/);
                                    editedPrice = priceMatch ? (parseFloat(priceMatch[1] ?? '0') || 0) : 0;
                                  } else {
                                    const spaceIdx = firstPart.indexOf(' ');
                                    code = spaceIdx > -1 ? firstPart.substring(0, spaceIdx) : '';
                                    name = spaceIdx > -1 ? firstPart.substring(spaceIdx + 1) : firstPart;
                                    const matchedProd = products.find(p => p.code === code);
                                    if (matchedProd) basePrice = matchedProd.price;
                                    const mxIdx = secondPart.indexOf('m × S/ ');
                                    if (mxIdx !== -1) {
                                      quantity = parseFloat(secondPart.substring(0, mxIdx)) || 0;
                                      editedPrice = parseFloat(secondPart.substring(mxIdx + 7)) || 0;
                                    }
                                  }
                                }
                              } catch (e) {}
                              return { code, name, price: basePrice, editedPrice, quantity };
                            });

                            const saleDataForPrint = {
                              document_number: ticket.document_number,
                              cajero: ticket.source_sheet ? (ticket.source_sheet as string).match(/CAJERO:([^|]+)/)?.[1]?.trim() : 'Caja',
                              customer_name: "Cliente General",
                              items: reconstructedItems,
                              total: ticket.total
                            };
                            setPreviewTicketData(saleDataForPrint);
                          }}
                          className="flex-1 py-2 bg-secondary/20 hover:bg-secondary/40 text-foreground rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-border"
                        >
                          <Eye className="w-4 h-4" /> VISTA PREVIA
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Modales obsoletos eliminados */}

      {/* Exit guard — carrito con ítems sin registrar */}
      <Dialog open={exitGuardOpen} onOpenChange={setExitGuardOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">¿Seguro que deseas salir?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Tienes telas en el carrito que no han sido registradas como proforma. Si sales ahora, se perderán estos datos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1 h-12 font-bold"
              onClick={() => setExitGuardOpen(false)}
            >
              Cancelar y Seguir Aquí
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-12 font-bold"
              onClick={handleExitWithoutSaving}
            >
              Salir sin Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Caja Summary Modal */}
      <Dialog open={cajaSummaryOpen} onOpenChange={setCajaSummaryOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center mb-2">Resumen del Día</DialogTitle>
          </DialogHeader>
          
          {closingCajaLoading || !cajaSummary ? (
            <div className="py-10 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <p className="font-bold">Calculando recaudación total...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-2xl p-4 border border-border space-y-3">
                <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                  <span>EFECTIVO</span>
                  <span className="text-foreground">S/ {cajaSummary.efectivo.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                  <span>IZIPAY</span>
                  <span className="text-foreground">S/ {cajaSummary.izipay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                  <span>BCP (Transferencias/Yape)</span>
                  <span className="text-foreground">S/ {cajaSummary.bcp.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                  <span>BBVA (Plin/Transferencias)</span>
                  <span className="text-foreground">S/ {cajaSummary.bbva.toFixed(2)}</span>
                </div>
                <div className="pt-3 mt-3 border-t border-border flex justify-between items-center text-lg font-black">
                  <span>TOTAL FINAL</span>
                  <span className="text-emerald-500">S/ {cajaSummary.total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setCajaSummaryOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1 h-12 font-bold" onClick={confirmCloseCaja}>
                  Confirmar Cierre Definitivo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════
          MODAL DE VISTA PREVIA DE TICKET
          ════════════════════════════════════════ */}
      <Dialog open={!!previewTicketData} onOpenChange={(open) => !open && setPreviewTicketData(null)}>
        <DialogContent className="max-w-md bg-white text-slate-900 shadow-2xl rounded-xl border border-slate-200 p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <Eye className="w-5 h-5 text-emerald-700" />
              Vista Previa de Impresión
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {previewTicketData && (
              <ReceiptPreview 
                maxChars={activePrinter?.max_chars || 42} 
                saleData={previewTicketData} 
              />
            )}
          </div>
          <div className="pt-2">
            <Button variant="outline" className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg transition-colors border-0" onClick={() => setPreviewTicketData(null)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
