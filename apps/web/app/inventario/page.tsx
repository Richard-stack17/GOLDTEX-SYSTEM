"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "../context/RoleContext";
import { AccessDeniedView } from "../components/AccessDeniedView";
import { useStore } from "../context/StoreContext";
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  SortableTableHead,
  Pagination
} from "@goltex/ui";
import { useTableSort } from "../hooks/useTableSort";
import { ArrowLeft, Search, Download, Filter, Plus, Edit2, Trash2, Save, FolderPlus, PackageSearch, AlertTriangle, Scissors, RefreshCcw } from "lucide-react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import StoreSwitcher from "../components/StoreSwitcher";
import StoreSelector from "../components/StoreSelector";

type Product = {
  id: string;
  family_id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  unit?: string;
  is_active?: boolean;
  store_id?: string;
};

type Family = {
  id: string;
  name: string;
  description: string;
  code?: string;
  created_at?: string;
  is_active?: boolean;
  store_id?: string;
};

type Service = {
  id: string;
  name: string;
  is_quick_access: boolean;
  created_at?: string;
  is_active?: boolean;
  store_id?: string;
};

export default function InventarioPage() {
  const router = useRouter();
  const { role, isHydrated, permissions } = useRole();
  const { activeStoreId, isAllStoresMode, availableStoreIds, availableStores } = useStore();

  const getStoreName = (id?: string) => {
    if (!id) return "—";
    return availableStores.find(s => s.id === id)?.name || "—";
  };

  const [activeTab, setActiveTab] = useState<"catalogo" | "inventario" | "familias" | "servicios">("catalogo");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");

  // Products states
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editMode, setEditMode] = useState<"catalogo" | "inventario">("catalogo");
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    family_id: "",
    price: "",
    stock: "",
    unit: "MTS",
    store_id: ""
  });
  const [familyModalError, setFamilyModalError] = useState("");
  const [serviceModalError, setServiceModalError] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Families states
  const [familySearch, setFamilySearch] = useState("");
  const [families, setFamilies] = useState<Family[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [familyToDelete, setFamilyToDelete] = useState<Family | null>(null);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [isSavingFamily, setIsSavingFamily] = useState(false);
  const [familyFormData, setFamilyFormData] = useState({
    name: "",
    description: "",
    code: "",
    store_id: ""
  });

  // Services states
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceSearch, setServiceSearch] = useState("");
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSavingService, setIsSavingService] = useState(false);
  const [serviceFormData, setServiceFormData] = useState({ name: "", is_quick_access: false, store_id: "" });
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  // Available unique families filtered by the selected store_id
  const availableFamiliesForForm = useMemo(() => {
    if (!formData.store_id) return [];
    const storeFamilies = families.filter(
      f => (!f.store_id || f.store_id === formData.store_id || (editingProduct && f.id === formData.family_id)) && f.is_active !== false
    );
    const seenNames = new Set<string>();
    const uniqueFamilies: Family[] = [];
    for (const fam of storeFamilies) {
      const normalized = fam.name.trim().toUpperCase();
      if (!seenNames.has(normalized)) {
        seenNames.add(normalized);
        uniqueFamilies.push(fam);
      }
    }
    return uniqueFamilies;
  }, [families, formData.store_id, editingProduct, formData.family_id]);

  useEffect(() => {
    if (isAllStoresMode || activeStoreId) {
      fetchProducts();
      fetchFamilies();
      fetchServices();
    }
  }, [activeStoreId, isAllStoresMode, availableStoreIds]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    let query = supabase.from("products").select("*").order("created_at", { ascending: false });
    if (isAllStoresMode) {
      query = query.in("store_id", availableStoreIds.length > 0 ? availableStoreIds : ['none']);
    } else if (activeStoreId) {
      query = query.eq("store_id", activeStoreId);
    }
    
    const { data, error } = await query;

    if (!error && data) {
      setProducts(data as Product[]);
    }
    setLoadingProducts(false);
  };

  const fetchFamilies = async () => {
    setLoadingFamilies(true);
    let query = supabase.from("families").select("*").order("name", { ascending: true });
    if (isAllStoresMode) {
      query = query.in("store_id", availableStoreIds.length > 0 ? availableStoreIds : ['none']);
    } else if (activeStoreId) {
      query = query.eq("store_id", activeStoreId);
    }
    
    const { data, error } = await query;

    if (!error && data) {
      setFamilies(data as Family[]);
    }
    setLoadingFamilies(false);
  };

  const fetchServices = async () => {
    setLoadingServices(true);
    let query = supabase.from("services").select("*").order("name", { ascending: true });
    if (isAllStoresMode) {
      query = query.in("store_id", availableStoreIds.length > 0 ? availableStoreIds : ['none']);
    } else if (activeStoreId) {
      query = query.eq("store_id", activeStoreId);
    }
    
    const { data, error } = await query;
    if (!error && data) setServices(data as Service[]);
    setLoadingServices(false);
  };

  const baseFilteredProducts = products.filter(
    (p) =>
      (statusFilter === "ALL" ? true : statusFilter === "ACTIVE" ? p.is_active !== false : p.is_active === false) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase()))
  );

  const { items: filteredProducts, requestSort: requestProductSort, sortConfig: productSortConfig } = useTableSort(baseFilteredProducts, { key: "sku", direction: "asc" });

  const baseFilteredFamilies = families.filter(f =>
      (statusFilter === "ALL" ? true : statusFilter === "ACTIVE" ? f.is_active !== false : f.is_active === false) &&
      (f.name.toLowerCase().includes(familySearch.toLowerCase()) ||
      (f.code || "").toLowerCase().includes(familySearch.toLowerCase()))
  );

  const { items: filteredFamilies, requestSort: requestFamilySort, sortConfig: familySortConfig } = useTableSort(baseFilteredFamilies, { key: "code", direction: "asc" });

  const baseFilteredServices = services.filter(s => 
    (statusFilter === "ALL" ? true : statusFilter === "ACTIVE" ? s.is_active !== false : s.is_active === false) && 
    s.name.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, statusFilter, search, familySearch, serviceSearch, itemsPerPage]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const paginatedFamilies = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFamilies.slice(start, start + itemsPerPage);
  }, [filteredFamilies, currentPage, itemsPerPage]);

  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return baseFilteredServices.slice(start, start + itemsPerPage);
  }, [baseFilteredServices, currentPage, itemsPerPage]);

  // Product CRUD functions
  const openModal = (product?: Product, mode: "catalogo" | "inventario" = "catalogo") => {
    setModalError("");
    setEditMode(mode);
    if (product) {
      setEditingProduct(product);
      setFormData({
        sku: product.sku || "",
        name: product.name || "",
        family_id: product.family_id || "",
        price: product.price?.toString() || "",
        stock: product.stock?.toString() || "",
        unit: product.unit || "MTS",
        store_id: product.store_id || activeStoreId || ""
      });
    } else {
      setEditingProduct(null);
      setFormData({
        sku: "",
        name: "",
        family_id: families[0]?.id || "",
        price: "",
        stock: "0",
        unit: "MTS",
        store_id: activeStoreId || ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (editMode === "catalogo") {
      if (!formData.sku || !formData.name || !formData.family_id || !formData.price) {
        setModalError("Por favor completa los campos obligatorios (SKU, Nombre, Familia, Precio).");
        return;
      }
      const skuVal = formData.sku.trim();
      if (isNaN(Number(skuVal)) || Number(skuVal) <= 0) {
        setModalError("El SKU / Código debe ser un número válido (ej: 1.01, 2.01).");
        return;
      }
    } else {
      if (!formData.stock) {
        setModalError("Por favor indica la cantidad de Stock.");
        return;
      }
    }

    setIsSaving(true);
    const payload = editMode === "inventario"
      ? { stock: parseFloat(formData.stock) || 0 }
      : {
        name: formData.name,
        sku: formData.sku,
        family_id: formData.family_id,
        price: Number(formData.price),
        stock: Number(formData.stock),
        unit: formData.unit || "MTS",
        store_id: formData.store_id,
      };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .insert([payload]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      if (err.message?.includes('duplicate key value violates unique constraint') || err.message?.includes('products_sku_key')) {
        setModalError(`El código SKU "${formData.sku}" ya está en uso por otro producto. Elige un SKU diferente.`);
      } else {
        setModalError("Error al guardar producto: " + err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", productToDelete.id);
    if (!error) {
      fetchProducts();
    } else {
      setGlobalError("Error al eliminar el producto.");
    }
    setProductToDelete(null);
  };

  // Service CRUD functions


  const restoreProduct = async (product: Product) => {
    const { error } = await supabase.from("products").update({ is_active: true }).eq("id", product.id);
    if (!error) {
      fetchProducts();
    } else {
      if (error.message?.includes('duplicate key') || error.message?.includes('products_active_sku_key')) {
        setGlobalError(`No se puede restaurar. El SKU "${product.sku}" ya está siendo usado por un producto activo.`);
      } else {
        setGlobalError("Error al restaurar el producto: " + error.message);
      }
    }
  };

  const restoreFamily = async (family: Family) => {
    const { error } = await supabase.from("families").update({ is_active: true }).eq("id", family.id);
    if (!error) {
      fetchFamilies();
    } else {
      if (error.message?.includes('duplicate key') || error.message?.includes('families_active_code_key')) {
        setGlobalError(`No se puede restaurar. El código "${family.code}" ya está siendo usado por una familia activa.`);
      } else {
        setGlobalError("Error al restaurar la familia: " + error.message);
      }
    }
  };

  const restoreService = async (service: Service) => {
    const { error } = await supabase.from("services").update({ is_active: true }).eq("id", service.id);
    if (!error) fetchServices();
    else setGlobalError("Error al restaurar el servicio.");
  };

  const openServiceModal = (service?: Service) => {
    setServiceModalError("");
    if (service) {
      setEditingService(service);
      setServiceFormData({
        name: service.name || "",
        is_quick_access: service.is_quick_access || false,
        store_id: service.store_id || activeStoreId || ""
      });
    } else {
      setEditingService(null);
      setServiceFormData({ name: "", is_quick_access: false, store_id: activeStoreId || "" });
    }
    setIsServiceModalOpen(true);
  };

  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const handleToggleQuickAccess = (checked: boolean) => {
    if (checked) {
      const activeCount = services.filter(s => s.is_quick_access && s.id !== editingService?.id).length;
      if (activeCount >= 2) {
        setLimitDialogOpen(true);
        return;
      }
    }
    setServiceFormData({ ...serviceFormData, is_quick_access: checked });
  };

  const handleSaveService = async () => {
    if (!serviceFormData.name.trim()) {
      setServiceModalError("El nombre del servicio es obligatorio.");
      return;
    }
    setIsSavingService(true);
    const payload = { ...serviceFormData };
    try {
      if (editingService) {
        const { data, error } = await supabase.from("services").update(payload).eq("id", editingService.id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("No se pudo actualizar el servicio en la base de datos (Permisos RLS bloqueados en Supabase para UPDATE en la tabla 'services').");
        }
      } else {
        const { data, error } = await supabase.from("services").insert(payload).select();
        if (error) throw error;
      }
      setIsServiceModalOpen(false);
      fetchServices();
    } catch (err: any) {
      setServiceModalError("Error al guardar servicio: " + err.message);
    } finally {
      setIsSavingService(false);
    }
  };

  const handleDeleteService = (service: Service) => {
    setServiceToDelete(service);
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    try {
      const { error } = await supabase.from("services").update({ is_active: false, is_quick_access: false }).eq("id", serviceToDelete.id);
      if (error) throw error;
      fetchServices();
    } catch (err: any) {
      setGlobalError("Error al eliminar servicio: " + err.message);
    } finally {
      setServiceToDelete(null);
    }
  };

  // Family CRUD functions
  const openFamilyModal = (family?: Family) => {
    setFamilyModalError("");
    if (family) {
      setEditingFamily(family);
      setFamilyFormData({
        name: family.name || "",
        description: family.description || "",
        code: family.code || "",
        store_id: family.store_id || activeStoreId || ""
      });
    } else {
      setEditingFamily(null);
      setFamilyFormData({ name: "", description: "", code: "", store_id: activeStoreId || "" });
    }
    setIsFamilyModalOpen(true);
  };

  const handleSaveFamily = async () => {
    if (!familyFormData.name.trim()) {
      setFamilyModalError("El nombre de la familia es obligatorio.");
      return;
    }

    const codeVal = familyFormData.code?.trim();
    if (!codeVal || !/^[1-9]\d*$/.test(codeVal)) {
      setFamilyModalError("El código de familia debe ser un número entero positivo (ej: 1, 2, 10).");
      return;
    }

    setIsSavingFamily(true);
    const payload = {
      name: familyFormData.name.trim().toUpperCase(),
      description: familyFormData.description,
      code: codeVal,
      store_id: familyFormData.store_id,
    };

    try {
      if (editingFamily) {
        const { error } = await supabase
          .from("families")
          .update(payload)
          .eq("id", editingFamily.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("families")
          .insert([payload]);
        if (error) throw error;
      }
      setIsFamilyModalOpen(false);
      fetchFamilies();
    } catch (err: any) {
      setFamilyModalError("Error al guardar familia: " + err.message);
    } finally {
      setIsSavingFamily(false);
    }
  };

  const handleDeleteFamily = async (family: Family) => {
    const { count, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("family_id", family.id)
      .eq("is_active", true);

    if (countError) {
      setGlobalError("Error al verificar productos asociados.");
      return;
    }

    if (count && count > 0) {
      setGlobalError(`No se puede eliminar la familia "${family.name}" porque tiene ${count} producto(s) asociado(s).`);
      return;
    }

    setFamilyToDelete(family);
  };

  const confirmDeleteFamily = async () => {
    if (!familyToDelete) return;
    const { error } = await supabase
      .from("families")
      .update({ is_active: false })
      .eq("id", familyToDelete.id);

    if (!error) {
      fetchFamilies();
    } else {
      setGlobalError("Error al eliminar la familia.");
    }
    setFamilyToDelete(null);
  };

  const getFamilyName = (family_id: string) => {
    return families.find(f => f.id === family_id)?.name || "—";
  };

  const renderStatusFilter = () => (
    <div className="flex bg-secondary/50 p-1 rounded-xl shadow-inner border border-black/5">
      {[
        { id: 'ALL', label: 'Todos' },
        { id: 'ACTIVE', label: 'Activos' },
        { id: 'INACTIVE', label: 'Inactivos' }
      ].map((option) => (
        <button
          key={option.id}
          onClick={() => setStatusFilter(option.id as any)}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
            statusFilter === option.id
              ? option.id === 'ACTIVE' ? "bg-emerald-600 text-white shadow-sm"
                : option.id === 'INACTIVE' ? "bg-gray-600 text-white shadow-sm"
                  : "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-black/5"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  // ── Permission guards – placed AFTER all hooks (Rules of Hooks) ──────────
  if (!isHydrated) return null;
  if (!permissions?.access_inventory) {
    return <AccessDeniedView moduleName="Catálogo / Inventario" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-6 h-16 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <PackageSearch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">Módulo de Inventario</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Catálogo y Control de Stock</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <StoreSwitcher />
          {activeTab === "catalogo" && Boolean(permissions?.inventory_create) && (
            <button onClick={() => openModal(undefined, "catalogo")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Nuevo Producto
            </button>
          )}
          {activeTab === "familias" && Boolean(permissions?.inventory_create) && (
            <button onClick={() => openFamilyModal()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90">
              <FolderPlus className="w-3.5 h-3.5" /> Nueva Familia
            </button>
          )}
          {activeTab === "servicios" && Boolean(permissions?.inventory_create) && (
            <button onClick={() => openServiceModal()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Nuevo Servicio
            </button>
          )}

          <div className="flex bg-secondary rounded-lg p-1 gap-1">
            {[
              { id: "catalogo", label: "Catálogo General" },
              { id: "inventario", label: "Inventario Físico" },
              { id: "familias", label: "Familias / Tipos" },
              { id: "servicios", label: "Servicios" }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${activeTab === id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-screen-xl w-full mx-auto space-y-6">

        <ConfirmDialog
          isOpen={!!productToDelete}
          onCancel={() => setProductToDelete(null)}
          onConfirm={confirmDeleteProduct}
          title="Eliminar Producto"
          description={`¿Estás seguro de que deseas eliminar el producto ${productToDelete?.name}? Esta acción no se puede deshacer.`}
        />

        <ConfirmDialog
          isOpen={!!familyToDelete}
          onCancel={() => setFamilyToDelete(null)}
          onConfirm={confirmDeleteFamily}
          title="Eliminar Familia"
          description={`¿Estás seguro de que deseas eliminar la familia "${familyToDelete?.name}"? Esta acción no se puede deshacer.`}
        />

        {/* Catalog Tab Content */}
        {activeTab === "catalogo" && (
          <Card className="bg-glass border-white/10 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-border bg-surface/50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Telas del Catálogo</CardTitle>
                <div className="flex items-center gap-4">
                  {renderStatusFilter()}
                  <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por SKU o nombre..."
                    className="pl-9 h-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <SortableTableHead className="w-[100px]" field="sku" currentSort={productSortConfig} onSort={(k) => requestProductSort(k as any)}>SKU</SortableTableHead>
                    <SortableTableHead field="name" currentSort={productSortConfig} onSort={(k) => requestProductSort(k as any)}>Producto</SortableTableHead>
                    <SortableTableHead field="family_id" currentSort={productSortConfig} onSort={(k) => requestProductSort(k as any)}>Familia</SortableTableHead>
                    <TableHead>Tienda</TableHead>
                    <SortableTableHead className="text-right" field="price" currentSort={productSortConfig} onSort={(k) => requestProductSort(k as any)}>Precio/m</SortableTableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProducts ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        Cargando catálogo...
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No se encontraron productos registrados en la base de datos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedProducts.map((product) => (
                      <TableRow key={product.id} className={`hover:bg-white/5 transition-colors ${product.is_active === false ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
                        <TableCell className="font-mono text-sm font-bold text-primary">
                          {product.sku}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {product.name}
                            {product.is_active === false && <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">INACTIVO</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {getFamilyName(product.family_id)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-medium">
                          {getStoreName(product.store_id)}
                        </TableCell>
                        <TableCell className="text-right font-medium">S/ {product.price?.toFixed(2) || "0.00"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {product.is_active === false ? (
                              <button onClick={() => restoreProduct(product)} className="p-2 text-muted-foreground hover:text-emerald-600 transition-colors" title="Restaurar Producto">
                                <RefreshCcw className="w-4 h-4" />
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                {Boolean(permissions?.inventory_edit) && (
                                  <button onClick={() => openModal(product, "catalogo")} className="p-2 text-muted-foreground hover:text-indigo-600 transition-colors" title="Editar Producto">
                                    <Edit2 className="w-4 h-4" />
                                 </button>
                                )}
                                {Boolean(permissions?.inventory_delete) && (
                                  <button onClick={() => handleDelete(product)} className="p-2 text-muted-foreground hover:text-rose-600 transition-colors" title="Eliminar Producto">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredProducts.length > 0 && (
                <div className="border-t border-border bg-surface/50">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredProducts.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Inventory Tab Content */}
        {activeTab === "inventario" && (
          <Card className="bg-glass border-white/10 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-border bg-surface/50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Inventario de Stock</CardTitle>
                <div className="flex items-center gap-4">
                  {renderStatusFilter()}
                  <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por SKU o nombre..."
                    className="pl-9 h-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <SortableTableHead className="w-[100px]" field="sku" currentSort={productSortConfig} onSort={(k) => requestProductSort(k as any)}>SKU</SortableTableHead>
                    <SortableTableHead field="name" currentSort={productSortConfig} onSort={(k) => requestProductSort(k as any)}>Producto</SortableTableHead>
                    <SortableTableHead field="family_id" currentSort={productSortConfig} onSort={(k) => requestProductSort(k as any)}>Familia</SortableTableHead>
                    <TableHead>Tienda</TableHead>
                    <SortableTableHead className="text-right" field="stock" currentSort={productSortConfig} onSort={(k) => requestProductSort(k as any)}>Stock (m)</SortableTableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProducts ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        Cargando inventario...
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No se encontraron productos registrados para el inventario.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedProducts.map((product) => (
                      <TableRow key={product.id} className={`hover:bg-white/5 transition-colors ${product.is_active === false ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
                        <TableCell className="font-mono text-sm font-bold text-primary">
                          {product.sku}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {getFamilyName(product.family_id)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-medium">
                          {getStoreName(product.store_id)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`inline-flex items-center justify-center gap-1.5 ${product.stock <= 10 ? 'text-amber-500 font-bold' : ''}`}>
                            {product.stock <= 10 && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                            {product.stock?.toFixed(2) || "0.00"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={product.is_active === false ? 'destructive' : product.stock <= 10 ? 'warning' : 'success'}
                            className={product.is_active === false ? 'bg-gray-500 hover:bg-gray-600' : ''}
                          >
                            {product.is_active === false ? 'Inactivo' : product.stock <= 10 ? 'Stock Bajo' : 'Disponible'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {Boolean(permissions?.inventory_edit) && (
                              <button onClick={() => openModal(product, "inventario")} className="p-2 text-muted-foreground hover:text-indigo-600 transition-colors" title="Ajustar Stock">
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredProducts.length > 0 && (
                <div className="border-t border-border bg-surface/50">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredProducts.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Family Tab Content */}
        {activeTab === "familias" && (
          <Card className="bg-glass border-white/10 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-border bg-surface/50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Familias del Sistema</CardTitle>
                <div className="flex items-center gap-4">
                  {renderStatusFilter()}
                  <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar familia o código..."
                    className="pl-9 h-9"
                    value={familySearch}
                    onChange={(e) => setFamilySearch(e.target.value)}
                  />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <SortableTableHead className="w-[100px]" field="code" currentSort={familySortConfig} onSort={(k) => requestFamilySort(k as any)}>Código</SortableTableHead>
                    <SortableTableHead className="w-[300px]" field="name" currentSort={familySortConfig} onSort={(k) => requestFamilySort(k as any)}>Nombre de Familia</SortableTableHead>
                    <TableHead>Tienda</TableHead>
                    <SortableTableHead field="description" currentSort={familySortConfig} onSort={(k) => requestFamilySort(k as any)}>Descripción</SortableTableHead>
                    <TableHead className="text-right w-[150px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingFamilies ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        Cargando familias...
                      </TableCell>
                    </TableRow>
                  ) : filteredFamilies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No se encontraron familias registradas. Agrega una nueva familia para organizar tus productos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedFamilies.map((family) => (
                      <TableRow key={family.id} className={`hover:bg-white/5 transition-colors ${family.is_active === false ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
                        <TableCell className="font-mono text-muted-foreground font-bold">
                          {family.code || "—"}
                        </TableCell>
                        <TableCell className="font-bold text-foreground">
                          {family.name}
                          {family.is_active === false && <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">INACTIVO</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-medium">
                          {getStoreName(family.store_id)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {family.description || "Sin descripción"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {family.is_active === false ? (
                              <button onClick={() => restoreFamily(family)} className="p-2 text-muted-foreground hover:text-emerald-600 transition-colors" title="Restaurar Familia">
                                <RefreshCcw className="w-4 h-4" />
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                {Boolean(permissions?.inventory_edit) && (
                                  <button onClick={() => openFamilyModal(family)} className="p-2 text-muted-foreground hover:text-indigo-600 transition-colors" title="Editar Familia">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {Boolean(permissions?.inventory_delete) && (
                                  <button onClick={() => handleDeleteFamily(family)} className="p-2 text-muted-foreground hover:text-rose-600 transition-colors" title="Eliminar Familia">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredFamilies.length > 0 && (
                <div className="border-t border-border bg-surface/50">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredFamilies.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Services Tab Content */}
        {activeTab === "servicios" && (
          <Card className="bg-glass border-white/10 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-border bg-surface/50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Directorio de Servicios</CardTitle>
                <div className="flex items-center gap-4">
                  {renderStatusFilter()}
                  <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar servicio..."
                    className="pl-9 h-9"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                  />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="w-[300px]">Nombre del Servicio</TableHead>
                    <TableHead>Tienda</TableHead>
                    <TableHead>Acceso Rápido en Punto 1 (POS)</TableHead>
                    <TableHead className="text-right w-[150px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingServices ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        Cargando servicios...
                      </TableCell>
                    </TableRow>
                  ) : baseFilteredServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        No se encontraron servicios registrados. Agrega uno nuevo para usar en el POS.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedServices.map((service) => (
                      <TableRow key={service.id} className={`hover:bg-white/5 transition-colors ${service.is_active === false ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
                        <TableCell className="font-bold text-foreground">
                          {service.name}
                          {service.is_active === false && <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">INACTIVO</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-medium">
                          {getStoreName(service.store_id)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={service.is_quick_access ? 'success' : 'outline'}>
                            {service.is_quick_access ? 'Sí' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {service.is_active === false ? (
                              <button onClick={() => restoreService(service)} className="p-2 text-muted-foreground hover:text-emerald-600 transition-colors" title="Restaurar Servicio">
                                <RefreshCcw className="w-4 h-4" />
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                {Boolean(permissions?.inventory_edit) && (
                                  <button onClick={() => openServiceModal(service)} className="p-2 text-muted-foreground hover:text-indigo-600 transition-colors" title="Editar Servicio">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {Boolean(permissions?.inventory_delete) && (
                                  <button onClick={() => handleDeleteService(service)} className="p-2 text-muted-foreground hover:text-rose-600 transition-colors" title="Eliminar Servicio">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {baseFilteredServices.length > 0 && (
                <div className="border-t border-border bg-surface/50">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={baseFilteredServices.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Product Dialog Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingProduct
                  ? (editMode === "inventario" ? 'Ajustar Stock' : 'Editar Producto')
                  : 'Nuevo Producto'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editMode === "catalogo" ? (
                <>
                  {/* 1. Asignar a Tienda */}
                  <StoreSelector
                    value={formData.store_id}
                    onChange={(val) => setFormData(prev => ({ ...prev, store_id: val, family_id: "" }))}
                    disabled={!!editingProduct}
                    allowedStoreIds={availableStoreIds}
                  />

                  {/* 2. Familia / Categoría */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Familia *</label>
                    <select
                      value={formData.family_id}
                      onChange={(e) => setFormData({ ...formData, family_id: e.target.value })}
                      disabled={!formData.store_id}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <option value="">
                        {formData.store_id ? "— Selecciona una familia —" : "— Selecciona primero una tienda —"}
                      </option>
                      {availableFamiliesForForm.map((fam: Family) => (
                        <option key={fam.id} value={fam.id}>
                          {fam.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Producto (Nombre) */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Producto (Nombre) *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: JERSEY LISO"
                      className="uppercase"
                    />
                  </div>

                  {/* 4. SKU */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">SKU / Código de Tela *</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="Ej: 2.01"
                    />
                  </div>

                  {/* 5. Precio y Stock Inicial */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Precio por metro (S/) *</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    {!editingProduct && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Stock Inicial (mts) *</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.stock}
                          onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5 p-3.5 bg-secondary/20 rounded-xl border">
                    <div className="text-xs text-muted-foreground font-bold uppercase">Producto Seleccionado</div>
                    <div className="text-base font-bold text-foreground">{editingProduct?.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">SKU: {editingProduct?.sku} | Fam: {getFamilyName(editingProduct?.family_id || "")}</div>
                  </div>
                  {/* Stock Input Only */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Stock Actual (mts) *</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </>
              )}
              {modalError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-sm font-bold mt-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>{modalError}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="w-4 h-4" />
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Family Dialog Modal */}
        <Dialog open={isFamilyModalOpen} onOpenChange={setIsFamilyModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingFamily ? 'Editar Familia' : 'Nueva Familia'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <StoreSelector
                value={familyFormData.store_id}
                onChange={(val) => setFamilyFormData({ ...familyFormData, store_id: val })}
                disabled={!!editingFamily}
                allowedStoreIds={availableStoreIds}
              />
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2 col-span-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Código *</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={familyFormData.code}
                    onChange={(e) => setFamilyFormData({ ...familyFormData, code: e.target.value.replace(/\D/g, "") })}
                    placeholder="Ej: 2"
                  />
                </div>
                <div className="space-y-2 col-span-3">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Nombre de Familia *</label>
                  <Input
                    value={familyFormData.name}
                    onChange={(e) => setFamilyFormData({ ...familyFormData, name: e.target.value })}
                    placeholder="Ej: ALGODÓN"
                    className="uppercase"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Descripción</label>
                <Input
                  value={familyFormData.description}
                  onChange={(e) => setFamilyFormData({ ...familyFormData, description: e.target.value })}
                  placeholder="Descripción breve"
                />
              </div>
              {familyModalError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-sm font-bold mt-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>{familyModalError}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setIsFamilyModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveFamily} disabled={isSavingFamily} className="gap-2">
                <Save className="w-4 h-4" />
                {isSavingFamily ? "Guardando..." : "Guardar Familia"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* Service Dialog Modal */}
        <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingService ? "Editar Servicio" : "Nuevo Servicio"}
              </DialogTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {editingService ? "Actualiza la información del servicio." : "Ingresa los datos del nuevo servicio."}
              </div>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <StoreSelector
                value={serviceFormData.store_id}
                onChange={(val) => setServiceFormData({ ...serviceFormData, store_id: val })}
                disabled={!!editingService}
                allowedStoreIds={availableStoreIds}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre del Servicio</label>
                <Input
                  placeholder="Ej. COSTO POR CONFECCIÓN"
                  value={serviceFormData.name}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value.toUpperCase() })}
                  className="uppercase"
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Acceso Rápido en Punto 1 o POS</label>
                  <div className="text-xs text-muted-foreground">Mostrar como botón destacado en el carrito</div>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-primary"
                  checked={serviceFormData.is_quick_access}
                  onChange={(e) => handleToggleQuickAccess(e.target.checked)}
                />
              </div>
              {serviceFormData.is_quick_access && (
                <div className="border-t border-border mt-2 pt-4">
                  <label className="text-xs font-medium text-slate-400 mb-2 block">
                    Vista previa en el POS:
                  </label>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex justify-center">
                    <Button
                      variant="outline"
                      className="h-8 border-dashed border-2 border-purple-400 text-purple-600 bg-purple-50 flex items-center justify-center gap-2 font-bold text-[10px] uppercase rounded-xl px-4 pointer-events-none"
                    >
                      <Scissors className="w-3 h-3" />
                      + {serviceFormData.name || "NUEVO SERVICIO"}
                    </Button>
                  </div>
                </div>
              )}
              {serviceModalError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-sm font-bold mt-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>{serviceModalError}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
              <Button variant="outline" onClick={() => setIsServiceModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveService} disabled={isSavingService}>
                {isSavingService ? "Guardando..." : "Guardar Servicio"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          isOpen={!!serviceToDelete}
          onCancel={() => setServiceToDelete(null)}
          onConfirm={confirmDeleteService}
          title="Eliminar Servicio"
          description={`¿Estás seguro de que deseas eliminar el servicio ${serviceToDelete?.name}?`}
        />

        {/* Limit Alert Dialog */}
        <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border z-[60]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Límite Alcanzado
              </DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm leading-relaxed mt-2">
              Solo puedes tener un máximo de 2 servicios marcados como "Acceso Rápido".
              Por favor, desmarca uno existente antes de agregar otro.
            </p>
            <div className="flex justify-end pt-2 mt-4">
              <Button className="font-bold h-11" variant="default" onClick={() => setLimitDialogOpen(false)}>
                Entendido
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Global Error Dialog */}
        <Dialog open={!!globalError} onOpenChange={(open) => !open && setGlobalError(null)}>
          <DialogContent className="sm:max-w-md bg-card border-border z-[60]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                Error
              </DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm font-medium leading-relaxed mt-2">
              {globalError}
            </p>
            <div className="flex justify-end pt-2 mt-4">
              <Button className="font-bold h-11" variant="outline" onClick={() => setGlobalError(null)}>
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
