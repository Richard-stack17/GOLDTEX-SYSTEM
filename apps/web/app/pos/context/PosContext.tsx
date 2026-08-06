"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalService } from "../../lib/localDb";
import { supabase } from "../../lib/supabase";
import { computeNextDailyTicketNumber, formatTicketHash, parseInternalTicketNum, starsoftDocNumFromTicket } from "../../lib/ticket-sequence";
import { useRole } from "../../context/RoleContext";
import { useStore } from "../../context/StoreContext";
import { silentPrintSaleReceipt } from "../../configuracion/utils/printerEngine";

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

export type CartItem = Product & { quantity: number; editedPrice: number; is_service?: boolean };

export type SaleStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type VoucherType = "TICKET" | "BOLETA" | "FACTURA";

export type HistoryTicket = {
  id: string;
  proforma_number: string | null;
  invoice_number?: string | null;
  internal_ticket_number: number | null;
  total: number;
  detail: string;
  status: SaleStatus;
  created_at: string;
  voucher_type?: VoucherType | null;
  voucher_doc_number?: string | null;
  transactions?: { payment_method: string; amount: number; surcharge_amount?: number }[];
};

interface PosContextProps {
  // Navigation & UI state
  mobileTab: "catalog" | "cart";
  setMobileTab: (tab: "catalog" | "cart") => void;
  rightPanelMode: "cart" | "history";
  setRightPanelMode: (mode: "cart" | "history") => void;
  viewMode: 'FAMILIES' | 'SERVICES';
  setViewMode: (mode: 'FAMILIES' | 'SERVICES') => void;
  
  // Data
  families: Family[];
  products: Product[];
  localServices: any[];
  quickAccessServices: any[];
  otherServices: any[];
  
  // Cart
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (product: Product, quantity: number, price: number) => void;
  removeFromCart: (id: string, e: React.MouseEvent) => void;
  total: number;
  
  // Search
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  qwertyOpen: boolean;
  setQwertyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchPage: number;
  setSearchPage: React.Dispatch<React.SetStateAction<number>>;
  handleQwertyKey: (key: string) => void;
  
  // Pagination
  familyPage: number;
  setFamilyPage: React.Dispatch<React.SetStateAction<number>>;
  servicesPage: number;
  setServicesPage: React.Dispatch<React.SetStateAction<number>>;
  familyPagePills: any[];
  searchFamiliesInPage: Family[];
  searchProductsInPage: Product[];
  combinedSearchResults: any[];
  totalSearchPages: number;
  matchedProducts: Product[];
  
  // Selection
  activeFamily: Family | null;
  setActiveFamily: React.Dispatch<React.SetStateAction<Family | null>>;
  
  // Numpad Modal
  numpadProduct: Product | null;
  setNumpadProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  numpadField: "qty" | "price";
  setNumpadField: React.Dispatch<React.SetStateAction<"qty" | "price">>;
  numpadQty: string;
  setNumpadQty: React.Dispatch<React.SetStateAction<string>>;
  numpadPrice: string;
  setNumpadPrice: React.Dispatch<React.SetStateAction<string>>;
  openNumpad: (product: Product, existing?: CartItem) => void;
  handleNumpadKey: (key: string) => void;
  handleNumpadOk: () => void;
  previewQty: number;
  previewPrice: number;
  previewSubtotal: number;
  
  // Caja
  isCajaOpen: boolean;
  setIsCajaOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenCaja: () => Promise<void>;
  handleCloseCajaAttempt: () => Promise<void>;
  confirmCloseCaja: () => Promise<void>;
  closingCajaLoading: boolean;
  cajaSummaryOpen: boolean;
  setCajaSummaryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  cajaSummary: any;
  
  // Modals & Misc
  isClearCartModalOpen: boolean;
  setIsClearCartModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  exitGuardOpen: boolean;
  setExitGuardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  previewTicketData: any;
  setPreviewTicketData: React.Dispatch<React.SetStateAction<any>>;
  activePrinter: any;
  
