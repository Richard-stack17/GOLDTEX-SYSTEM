"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalService } from "../../lib/localDb";
import { supabase } from "../../lib/supabase";
import { computeNextDailyTicketNumber, formatTicketHash, parseInternalTicketNum, starsoftDocNumFromTicket } from "../../lib/ticket-sequence";
import { useRole } from "../../context/RoleContext";
import { useStore } from "../../context/StoreContext";
import { silentPrintSaleReceipt, silentPrintClosureReport, resolveActivePrinter, checkDevicePermission, pairActivePrinter } from "../../configuracion/utils/printerEngine";
import { isNativeAndroidApp } from "../../lib/platform";
import { CheckCircle2, AlertTriangle, XCircle, Printer, RefreshCw } from "lucide-react";

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

export type FabricCut = {
  id: string;
  count: number;
  meters: number;
  countStr?: string;
  metersStr?: string;
};

export type CartItem = Product & {
  cartItemId: string;
  quantity: number;
  editedPrice: number;
  is_service?: boolean;
  cuts?: { id: string; count: number; meters: number }[];
};

export type SaleStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type VoucherType = "TICKET" | "BOLETA" | "FACTURA";

export type HistoryTicket = {
  id: string;
  proforma_number: string | null;
  invoice_number?: string | null;
  internal_ticket_number: number | null;
  total: number;
  detail: string;
  items?: any[];
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
  numpadCartItemId: string | null;
  setNumpadCartItemId: React.Dispatch<React.SetStateAction<string | null>>;
  numpadField: "qty" | "price" | "cut";
  setNumpadField: React.Dispatch<React.SetStateAction<"qty" | "price" | "cut">>;
  numpadQty: string;
  setNumpadQty: React.Dispatch<React.SetStateAction<string>>;
  numpadPrice: string;
  setNumpadPrice: React.Dispatch<React.SetStateAction<string>>;
  numpadMode: "direct" | "cuts";
  setNumpadMode: React.Dispatch<React.SetStateAction<"direct" | "cuts">>;
  numpadCuts: FabricCut[];
  setNumpadCuts: React.Dispatch<React.SetStateAction<FabricCut[]>>;
  activeCutId: string | null;
  setActiveCutId: React.Dispatch<React.SetStateAction<string | null>>;
  activeCutField: "count" | "meters";
  setActiveCutField: React.Dispatch<React.SetStateAction<"count" | "meters">>;
  addNumpadCut: () => void;
  removeNumpadCut: (id: string) => void;
  updateNumpadCutField: (id: string, field: "count" | "meters", strVal: string) => void;
  selectCutField: (id: string, field: "count" | "meters") => void;
  isFieldFresh: boolean;
  setIsFieldFresh: React.Dispatch<React.SetStateAction<boolean>>;
  openNumpad: (product: Product, existing?: CartItem) => void;
  closeNumpad: () => void;
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
  isPrinterAuthorized: boolean | null;
  isPairingPrinter: boolean;
  handlePairPrinter: () => Promise<void>;
  refreshPrinterAuth: (printerObj?: any) => Promise<void>;

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
  const router = useRouter();
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

  // Purgar residuos offline locales al montar el POS
  useEffect(() => {
    if (typeof window !== 'undefined' && db?.pending_sales) {
      db.pending_sales.clear().catch(() => { });
    }
  }, []);

  const localServices = useLiveQuery(() => db.services.toArray(), [activeStoreId]) || [];
  const localFamilies = useLiveQuery(() => db.families.toArray(), [activeStoreId]) || [];
  const localProductsRaw = useLiveQuery(() => db.products.toArray(), [activeStoreId]) || [];

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
  const [numpadCartItemId, setNumpadCartItemId] = useState<string | null>(null);
  const [numpadField, setNumpadField] = useState<"qty" | "price" | "cut">("qty");
  const [numpadQty, setNumpadQty] = useState<string>("");
  const [numpadPrice, setNumpadPrice] = useState<string>("");
  const [numpadMode, setNumpadMode] = useState<"direct" | "cuts">("direct");
  const [numpadCuts, setNumpadCuts] = useState<FabricCut[]>([]);
  const [activeCutId, setActiveCutId] = useState<string | null>(null);
  const [activeCutField, setActiveCutField] = useState<"count" | "meters">("meters");
  const [isFieldFresh, setIsFieldFresh] = useState<boolean>(true);

  const selectCutField = (id: string, field: "count" | "meters") => {
    setActiveCutId(id);
    setActiveCutField(field);
    setNumpadField("cut");
    setIsFieldFresh(true);
  };

  const openNumpad = (product: Product, existing?: CartItem) => {
    setNumpadProduct(product);
    setNumpadCartItemId(existing?.cartItemId ?? null);
    setIsFieldFresh(true);
    if (product.is_service) {
      setNumpadMode("direct");
      setNumpadField("price");
      setNumpadQty("1");
      setNumpadPrice(existing ? existing.editedPrice.toString() : "0");
      setNumpadCuts([]);
      setActiveCutId(null);
    } else {
      setNumpadPrice(existing ? existing.editedPrice.toString() : "0");
      if (existing?.cuts && existing.cuts.length > 0) {
        setNumpadMode("cuts");
        setNumpadField("cut");
        const loadedCuts: FabricCut[] = existing.cuts.map((c) => ({
          ...c,
          countStr: c.count.toString(),
          metersStr: c.meters.toString(),
        }));
        setNumpadCuts(loadedCuts);
        setActiveCutId(loadedCuts[0]?.id ?? null);
        setActiveCutField("meters");
        setNumpadQty(existing.quantity.toString());
      } else {
        setNumpadMode("direct");
        setNumpadField("qty");
        const defaultQty = existing ? existing.quantity.toString() : "";
        setNumpadQty(defaultQty);
        const initM = existing ? existing.quantity : 1;
        const initialId = crypto.randomUUID();
        setNumpadCuts([{ id: initialId, count: 1, meters: initM, countStr: "1", metersStr: initM.toString() }]);
        setActiveCutId(initialId);
        setActiveCutField("meters");
      }
    }
  };

  const closeNumpad = () => {
    setNumpadProduct(null);
    setNumpadCartItemId(null);
    setIsFieldFresh(true);
  };

  const addNumpadCut = () => {
    const newId = crypto.randomUUID();
    const newCut: FabricCut = { id: newId, count: 1, meters: 0, countStr: "1", metersStr: "" };
    setNumpadCuts((prev) => [...prev, newCut]);
    setActiveCutId(newId);
    setActiveCutField("meters");
    setNumpadField("cut");
    setIsFieldFresh(true);
  };

  const removeNumpadCut = (id: string) => {
    setNumpadCuts((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const fallbackId = crypto.randomUUID();
        const fallbackCut: FabricCut = { id: fallbackId, count: 1, meters: 0, countStr: "1", metersStr: "" };
        setActiveCutId(fallbackId);
        setActiveCutField("meters");
        setIsFieldFresh(true);
        return [fallbackCut];
      }
      if (activeCutId === id) {
        setActiveCutId(filtered[0]?.id ?? null);
        setIsFieldFresh(true);
      }
      return filtered;
    });
  };

  const updateNumpadCutField = (id: string, field: "count" | "meters", strVal: string) => {
    setNumpadCuts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (field === "count") {
          const num = parseInt(strVal, 10) || 0;
          return { ...c, count: num, countStr: strVal };
        } else {
          const num = parseFloat(strVal) || 0;
          return { ...c, meters: num, metersStr: strVal };
        }
      })
    );
  };

  const handleNumpadKey = (key: string) => {
    if (numpadField === "qty") {
      if (isFieldFresh) {
        setIsFieldFresh(false);
        if (key === "DEL") {
          setNumpadQty("");
          return;
        } else if (key === ".") {
          setNumpadQty("0.");
          return;
        } else {
          setNumpadQty(key);
          return;
        }
      }
      if (key === "DEL") setNumpadQty((p) => p.slice(0, -1));
      else if (key === "." && numpadQty.includes(".")) return;
      else if (numpadQty === "" && key === "0") setNumpadQty("0");
      else if (numpadQty === "0" && key === ".") setNumpadQty("0.");
      else if (numpadQty === "0" && key !== "0") setNumpadQty(key);
      else if (numpadQty.length < 5) setNumpadQty((p) => p + key);
    } else if (numpadField === "price") {
      if (isFieldFresh) {
        setIsFieldFresh(false);
        if (key === "DEL") {
          setNumpadPrice("");
          return;
        } else if (key === ".") {
          setNumpadPrice("0.");
          return;
        } else {
          setNumpadPrice(key);
          return;
        }
      }
      if (key === "DEL") setNumpadPrice((p) => p.slice(0, -1));
      else if (key === "." && numpadPrice.includes(".")) return;
      else if (numpadPrice === "" && key === "0") setNumpadPrice("0");
      else if (numpadPrice === "0" && key === ".") setNumpadPrice("0.");
      else if (numpadPrice === "0" && key !== "0") setNumpadPrice(key);
      else if (numpadPrice.length < 7) setNumpadPrice((p) => p + key);
    } else if (numpadField === "cut" && activeCutId) {
      const fresh = isFieldFresh;
      if (fresh) {
        setIsFieldFresh(false);
      }

      setNumpadCuts((prev) =>
        prev.map((cut) => {
          if (cut.id !== activeCutId) return cut;
          if (activeCutField === "count") {
            let currentStr = cut.countStr ?? (cut.count > 0 ? cut.count.toString() : "");

            // Si el campo acaba de recibir foco, sobreescribir con la primera tecla
            if (fresh) {
              if (key === "DEL") currentStr = "";
              else if (key === ".") return cut;
              else currentStr = key;
            } else {
              if (key === "DEL") currentStr = currentStr.slice(0, -1);
              else if (key === ".") return cut;
              else if (currentStr === "" && key === "0") currentStr = "0";
              else if (currentStr === "0") currentStr = key;
              else if (currentStr.length < 4) currentStr += key;
            }

            const newCount = parseInt(currentStr, 10) || 0;
            return { ...cut, count: newCount, countStr: currentStr };
          } else {
            // Metros
            let currentStr = cut.metersStr ?? (cut.meters > 0 ? cut.meters.toString() : "");

            // Si el campo acaba de recibir foco, sobreescribir con la primera tecla
            if (fresh) {
              if (key === "DEL") {
                currentStr = "";
              } else if (key === ".") {
                currentStr = "0.";
              } else {
                currentStr = key;
              }
            } else {
              if (key === "DEL") currentStr = currentStr.slice(0, -1);
              else if (key === "." && currentStr.includes(".")) return cut;
              else if (currentStr === "" && key === "0") currentStr = "0";
              else if (currentStr === "0" && key === ".") currentStr = "0.";
              else if (currentStr === "0" && key !== "0") currentStr = key;
              else if (currentStr.length < 6) currentStr += key;
            }

            const newMeters = parseFloat(currentStr) || 0;
            return { ...cut, meters: newMeters, metersStr: currentStr };
          }
        })
      );
    }
  };

  const handleNumpadOk = () => {
    if (!numpadProduct) return;
    const price = parseFloat(numpadPrice);
    if (isNaN(price) || price < 0) {
      showToast("Ingresa un precio válido", "warning");
      return;
    }

    let qty = 0;
    let cutsToSave: { id: string; count: number; meters: number }[] | undefined = undefined;

    if (numpadProduct.is_service) {
      qty = 1;
    } else if (numpadMode === "cuts") {
      const validCuts = numpadCuts
        .filter((c) => (c.count || 0) > 0 && (c.meters || 0) > 0)
        .map((c) => ({ id: c.id, count: c.count, meters: c.meters }));

      if (validCuts.length === 0) {
        showToast("Ingresa al menos un corte mayor a 0 metros", "warning");
        return;
      }
      qty = validCuts.reduce((acc, c) => acc + c.count * c.meters, 0);
      cutsToSave = validCuts;
    } else {
      qty = parseFloat(numpadQty);
      if (isNaN(qty) || qty <= 0) {
        showToast("Ingresa una cantidad mayor a 0 metros", "warning");
        return;
      }
    }

    setCart((prev) => {
      if (numpadCartItemId) {
        return prev.map((i) =>
          i.cartItemId === numpadCartItemId
            ? { ...i, quantity: qty, editedPrice: price, cuts: cutsToSave }
            : i
        );
      } else {
        const exists = prev.find(
          (i) => i.id === numpadProduct.id && i.editedPrice === price && !i.cuts && !cutsToSave
        );
        if (exists) {
          return prev.map((i) =>
            i.cartItemId === exists.cartItemId
              ? { ...i, quantity: i.quantity + qty }
              : i
          );
        }
        return [
          ...prev,
          {
            ...numpadProduct,
            cartItemId: crypto.randomUUID(),
            quantity: qty,
            editedPrice: price,
            cuts: cutsToSave,
          },
        ];
      }
    });

    setRightPanelMode("cart");
    setMobileTab("cart");
    setNumpadProduct(null);
    setNumpadCartItemId(null);
  };

  const removeFromCart = (cartItemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCart((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  const addToCart = (product: Product, quantity: number, price: number) => {
    setCart(prev => {
      const exists = prev.find((i) => i.id === product.id && i.editedPrice === price);
      if (exists) {
        return prev.map((i) => i.cartItemId === exists.cartItemId ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { ...product, cartItemId: crypto.randomUUID(), quantity, editedPrice: price }];
    });
    setRightPanelMode("cart");
    setMobileTab("cart");
  };

  const total = cart.reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);
  const previewQty = useMemo(() => {
    if (numpadProduct?.is_service) return 1;
    if (numpadMode === "cuts") {
      return numpadCuts.reduce((acc, c) => acc + ((c.count || 0) * (c.meters || 0)), 0);
    }
    return parseFloat(numpadQty) || 0;
  }, [numpadProduct, numpadMode, numpadCuts, numpadQty]);

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
      let query = supabase.from('sales').select('transactions(payment_method, amount)').eq('record_date', todayStr).eq('status', 'COMPLETED');
      if (activeStoreId) query = query.eq('store_id', activeStoreId);

      const { data, error } = await query;
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
      showToast("Error al obtener resumen de caja: " + (e?.message || ""), "error");
      setCajaSummaryOpen(false);
    } finally {
      setClosingCajaLoading(false);
    }
  };

  const confirmCloseCaja = async () => {
    try {
      if (activeStoreId && cajaSummary) {
        await silentPrintClosureReport(cajaSummary, activeStoreId);
      }
    } catch (err: any) {
      showToast("Error al imprimir reporte de caja: " + err.message, "warning");
    }

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
    let query = supabase.from("sales")
      .select("id, proforma_number, invoice_number, internal_ticket_number, total, detail, items, status, created_at, seller_id, cashier_id, source_type, store_id")
      .eq("record_date", todayStr)
      .eq("source_type", "POS")
      .eq("store_id", activeStoreId)
      .order("created_at", { ascending: false });
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
      fetchTodayTicketNumber();
      fetchHistory();
    }, 3000);

    const handleWindowFocus = () => {
      syncCajaStateFromCloud();
      fetchTodayTicketNumber();
      fetchHistory();
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
    };
  }, [activeStoreId, fetchHistory, fetchTodayTicketNumber]);

  // Suscripción WebSocket en Tiempo Real (< 200ms) para Proformas, Cobros y Caja
  useEffect(() => {
    if (!activeStoreId) return;

    const channelName = `pos_realtime_${activeStoreId}_${Date.now()}`;
    const posChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales"
        },
        () => {
          fetchHistory();
          fetchTodayTicketNumber();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "settings"
        },
        () => {
          const syncCaja = async () => {
            const today = getLimaTodayStr();
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
            } catch (_) { }
          };
          syncCaja();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchHistory();
          fetchTodayTicketNumber();
        }
      });

    return () => {
      supabase.removeChannel(posChannel);
    };
  }, [activeStoreId, fetchHistory, fetchTodayTicketNumber]);

  // Modals & Misc
  const [isClearCartModalOpen, setIsClearCartModalOpen] = useState(false);
  const [exitGuardOpen, setExitGuardOpen] = useState(false);
  const [previewTicketData, setPreviewTicketData] = useState<any>(null);
  const [activePrinter, setActivePrinter] = useState<any>(null);
  const [isPrinterAuthorized, setIsPrinterAuthorized] = useState<boolean | null>(null);
  const [isPairingPrinter, setIsPairingPrinter] = useState(false);

  const refreshPrinterAuth = useCallback(async (printerObj?: any) => {
    const p = printerObj || activePrinter;
    if (!p) {
      setIsPrinterAuthorized(false);
      return;
    }
    const isAuth = await checkDevicePermission(p);
    setIsPrinterAuthorized(isAuth);
  }, [activePrinter]);

  const handlePairPrinter = async () => {
    if (!activePrinter) {
      showToast("No hay impresora configurada para esta sucursal", "warning");
      return;
    }
    setIsPairingPrinter(true);
    const targetDeviceName = activePrinter.mac_address || activePrinter.name || "tu impresora";

    if (!isNativeAndroidApp()) {
      showToast(`Selecciona "${targetDeviceName}" en la lista y presiona Conectar`, "warning");
    }

    try {
      const res = await pairActivePrinter(activePrinter);
      if (res.success) {
        setIsPrinterAuthorized(true);
        showToast(`"${activePrinter.name || targetDeviceName}" conectada y lista para imprimir`, "success");
      } else if (res.error) {
        showToast(res.error, "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Error al vincular impresora", "error");
    } finally {
      setIsPairingPrinter(false);
    }
  };

  useEffect(() => {
    async function loadPrinter() {
      try {
        const printer = await resolveActivePrinter(activeStoreId);
        if (printer) {
          setActivePrinter(printer);
          const isAuth = await checkDevicePermission(printer);
          setIsPrinterAuthorized(isAuth);
        } else {
          setActivePrinter(null);
          setIsPrinterAuthorized(false);
        }
      } catch (_) { }
    }
    loadPrinter();
  }, [activeStoreId]);

  useEffect(() => {
    const handleRecheckAuth = () => {
      if (activePrinter) {
        refreshPrinterAuth(activePrinter);
      }
    };
    window.addEventListener('focus', handleRecheckAuth);
    document.addEventListener('visibilitychange', handleRecheckAuth);
    return () => {
      window.removeEventListener('focus', handleRecheckAuth);
      document.removeEventListener('visibilitychange', handleRecheckAuth);
    };
  }, [activePrinter, refreshPrinterAuth]);

  // Emission
  const [isEmitting, setIsEmitting] = useState(false);

  const handleEmitTicket = async () => {
    if (!isCajaOpen) {
      showToast("Caja Cerrada. Debe realizar la apertura de caja para emitir tickets.", "warning");
      return;
    }
    if (cart.length === 0) return;

    // Validación de Red: Exigir conexión a internet activa antes de proceder
    if (typeof window !== 'undefined' && !navigator.onLine) {
      showToast("Sin conexión a internet. Se requiere conexión activa para registrar la proforma en la nube.", "error");
      return;
    }

    // Si la impresora aún no tiene permiso en este navegador, abrimos el selector directamente con el clic del usuario
    if (activePrinter && isPrinterAuthorized === false) {
      const devName = activePrinter?.mac_address || activePrinter?.name || 'Impresora';
      showToast(`Selecciona "${devName}" en la lista y presiona Conectar`, "warning");
      try {
        const pairRes = await pairActivePrinter(activePrinter);
        if (pairRes.success) {
          setIsPrinterAuthorized(true);
        }
      } catch (_) { }
    }

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
        let text = `${i.code} ${i.name} — ${i.quantity}m × S/ ${i.editedPrice.toFixed(2)}`;
        if (i.cuts && i.cuts.length > 0) {
          const cutsStr = i.cuts.map((c) => `  ${c.count}x${c.meters}m (${(c.count * c.meters).toFixed(2)}m)`).join('\n');
          text += `\n${cutsStr}`;
        }
        return text;
      };

      // 1. Obtener cliente y vendedor
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

      const rpcPayload = {
        customer_id: customerId,
        record_date: todayStr,
        detail: cartSnapshot.map(formatItemDetail).join('\n'),
        items: cartSnapshot,
        total: totalSnapshot,
        seller_id: sellerId,
        store_id: activeStoreId
      };

      // 2. REGISTRAR DIRECTAMENTE EN SUPABASE (LA NUBE)
      const { data: rpcResult, error: saleError } = await supabase.rpc('emit_pos_ticket', { p_payload: rpcPayload });

      if (saleError || !rpcResult?.success) {
        console.error("Error al emitir proforma en Supabase:", saleError);
        let errMsg = saleError?.message || "No se pudo registrar la proforma en la nube.";
        if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('timeout') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          errMsg = "Sin conexión a internet: No se pudo registrar la proforma en la nube. Verifica tu red WiFi o datos móviles.";
        }
        showToast(errMsg, "error");
        setIsEmitting(false);
        return; // ABORTAR: El carrito queda intacto, no se imprime y no avanza el número
      }

      // 3. Proforma registrada exitosamente en la nube
      const generatedDocNum = rpcResult?.proforma_number || rpcResult?.invoice_number || docNum;
      showToast(`Proforma ${generatedDocNum} registrada en la nube. Imprimiendo 2 copias...`, 'success');

      // 4. Imprimir 2 copias
      setTimeout(async () => {
        const saleDataForPrint = {
          proforma_number: generatedDocNum,
          customer_name: sellerName,
          items: cartSnapshot,
          total: totalSnapshot
        };
        try {
          await silentPrintSaleReceipt(saleDataForPrint, true, activeStoreId || undefined);
          showToast(`Impresión finalizada (${generatedDocNum} — 2 copias).`, 'success');
        } catch (err: any) {
          const errMsg = err?.message || '';
          const devName = activePrinter?.mac_address || activePrinter?.name || 'Impresora';
          if (errMsg.includes("NO_PRINTER_CONFIGURED")) {
            showToast("No hay ninguna impresora configurada para esta sucursal.", "warning");
          } else if (errMsg.includes("PRINTER_NOT_AUTHORIZED_IN_BROWSER") || isPrinterAuthorized === false) {
            showToast(`Impresora no vinculada en este navegador. Haz clic en 'Conectar ${devName}' arriba.`, "warning");
          } else {
            showToast(`Error de comunicación con "${devName}". Verifique que esté encendida y cercana.`, "error");
          }
        }
      }, 50);

      // 5. Limpiar carrito y actualizar estado
      setCart([]);
      await fetchTodayTicketNumber();
      await fetchHistory();
      setRightPanelMode('history');
      setMobileTab('cart');

    } catch (err: any) {
      console.error("Error de conexión emitiendo ticket:", err);
      let errMsg = err?.message || "Error al emitir la proforma.";
      if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('timeout') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        errMsg = "Sin conexión a internet: No se pudo registrar la proforma en la nube. Verifica tu red WiFi o datos móviles.";
      }
      showToast(errMsg, "error");
    } finally {
      setIsEmitting(false);
    }
  };

  const deleteDraftTicket = () => setIsClearCartModalOpen(true);

  const handleReprint = async (ticket: HistoryTicket) => {
    // Si la impresora aún no tiene permiso en este dispositivo, intentar vincular
    if (activePrinter && isPrinterAuthorized === false) {
      const devName = activePrinter?.mac_address || activePrinter?.name || 'Impresora';
      try {
        const pairRes = await pairActivePrinter(activePrinter);
        if (pairRes.success) {
          setIsPrinterAuthorized(true);
        } else {
          showToast(`Impresora no vinculada. Haz clic en 'Conectar' arriba.`, "warning");
          return;
        }
      } catch (_) {
        showToast(`Impresora no vinculada. Haz clic en 'Conectar' arriba.`, "warning");
        return;
      }
    }

    let itemsToPrint: any[] = [];
    if (ticket.items && Array.isArray(ticket.items) && ticket.items.length > 0) {
      itemsToPrint = ticket.items;
    } else {
      const reconstructedItems: any[] = [];
      const lines = typeof ticket.detail === 'string' ? ticket.detail.split('\n') : [];
      for (const rawLine of lines) {
        if (!rawLine.trim()) continue;
        if (rawLine.startsWith('  ') || rawLine.startsWith('\t')) {
          if (reconstructedItems.length > 0) {
            const lastItem = reconstructedItems[reconstructedItems.length - 1];
            const match = rawLine.trim().match(/^(\d+)\s*x\s*([\d.]+)/i);
            if (match) {
              if (!lastItem.cuts) lastItem.cuts = [];
              lastItem.cuts.push({
                id: crypto.randomUUID(),
                count: parseInt(match[1] ?? '1', 10) || 1,
                meters: parseFloat(match[2] ?? '0') || 0
              });
            }
          }
          continue;
        }

        let code = "", name = rawLine, quantity = 1, editedPrice = 0, basePrice = 0;
        try {
          const sepIdx = rawLine.indexOf(' — ');
          if (sepIdx !== -1) {
            const firstPart = rawLine.substring(0, sepIdx);
            const secondPart = rawLine.substring(sepIdx + 3);
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
        reconstructedItems.push({ id: String(reconstructedItems.length), code, name, price: basePrice, editedPrice, quantity, familyId: "" });
      }
      itemsToPrint = reconstructedItems;
    }

    try {
      showToast("Conectando con la impresora térmica...", "success");
      const saleDataForPrint = { proforma_number: ticket.proforma_number || ticket.invoice_number || '', customer_name: "Cliente General", items: itemsToPrint, total: ticket.total };
      await silentPrintSaleReceipt(saleDataForPrint, false, activeStoreId || undefined);
      showToast("¡Ticket impreso con éxito!", "success");
    } catch (err: any) {
      const errMsg = err?.message || '';
      const devName = activePrinter?.mac_address || activePrinter?.name || 'Impresora';
      if (errMsg.includes("NO_PRINTER_CONFIGURED")) {
        showToast("No hay ninguna impresora configurada para esta sucursal.", "warning");
      } else if (errMsg.includes("PRINTER_NOT_AUTHORIZED_IN_BROWSER") || isPrinterAuthorized === false) {
        showToast(`Impresora no vinculada. Haz clic en 'Conectar ${devName}' arriba.`, "warning");
      } else {
        showToast(`Error de comunicación con "${devName}". Verifique que esté encendida y cercana.`, "error");
      }
    }
  };

  const handleBackClick = useCallback(() => {
    if (exitGuardOpen) { setExitGuardOpen(false); return; }
    if (previewTicketData) { setPreviewTicketData(null); return; }
    if (isClearCartModalOpen) { setIsClearCartModalOpen(false); return; }
    if (cajaSummaryOpen) { setCajaSummaryOpen(false); return; }
    if (qwertyOpen) { setQwertyOpen(false); return; }
    if (numpadProduct !== null) { setNumpadProduct(null); return; }
    if (mobileTab === 'cart') { setMobileTab('catalog'); return; }
    if (viewMode === 'SERVICES') { setViewMode('FAMILIES'); return; }
    if (activeFamily !== null) { setActiveFamily(null); setNumpadProduct(null); setSearch(""); setQwertyOpen(false); return; }
    if (cart.length === 0) {
      router.push('/hub');
    } else {
      setExitGuardOpen(true);
    }
  }, [
    exitGuardOpen, previewTicketData, isClearCartModalOpen, cajaSummaryOpen,
    qwertyOpen, numpadProduct, mobileTab, viewMode, activeFamily, cart.length, router
  ]);

  const handleExitWithoutSaving = useCallback(() => {
    setCart([]);
    setExitGuardOpen(false);
    router.push('/hub');
  }, [router]);

  useEffect(() => {
    const onAndroidBack = (e: Event) => {
      e.preventDefault();
      handleBackClick();
    };
    window.addEventListener('goltex:android-back', onAndroidBack);
    return () => window.removeEventListener('goltex:android-back', onAndroidBack);
  }, [handleBackClick]);

  return (
    <PosContext.Provider value={{
      mobileTab, setMobileTab, rightPanelMode, setRightPanelMode, viewMode, setViewMode,
      families, products, localServices, quickAccessServices, otherServices,
      cart, setCart, addToCart, removeFromCart, total,
      search, setSearch, qwertyOpen, setQwertyOpen, searchPage, setSearchPage, handleQwertyKey,
      familyPage, setFamilyPage, servicesPage, setServicesPage, familyPagePills,
      searchFamiliesInPage, searchProductsInPage, combinedSearchResults, totalSearchPages, matchedProducts,
      activeFamily, setActiveFamily,
      numpadProduct, setNumpadProduct, numpadCartItemId, setNumpadCartItemId, numpadField, setNumpadField, numpadQty, setNumpadQty, numpadPrice, setNumpadPrice,
      numpadMode, setNumpadMode, numpadCuts, setNumpadCuts, activeCutId, setActiveCutId, activeCutField, setActiveCutField,
      addNumpadCut, removeNumpadCut, updateNumpadCutField, selectCutField, isFieldFresh, setIsFieldFresh,
      openNumpad, closeNumpad, handleNumpadKey, handleNumpadOk, previewQty, previewPrice, previewSubtotal,
      isCajaOpen, setIsCajaOpen, handleOpenCaja, handleCloseCajaAttempt, confirmCloseCaja, closingCajaLoading, cajaSummaryOpen, setCajaSummaryOpen, cajaSummary,
      isClearCartModalOpen, setIsClearCartModalOpen, exitGuardOpen, setExitGuardOpen, previewTicketData, setPreviewTicketData,
      activePrinter, isPrinterAuthorized, isPairingPrinter, handlePairPrinter, refreshPrinterAuth,
      ticketNumber, isEmitting, handleEmitTicket, deleteDraftTicket, handleReprint, historyTickets, fetchHistory,
      handleBackClick, handleExitWithoutSaving, toast, showToast
    }}>
      {children}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-none max-w-sm">
          <div className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' :
              toast.type === 'warning' ? 'bg-amber-500 text-white border-amber-400' :
                'bg-red-600 text-white border-red-500'
            }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 shrink-0" />}
            <div className="font-bold text-sm leading-tight">{toast.message}</div>
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
