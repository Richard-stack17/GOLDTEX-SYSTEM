"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button, Card, CardContent, Dialog, DialogContent,
  DialogHeader, DialogTitle, Input, Separator,
} from "@goltex/ui";
import { products, families, type Product, type Family } from "@goltex/ui/mock-data";
import {
  Search, ArrowLeft, Trash2, Printer,
  Delete, ShoppingCart, XCircle, RefreshCw,
  Clock, CheckCircle2, Sun, Moon
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  computeNextDailyTicketNumber,
  formatTicketHash,
  parseInternalTicketNum,
  starsoftDocNumFromTicket,
} from "../lib/ticket-sequence";
import { useRole } from "../context/RoleContext";
import { useTheme } from "../context/ThemeContext";

type CartItem = Product & { quantity: number; editedPrice: number };
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
};

export default function POSPage() {
  const { role, isHydrated } = useRole();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // ── Redirect if wrong role ──
  useEffect(() => {
    if (isHydrated && role === 'CAJERA') {
      router.push('/hub');
    }
  }, [isHydrated, role, router]);

  // ── Cart ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ticketNumber, setTicketNumber] = useState<number>(1);
  const [isEmitting, setIsEmitting] = useState(false);
  const [lastSaleInfo, setLastSaleInfo] = useState<{
    ticketNum: number | null; docNum: string; items: CartItem[]; total: number;
  } | null>(null);

  // ── Vendedor History ──
  const [rightPanelMode, setRightPanelMode] = useState<"cart" | "history">("cart");
  const [historyTickets, setHistoryTickets] = useState<HistoryTicket[]>([]);

  // ── Numpad ──
  const [numpadProduct, setNumpadProduct] = useState<Product | null>(null);
  const [numpadField, setNumpadField] = useState<"qty" | "price">("qty");
  const [numpadQty, setNumpadQty] = useState<string>("");
  const [numpadPrice, setNumpadPrice] = useState<string>("");

  // ── Catalog ──
  const [search, setSearch] = useState("");
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [qwertyOpen, setQwertyOpen] = useState(false);
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
      .select("*")
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
    setNumpadField("qty");
    setNumpadQty(existing?.quantity.toString() ?? "");
    setNumpadPrice(existing?.editedPrice.toString() ?? product.price.toString());
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
    const qty = parseInt(numpadQty, 10);
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
  const previewQty = parseInt(numpadQty, 10) || 0;
  const previewPrice = parseFloat(numpadPrice) || 0;
  const previewSubtotal = previewQty * previewPrice;

  // ── Emit Ticket (PENDING — mostrador, no cobro) ──
  const handleEmitTicket = async () => {
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

      const { error: saleError } = await supabase.from("sales").insert({
        customer_id: customerId,
        document_number: docNum,
        internal_ticket_number: nextInternalNum,
        document_type: "TICKET",
        issue_date: todayStr,
        record_date: todayStr,
        detail: cart.map(i => `${i.code} ${i.name} — ${i.quantity}m × S/ ${i.editedPrice.toFixed(2)}`).join('\n'),
        total: total,
        source_sheet: "POS Gamarra",
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

      // Imprimir inmediatamente
      setTimeout(() => window.print(), 120);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al emitir el ticket.");
    } finally {
      setIsEmitting(false);
    }
  };

  const handleReprint = (ticket: HistoryTicket) => {
    // Reconstruct items from detail text
    const lines = ticket.detail.split('\n');
    const reconstructedItems: CartItem[] = lines.map((l: string, idx: number) => {
      let code = "";
      let name = l;
      let quantity = 1;
      let editedPrice = 0;
      let basePrice = 0;

      try {
        const parts = l.split(' — ');
        if (parts.length === 2) {
          const firstSpaceIdx = parts[0].indexOf(' ');
          code = firstSpaceIdx > -1 ? parts[0].substring(0, firstSpaceIdx) : '';
          name = firstSpaceIdx > -1 ? parts[0].substring(firstSpaceIdx + 1) : parts[0];

          // Try to find the base price from the products list
          const matchedProd = products.find(p => p.code === code);
          if (matchedProd) {
            basePrice = matchedProd.price;
          }

          const subParts = parts[1].split('m × S/ ');
          if (subParts.length === 2) {
            quantity = parseFloat(subParts[0]) || 0;
            editedPrice = parseFloat(subParts[1]) || 0;
          }
        }
      } catch (e) {
        console.error("Error parsing detail line", e);
      }

      // Fallback basePrice to editedPrice if not found
      if (basePrice === 0) {
        basePrice = editedPrice;
      }

      return {
        id: String(idx),
        code,
        name,
        price: basePrice,
        editedPrice: editedPrice,
        quantity,
        familyId: ""
      };
    });
    setLastSaleInfo({
      ticketNum: parseInternalTicketNum(ticket),
      docNum: ticket.document_number,
      items: reconstructedItems,
      total: ticket.total
    });
    setTimeout(() => window.print(), 120);
  };

  if (!isHydrated || role === 'CAJERA') return null;

  return (
    <div className="flex h-screen bg-background">

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
        <div className="flex-1 overflow-auto bg-secondary/10 flex flex-col">
          {!activeFamily && !search ? (
            <div className="p-6">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Familias de Tela</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {families.map((fam) => (
                  <button key={fam.id} onClick={() => setActiveFamily(fam)}
                    className={`text-left p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer bg-glass shadow-sm ${fam.color || "border-border hover:border-primary"}`}>
                    <div className="text-4xl font-black mb-2 opacity-80">{fam.code}</div>
                    <div className="text-2xl font-semibold tracking-tight">{fam.name}</div>
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
                            className={`text-left p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer bg-glass shadow-sm ${fam.color || "border-border hover:border-primary"}`}>
                            <div className="text-4xl font-black mb-2 opacity-80">{fam.code}</div>
                            <div className="text-2xl font-semibold tracking-tight">{fam.name}</div>
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
                            className="flex flex-col items-center justify-center p-6 bg-glass border-2 border-border hover:border-primary/50 transition-all active:scale-[0.96] rounded-2xl shadow-sm text-center gap-3 cursor-pointer">
                            <div className="text-xl font-black uppercase tracking-tight"><span className="font-mono text-primary mr-1.5">{product.code}</span>{product.name}</div>
                            <div className="text-2xl font-black text-primary">S/ {product.price.toFixed(2)}</div>
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
                        className="flex flex-col items-center justify-center p-6 bg-glass border-2 border-border hover:border-primary/50 transition-all active:scale-[0.96] rounded-2xl shadow-sm text-center gap-3 cursor-pointer">
                        <div className="text-xl font-black uppercase tracking-tight"><span className="font-mono text-primary mr-1.5">{product.code}</span>{product.name}</div>
                        <div className="text-2xl font-black text-primary">S/ {product.price.toFixed(2)}</div>
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

      {/* ════════════════════════════════════════
          RIGHT PANEL — Proforma + Emitir + Historial
          ════════════════════════════════════════ */}
      <div className="w-[460px] flex flex-col h-full bg-surface shadow-xl z-20 shrink-0 border-l border-border">

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
            <div className="flex-1 overflow-auto p-4 space-y-3 bg-secondary/5">
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
                  {cart.map((item, idx) => (
                    <div key={item.id}>
                      <Card className="bg-background border-border shadow-sm rounded-2xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
                        onClick={() => openNumpad(item, item)}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="text-sm font-bold text-foreground leading-snug">
                              <span className="font-mono text-primary mr-1.5">{item.code}</span>{item.name} <span className="ml-1 text-muted-foreground font-mono">S/. {item.price.toFixed(2)}</span>
                            </div>
                            <button className="ml-3 p-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors shrink-0"
                              onClick={(e) => removeFromCart(item.id, e)}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-muted-foreground font-mono text-sm font-bold">
                            {item.quantity} MTS × S/ {item.editedPrice.toFixed(2)}
                          </div>
                          <div className="text-xl font-black text-foreground mt-1.5 text-right">
                            S/ {(item.editedPrice * item.quantity).toFixed(2)}
                          </div>
                        </CardContent>
                      </Card>
                      {idx < cart.length - 1 && (
                        <div className="text-center font-mono text-muted-foreground/25 text-xs tracking-widest select-none py-1">
                          · · · · · · · · · · · · · · · ·
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="text-center font-mono text-muted-foreground/40 text-xs tracking-widest select-none">
                    ───────────────────────────────
                  </div>
                </>
              )}
            </div>

            {/* Footer Cart */}
            <div className="p-5 border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.06)] shrink-0">
              {cart.length > 0 && (
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center text-muted-foreground text-lg font-bold">
                    <span>SUBTOTAL</span>
                    <span>S/ {total.toFixed(2)}</span>
                  </div>
                  <Separator className="opacity-40" />
                  <div className="flex justify-between items-center text-3xl font-black font-mono">
                    <span>TOTAL</span>
                    <span className="text-emerald-500">S/ {total.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                {cart.length > 0 && (
                  <Button variant="ghost" className="h-16 px-4 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                    onClick={deleteDraftTicket}>
                    <XCircle className="w-5 h-5" />
                  </Button>
                )}
                <button
                  onClick={handleEmitTicket}
                  disabled={cart.length === 0 || isEmitting}
                  className={`flex-1 h-16 rounded-2xl text-lg font-black tracking-wide transition-all flex items-center justify-center gap-3 shadow-lg ${cart.length === 0 || isEmitting
                      ? "bg-secondary text-muted-foreground cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.01] active:scale-[0.99]"
                    }`}
                >
                  {isEmitting ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /> Emitiendo...</>
                  ) : (
                    <><Printer className="w-5 h-5" /> EMITIR TICKET DE CORTE</>
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
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col min-w-0">
                          <div className="text-lg font-black text-foreground">{formatTicketHash(ticketNo)}</div>
                          {sunatDoc && (
                            <span className="text-xs text-muted-foreground font-mono mt-0.5">
                              Doc: {sunatDoc}
                            </span>
                          )}
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${ticket.status === 'PENDING' ? 'bg-orange-500/20 text-orange-600' : ticket.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'}`}>
                          {ticket.status === 'PENDING' ? 'Pendiente' : ticket.status === 'COMPLETED' ? 'Pagado' : 'Anulado'}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-mono">{new Date(ticket.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="font-black text-emerald-500">S/ {ticket.total.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => handleReprint(ticket)}
                        className="mt-2 w-full py-2 bg-secondary/50 hover:bg-secondary rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Printer className="w-4 h-4" /> REIMPRIMIR
                      </button>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          NUMPAD MODAL
          ════════════════════════════════════════ */}
      {numpadProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-[480px] bg-card rounded-3xl shadow-2xl border-2 border-border/50 overflow-hidden flex flex-col max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border bg-surface text-center shrink-0">
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-lg font-black text-muted-foreground bg-secondary px-3 py-1 rounded-lg">{numpadProduct.code}</span>
                <h3 className="text-xl font-black uppercase text-primary">{numpadProduct.name}</h3>
              </div>
            </div>
            <div className="p-6 bg-secondary/10 border-b border-border flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="flex-1 bg-background rounded-2xl border-2 border-border p-3 text-center opacity-60">
                  <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Precio Fijo</div>
                  <div className="text-2xl font-bold">S/ {numpadProduct.price.toFixed(2)}</div>
                </div>
                <div className={`flex-1 rounded-2xl border-2 p-3 text-center cursor-pointer transition-all ${numpadField === "price" ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                  onClick={() => setNumpadField("price")}>
                  <div className={`text-xs font-bold uppercase mb-1 ${numpadField === "price" ? "text-primary" : "text-muted-foreground"}`}>Precio Variable</div>
                  <div className={`text-2xl font-bold ${numpadField === "price" ? "text-primary" : "text-foreground"}`}>S/ {numpadPrice || "0.00"}</div>
                </div>
              </div>
              <div className={`w-full rounded-2xl border-2 p-4 text-center cursor-pointer transition-all flex items-center justify-center gap-4 ${numpadField === "qty" ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-background"}`}
                onClick={() => setNumpadField("qty")}>
                <div className={`text-sm font-bold uppercase ${numpadField === "qty" ? "text-emerald-600" : "text-muted-foreground"}`}>Cantidad:</div>
                <div className={`text-5xl font-black font-mono tracking-tighter ${numpadField === "qty" ? "text-emerald-500" : "text-foreground"}`}>{numpadQty || "0"}</div>
                <div className={`text-xl font-bold uppercase ${numpadField === "qty" ? "text-emerald-600" : "text-muted-foreground"}`}>mts</div>
              </div>
            </div>
            <div className="px-5 pt-4 pb-3 grid grid-cols-3 gap-2 bg-card">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button key={num} onClick={() => handleNumpadKey(num)}
                  className="h-16 text-3xl font-black rounded-xl bg-secondary/50 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation">
                  {num}
                </button>
              ))}
              <button onClick={() => numpadField === "price" && handleNumpadKey(".")}
                className={`h-16 text-3xl font-black rounded-xl border-2 border-transparent transition-colors touch-manipulation ${numpadField === "price" ? "bg-secondary/50 hover:border-primary active:bg-primary active:text-white" : "bg-secondary/20 text-muted-foreground/30 cursor-not-allowed"}`}>
                .
              </button>
              <button onClick={() => handleNumpadKey("0")} className="h-16 text-3xl font-black rounded-xl bg-secondary/50 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation">0</button>
              <button onClick={() => handleNumpadKey("DEL")} className="h-16 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border-2 border-transparent active:bg-red-500 active:text-white transition-colors touch-manipulation">
                <Delete className="w-8 h-8" />
              </button>
            </div>
            <div className="px-5 pb-5 pt-2 flex flex-col gap-3">
              <div className="bg-background border-2 border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="text-base font-mono font-bold text-muted-foreground">{previewQty} MTS × S/ {previewPrice.toFixed(2)}</div>
                <div className="text-3xl font-black text-emerald-500 font-mono">S/ {previewSubtotal.toFixed(2)}</div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="h-20 flex-1 text-xl font-bold uppercase rounded-2xl border-2" onClick={() => setNumpadProduct(null)}>Cancelar</Button>
                <Button className="h-20 flex-[2] text-2xl font-black uppercase rounded-2xl shadow-xl" onClick={handleNumpadOk}
                  disabled={!numpadQty || parseInt(numpadQty) <= 0 || !numpadPrice}>
                  {cart.find((c) => c.id === numpadProduct.id) ? "Actualizar" : "Agregar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          TICKET A4 FORMAT (solo @media print - Adaptado a A4 centrado con reglas gerenciales)
          ════════════════════════════════════════ */}
      <div id="print-ticket">
        {lastSaleInfo && (
          <>
            <div className="ticket-header" style={{ textAlign: "center", fontWeight: "900", fontSize: "32px", textTransform: "uppercase", letterSpacing: "2px" }}>
              PROFORMA
            </div>
            <br />
            <div style={{ textAlign: "left", fontSize: "16px", fontWeight: "bold", marginBottom: "5px" }}>
              Empleado: Propietario
            </div>
            <div className="ticket-divider"></div>

            <div className="ticket-items">
              {lastSaleInfo.items.map((item) => {
                const codigo = item.codigo || item.code || '';
                const nombre = item.nombre || item.name || item.product_name || 'Producto';
                const precioFijo = Number(item.precio_fijo || item.catalog_price || item.precio_base || item.price || 0).toFixed(2);
                const cantidad = item.cantidad || item.quantity || item.qty || 0;
                const precioVariable = Number(item.precio_variable || item.variable_price || item.editedPrice || item.price || 0).toFixed(2);
                const subtotal = Number(item.subtotal || (cantidad * precioVariable) || 0).toFixed(2);
                return (
                  <div key={item.id} className="ticket-item mb-4 pb-2 border-b border-gray-200">
                    {/* Línea 1: código, nombre y precio fijo */}
                    <div className="flex justify-between text-lg font-bold">
                      <span>{codigo ? `${codigo} ` : ''}({nombre} - S/ {precioFijo})</span>
                    </div>
                    {/* Línea 2: cantidad x precio variable y subtotal */}
                    <div className="flex justify-between items-center text-base mt-1">
                      <span>{cantidad} m x S/ {precioVariable}</span>
                      <span>S/ {subtotal}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="ticket-divider"></div>
            <div className="ticket-total-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "900", fontSize: "36px" }}>
              <span>TOTAL FINAL</span>
              <span>S/ {Math.round(lastSaleInfo.total).toFixed(2)}</span>
            </div>
            <div className="ticket-divider"></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", fontSize: "14px", color: "#555", fontWeight: "bold" }}>
              <span>
                {new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })} {new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
              <span>
                {lastSaleInfo.ticketNum !== null
                  ? `${String(lastSaleInfo.ticketNum).padStart(3, "0")}-Caja 1`
                  : "-Caja 1"}
              </span>
            </div>
          </>
        )}
      </div>

      <style>{`
        #print-ticket { display: none; }
        @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden; }
          #print-ticket, #print-ticket * { visibility: visible; }
          #print-ticket {
            display: block !important;
            position: absolute; left: 50%; top: 0; transform: translateX(-50%);
            width: 100%; max-width: 700px;
            margin-top: 20mm;
            font-family: sans-serif;
            font-size: 16px;
            color: black !important;
            background: white !important;
          }
          .ticket-divider {
            border-bottom: 2px solid black;
            margin: 15px 0;
          }
        }
      `}</style>

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
    </div>
  );
}