  // Toast
  toast: { message: string; type: 'success' | 'error' | 'warning' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  
  // Ticket Emission
  ticketNumber: number;
  isEmitting: boolean;
  handleEmitTicket: () => Promise<void>;
  deleteDraftTicket: () => void;
  handleReprint: (ticket: HistoryTicket) => Promise<void>;
  historyTickets: HistoryTicket[];
  pendingSales: any[];
  fetchHistory: () => Promise<void>;
  
  // Utils
  handleBackClick: () => void;
  handleExitWithoutSaving: () => void;
}

const PosContext = createContext<PosContextProps | undefined>(undefined);

const getLimaTodayStr = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(now);
};

export function PosProvider({ children }: { children: React.ReactNode }) {
  const { role, username, isHydrated, permissions } = useRole();
  const { activeStore, activeStoreId, isAllStoresMode } = useStore();

  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog");
  const [rightPanelMode, setRightPanelMode] = useState<"cart" | "history">("cart");
  const [viewMode, setViewMode] = useState<'FAMILIES' | 'SERVICES'>('FAMILIES');
  
  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const localServices = useLiveQuery(() => db.services.toArray(), [activeStoreId]) || [];
  const localFamilies = useLiveQuery(() => db.families.toArray(), [activeStoreId]) || [];
  const localProductsRaw = useLiveQuery(() => db.products.toArray(), [activeStoreId]) || [];
  const pendingSales = useLiveQuery(() => db.pending_sales.toArray(), []) || [];

  const sortByNumericPrefix = (a: any, b: any) => {
    const valA = `${a.code || ""} ${a.name || ""}`.trim();
    const valB = `${b.code || ""} ${b.name || ""}`.trim();
    return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
  };

  const sortByIntegerCode = (a: any, b: any) => {
    const numA = parseInt(a.code || "0", 10);
    const numB = parseInt(b.code || "0", 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return (a.code || "").localeCompare(b.code || "", undefined, { numeric: true, sensitivity: 'base' });
  };

  const families: Family[] = localFamilies.map(f => ({
    id: f.id, name: f.name, code: f.code || "", color: ""
  })).sort(sortByIntegerCode);

  const products: Product[] = localProductsRaw.map(p => ({
    id: p.id, familyId: p.family_id, name: p.name, sku: p.sku,
    price: p.price, stock: p.stock, code: p.code || p.sku || "",
  })).sort(sortByNumericPrefix);

  const familyPageSize = 15;
  const servicesPageSize = 12;
  const searchPageSize = 12;

  const totalFamilyPages = Math.max(1, Math.ceil(families.length / familyPageSize));
  const familyPagePills = useMemo(() => {
    const pills = [];
    for (let p = 1; p <= totalFamilyPages; p++) {
      const firstItem = families[(p - 1) * familyPageSize];
      const lastItem = families[Math.min(p * familyPageSize - 1, families.length - 1)];
      const startCode = firstItem ? firstItem.code : "";
      const endCode = lastItem ? lastItem.code : "";
      pills.push({ page: p, label: startCode && endCode ? `[ ${startCode} - ${endCode} ]` : `[ Pág ${p} ]` });
    }
    return pills;
  }, [families, totalFamilyPages, familyPageSize]);

  const quickAccessServices = localServices.filter(s => s.is_quick_access).sort((a, b) => a.name.localeCompare(b.name));
  const otherServices = localServices.filter(s => !s.is_quick_access).sort((a, b) => a.name.localeCompare(b.name));

  const [search, setSearch] = useState("");
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [qwertyOpen, setQwertyOpen] = useState(false);
  const [familyPage, setFamilyPage] = useState(1);
  const [servicesPage, setServicesPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);

  const trimmedSearch = search.trim();
  const isDecimalSearch = trimmedSearch.includes(".") && !isNaN(parseFloat(trimmedSearch));

  const matchedFamilies = search
    ? isDecimalSearch ? [] : families.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()) || f.code === trimmedSearch || f.code.includes(trimmedSearch))
    : [];

  const matchedProducts = search
    ? isDecimalSearch
      ? products.filter((p) => p.code === trimmedSearch || p.sku === trimmedSearch || p.code.startsWith(trimmedSearch) || p.sku?.startsWith(trimmedSearch) || p.name.toLowerCase().includes(search.toLowerCase()))
      : products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code === trimmedSearch || p.sku === trimmedSearch || p.code.includes(trimmedSearch) || p.sku?.includes(trimmedSearch))
    : activeFamily ? products.filter((p) => p.familyId === activeFamily.id) : [];

  const combinedSearchResults = search
    ? [
      ...matchedFamilies.map((f) => ({ type: "family" as const, data: f })),
      ...matchedProducts.map((p) => ({ type: "product" as const, data: p })),
    ] : [];
    
  const totalSearchPages = Math.ceil(combinedSearchResults.length / searchPageSize);
  const paginatedSearchResults = search ? combinedSearchResults.slice((searchPage - 1) * searchPageSize, searchPage * searchPageSize) : [];
  const searchFamiliesInPage = paginatedSearchResults.filter((i) => i.type === "family").map((i) => i.data as Family);
  const searchProductsInPage = paginatedSearchResults.filter((i) => i.type === "product").map((i) => i.data as Product);

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

  const [numpadProduct, setNumpadProduct] = useState<Product | null>(null);
  const [numpadField, setNumpadField] = useState<"qty" | "price">("qty");
  const [numpadQty, setNumpadQty] = useState<string>("");
  const [numpadPrice, setNumpadPrice] = useState<string>("");

  const openNumpad = (product: Product, existing?: CartItem) => {
    setNumpadProduct(product);
    if (product.is_service) {
      setNumpadField("price");
      setNumpadQty("1");
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
      else if (key === "." && numpadQty.includes(".")) return;
      else if (numpadQty === "" && key === "0") setNumpadQty("0");
      else if (numpadQty.length < 4) setNumpadQty((p) => p + key);
    } else {
      if (key === "DEL") setNumpadPrice((p) => p.slice(0, -1));
      else if (key === "." && numpadPrice.includes(".")) return;
      else if (numpadPrice.length < 7) setNumpadPrice((p) => p + key);
    }
  };

  const handleNumpadOk = () => {
    if (!numpadProduct) return;
    const qty = numpadProduct.is_service ? 1 : parseFloat(numpadQty);
    const price = parseFloat(numpadPrice);
    if (!isNaN(qty) && qty > 0 && !isNaN(price) && price >= 0) {
      setCart((prev) => {
        const exists = prev.find((i) => i.id === numpadProduct.id);
        if (exists) return prev.map((i) => i.id === numpadProduct.id ? { ...i, quantity: qty, editedPrice: price } : i);
        return [...prev, { ...numpadProduct, quantity: qty, editedPrice: price }];
      });
      setMobileTab("cart");
    }
    setNumpadProduct(null);
  };

  const removeFromCart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCart((prev) => prev.filter((i) => i.id !== id));
  };
  
  const addToCart = (product: Product, quantity: number, price: number) => {
    setCart(prev => [...prev, { ...product, quantity, editedPrice: price }]);
  };

  const total = cart.reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);
  const previewQty = numpadProduct?.is_service ? 1 : (parseFloat(numpadQty) || 0);
  const previewPrice = parseFloat(numpadPrice) || 0;
  const previewSubtotal = previewQty * previewPrice;

  // -- CAJA --
  const [isCajaOpen, setIsCajaOpen] = useState(false);
  const [closingCajaLoading, setClosingCajaLoading] = useState(false);
  const [cajaSummaryOpen, setCajaSummaryOpen] = useState(false);
  const [cajaSummary, setCajaSummary] = useState<any>(null);

  const handleOpenCaja = async () => {
    const today = getLimaTodayStr();
    setIsCajaOpen(true);
    if (activeStoreId) {
      localStorage.setItem(`isCajaOpen_${activeStoreId}`, "true");
      localStorage.setItem(`cajaOpenDate_${activeStoreId}`, today);
    }
    try {
      const channel = new BroadcastChannel("goltex_caja_channel");
      channel.postMessage({ type: "CAJA_STATE_CHANGED", isCajaOpen: true, date: today, storeId: activeStoreId });
      channel.close();
    } catch (e) { }
    if (!activeStoreId) return;
    try {
      const openRow: any = { key: 'pos_caja_open', value: 'true', store_id: activeStoreId, updated_at: new Date().toISOString() };
      const dateRow: any = { key: 'pos_caja_open_date', value: today, store_id: activeStoreId, updated_at: new Date().toISOString() };
      await supabase.from('settings').upsert([openRow, dateRow], { onConflict: 'key,store_id' });
    } catch (e) { }
  };

  const handleCloseCajaAttempt = async () => {
    setClosingCajaLoading(true);
    setCajaSummaryOpen(true);
    try {
      const todayStr = getLimaTodayStr();
      const { data, error } = await supabase.from('sales').select('transactions(payment_method, amount)').eq('record_date', todayStr).eq('status', 'COMPLETED');
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

  const confirmCloseCaja = async () => {
    setIsCajaOpen(false);
    if (activeStoreId) localStorage.setItem(`isCajaOpen_${activeStoreId}`, "false");
    setCajaSummaryOpen(false);
    try {
      const channel = new BroadcastChannel("goltex_caja_channel");
      channel.postMessage({ type: "CAJA_STATE_CHANGED", isCajaOpen: false, storeId: activeStoreId });
      channel.close();
    } catch (e) { }
    if (!activeStoreId) return;
    try {
      const closeRow: any = { key: 'pos_caja_open', value: 'false', store_id: activeStoreId, updated_at: new Date().toISOString() };
      await supabase.from('settings').upsert([closeRow], { onConflict: 'key,store_id' });
    } catch (e) { }
  };

  // Sync Caja & History
  const [ticketNumber, setTicketNumber] = useState(1);
  const [historyTickets, setHistoryTickets] = useState<HistoryTicket[]>([]);

  const fetchTodayTicketNumber = useCallback(async () => {
    const todayStr = getLimaTodayStr();
    let query = supabase.from("sales").select("internal_ticket_number").eq("record_date", todayStr).eq("source_type", "POS");
    if (activeStoreId) query = query.eq("store_id", activeStoreId);
    const { data } = await query;
    setTicketNumber(computeNextDailyTicketNumber(data ?? []));
  }, [activeStoreId]);

  const fetchHistory = useCallback(async () => {
    if (!activeStoreId) return;
    const todayStr = getLimaTodayStr();
    let query = supabase.from("sales").select("*, transactions(payment_method, amount, surcharge_amount)").eq("record_date", todayStr).eq("source_type", "POS").eq("store_id", activeStoreId).order("created_at", { ascending: false });
    const { data, error } = await query;
    if (data) {
      try {
        const profiles = await db.profiles.toArray();
        const profileMap = new Map(profiles.map(p => [p.id, p.username]));
        const enrichedData = data.map((ticket: any) => ({
          ...ticket,
          seller: ticket.seller_id ? { username: profileMap.get(ticket.seller_id) || 'ADMIN' } : null,
          cashier: ticket.cashier_id ? { username: profileMap.get(ticket.cashier_id) || 'ADMIN' } : null
        }));
        setHistoryTickets(enrichedData as HistoryTicket[]);
      } catch (e) {
        setHistoryTickets(data as HistoryTicket[]);
      }
    }
  }, [activeStoreId]);

  useEffect(() => {
    fetchTodayTicketNumber();
    fetchHistory();
  }, [fetchTodayTicketNumber, fetchHistory]);

  useEffect(() => {
    if (!activeStoreId) return;
    const today = getLimaTodayStr();
    const localStoreOpened = localStorage.getItem(`isCajaOpen_${activeStoreId}`);
    const localStoreDate = localStorage.getItem(`cajaOpenDate_${activeStoreId}`);
    if (localStoreOpened === 'true' && localStoreDate === today) setIsCajaOpen(true);
    else setIsCajaOpen(false);

    const syncCajaStateFromCloud = async () => {
      try {
        const { data } = await supabase.from('settings').select('key, value').eq('store_id', activeStoreId).in('key', ['pos_caja_open', 'pos_caja_open_date']);
        const openSetting = data?.find((s: any) => s.key === 'pos_caja_open');
        const dateSetting = data?.find((s: any) => s.key === 'pos_caja_open_date');
        if (dateSetting?.value === today && String(openSetting?.value) === 'true') {
          setIsCajaOpen(true);
          localStorage.setItem(`isCajaOpen_${activeStoreId}`, 'true');
          localStorage.setItem(`cajaOpenDate_${activeStoreId}`, today);
        } else {
          setIsCajaOpen(false);
          localStorage.setItem(`isCajaOpen_${activeStoreId}`, 'false');
        }
      } catch (e) { }
    };
    syncCajaStateFromCloud();

    const pollInterval = setInterval(() => {
      syncCajaStateFromCloud();
      fetchHistory();
      fetchTodayTicketNumber();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [activeStoreId, fetchHistory, fetchTodayTicketNumber]);

  // Modals & Misc
  const [isClearCartModalOpen, setIsClearCartModalOpen] = useState(false);
  const [exitGuardOpen, setExitGuardOpen] = useState(false);
  const [previewTicketData, setPreviewTicketData] = useState<any>(null);
  const [activePrinter, setActivePrinter] = useState<any>(null);
  
  useEffect(() => {
    async function loadPrinter() {
      let query = supabase.from('printers').select('*').order('auto_print', { ascending: false }).limit(1);
      if (activeStoreId) query = query.eq('store_id', activeStoreId);
      const { data } = await query.maybeSingle();
      if (data) setActivePrinter(data);
    }
    loadPrinter();
  }, [activeStoreId]);

  // Emission
  const [isEmitting, setIsEmitting] = useState(false);

  const handleEmitTicket = async () => {
    if (!isCajaOpen) {
      alert("Caja Cerrada. Debe realizar la apertura de caja para emitir tickets.");
      return;
    }
    if (cart.length === 0) return;
    setIsEmitting(true);
    try {
      const todayStr = getLimaTodayStr();
      const currentTicketNo = ticketNumber || 1;
      const docNum = `TKT-${String(currentTicketNo).padStart(4, '0')}`;
      const cartSnapshot = [...cart];
      const totalSnapshot = total;
      const sellerName = username || "Propietario";

      const formatItemDetail = (i: CartItem): string => {
        if (i.is_service) return `${i.code}: ${i.name} — S/ ${i.editedPrice.toFixed(2)}`;
        return `${i.code} ${i.name} — ${i.quantity}m × S/ ${i.editedPrice.toFixed(2)}`;
      };

      let localId: number | undefined;
      try {
        localId = await db.pending_sales.add({
          offline_uuid: crypto.randomUUID(), store_id: activeStoreId || '', seller_id: null, cashier_id: null, customer_id: null, total: totalSnapshot, status: 'PENDING', created_at: new Date().toISOString(), items: cartSnapshot, sync_status: 'PENDING', retry_count: 0
        });
      } catch (e) { }

      setTimeout(async () => {
        const saleDataForPrint = { proforma_number: docNum, customer_name: sellerName, items: cartSnapshot, total: totalSnapshot };
        try {
          await silentPrintSaleReceipt(saleDataForPrint, true);
        } catch (err: any) {
          if (err?.message === "NO_PRINTER_CONFIGURED") {
            showToast("⚠️ No hay ninguna impresora por defecto configurada para esta tienda.", "warning");
          } else {
            showToast("⚠️ Error de conexión con la impresora. Verifique que esté encendida.", "error");
          }
        }
      }, 50);

      setCart([]);
      setTicketNumber(prev => prev + 1);
      setRightPanelMode('history');
      setMobileTab('cart');

      (async () => {
        try {
          let customerId = "00000000-0000-0000-0000-000000000000";
          try {
            let custQuery = supabase.from("customers").select("id").eq("business_name", "CLIENTE VARIOS").limit(1);
            if (activeStoreId) custQuery = custQuery.eq("store_id", activeStoreId);
            const { data: customerData } = await custQuery;
            if (customerData && customerData.length > 0) customerId = customerData[0]!.id;
          } catch (_) { }

          let sellerId: string | null = null;
          try {
            const { data: profData } = await supabase.from('profiles').select('id').eq('username', sellerName).maybeSingle();
            if (profData?.id) sellerId = profData.id;
          } catch (_) { }

          const rpcPayload = { customer_id: customerId, record_date: todayStr, detail: cartSnapshot.map(formatItemDetail).join('\n'), items: cartSnapshot, total: totalSnapshot, seller_id: sellerId, store_id: activeStoreId };
          const { data: rpcResult, error: saleError } = await supabase.rpc('emit_pos_ticket', { p_payload: rpcPayload });
          if (!saleError && rpcResult?.success) {
            if (localId) await db.pending_sales.update(localId, { sync_status: 'SYNCED', id: rpcResult.id || undefined, synced_at: new Date().toISOString() });
            fetchTodayTicketNumber();
            fetchHistory();
          }
        } catch (e) { }
      })();
    } catch (err) { } finally {
      setIsEmitting(false);
    }
  };

  const deleteDraftTicket = () => setIsClearCartModalOpen(true);

  const handleReprint = async (ticket: HistoryTicket) => {
    const lines = typeof ticket.detail === 'string' ? ticket.detail.split('\n').filter(l => l.trim()) : [];
    const reconstructedItems: any[] = lines.map((l: string, idx: number) => {
      let code = "", name = l, quantity = 1, editedPrice = 0, basePrice = 0;
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
      } catch (e) { }
      return { id: String(idx), code, name, price: basePrice, editedPrice, quantity, familyId: "" };
    });
    try {
      const saleDataForPrint = { proforma_number: ticket.proforma_number || ticket.invoice_number || '', customer_name: "Cliente General", items: reconstructedItems, total: ticket.total };
      await silentPrintSaleReceipt(saleDataForPrint, false);
      showToast("Ticket enviado a la impresora.", "success");
    } catch (err: any) {
      if (err?.message === "NO_PRINTER_CONFIGURED") {
        showToast("⚠️ No hay ninguna impresora por defecto configurada para esta tienda.", "warning");
      } else {
        showToast("⚠️ Error de conexión con la impresora. Verifique que esté encendida.", "error");
      }
    }
  };

  const handleBackClick = () => {
    if (viewMode === 'SERVICES') { setViewMode('FAMILIES'); return; }
    if (activeFamily !== null) { setActiveFamily(null); setNumpadProduct(null); setSearch(""); setQwertyOpen(false); return; }
    if (cart.length === 0) { window.location.href = "/hub"; } else { setExitGuardOpen(true); }
  };

  const handleExitWithoutSaving = () => {
    setCart([]);
    setExitGuardOpen(false);
    window.location.href = "/hub";
  };

  return (
    <PosContext.Provider value={{
      mobileTab, setMobileTab, rightPanelMode, setRightPanelMode, viewMode, setViewMode,
      families, products, localServices, quickAccessServices, otherServices,
      cart, setCart, addToCart, removeFromCart, total,
      search, setSearch, qwertyOpen, setQwertyOpen, searchPage, setSearchPage, handleQwertyKey,
      familyPage, setFamilyPage, servicesPage, setServicesPage, familyPagePills,
      searchFamiliesInPage, searchProductsInPage, combinedSearchResults, totalSearchPages, matchedProducts,
      activeFamily, setActiveFamily,
      numpadProduct, setNumpadProduct, numpadField, setNumpadField, numpadQty, setNumpadQty, numpadPrice, setNumpadPrice,
      openNumpad, handleNumpadKey, handleNumpadOk, previewQty, previewPrice, previewSubtotal,
      isCajaOpen, setIsCajaOpen, handleOpenCaja, handleCloseCajaAttempt, confirmCloseCaja, closingCajaLoading, cajaSummaryOpen, setCajaSummaryOpen, cajaSummary,
      isClearCartModalOpen, setIsClearCartModalOpen, exitGuardOpen, setExitGuardOpen, previewTicketData, setPreviewTicketData, activePrinter,
      ticketNumber, isEmitting, handleEmitTicket, deleteDraftTicket, handleReprint, historyTickets, pendingSales, fetchHistory,
      handleBackClick, handleExitWithoutSaving, toast, showToast
    }}>
      {children}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 border ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 
            toast.type === 'warning' ? 'bg-amber-500 text-white border-amber-400' : 
            'bg-red-600 text-white border-red-500'
          }`}>
            <div className="font-bold text-sm">{toast.message}</div>
          </div>
        </div>
      )}
    </PosContext.Provider>
  );
}

export function usePos() {
  const context = useContext(PosContext);
  if (context === undefined) {
    throw new Error("usePos must be used within a PosProvider");
  }
  return context;
}
