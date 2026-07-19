"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
  DialogTitle
} from "@goltex/ui";
import { ArrowLeft, Search, Download, Filter, Plus, Edit2, Trash2, Save, FolderPlus, PackageSearch, AlertTriangle, Scissors } from "lucide-react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  family_id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  unit?: string;
};

type Family = {
  id: string;
  name: string;
  description: string;
  code?: string;
  created_at?: string;
};

type Service = {
  id: string;
  name: string;
  is_quick_access: boolean;
  created_at?: string;
};

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState<"catalogo" | "inventario" | "familias" | "servicios">("catalogo");

  // Products states
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editMode, setEditMode] = useState<"catalogo" | "inventario">("catalogo");
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    family_id: "",
    price: "",
    stock: "",
  });

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
    code: ""
  });

  // Services states
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceSearch, setServiceSearch] = useState("");
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSavingService, setIsSavingService] = useState(false);
  const [serviceFormData, setServiceFormData] = useState({ name: "", is_quick_access: false });
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchFamilies();
    fetchServices();
  }, []);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProducts(data as Product[]);
    }
    setLoadingProducts(false);
  };

  const fetchFamilies = async () => {
    setLoadingFamilies(true);
    const { data, error } = await supabase
      .from("families")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data) {
      setFamilies(data as Family[]);
    }
    setLoadingFamilies(false);
  };

  const fetchServices = async () => {
    setLoadingServices(true);
    const { data, error } = await supabase.from("services").select("*").order("name", { ascending: true });
    if (!error && data) setServices(data as Service[]);
    setLoadingServices(false);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredFamilies = families
    .filter(f =>
      f.name.toLowerCase().includes(familySearch.toLowerCase()) ||
      (f.code || "").toLowerCase().includes(familySearch.toLowerCase())
    )
    .sort((a, b) => {
      const codeA = parseFloat(a.code || "") || Number.MAX_SAFE_INTEGER;
      const codeB = parseFloat(b.code || "") || Number.MAX_SAFE_INTEGER;
      return codeA - codeB;
    });

  // Product CRUD functions
  const openModal = (product?: Product, mode: "catalogo" | "inventario" = "catalogo") => {
    setEditMode(mode);
    if (product) {
      setEditingProduct(product);
      setFormData({
        sku: product.sku || "",
        name: product.name || "",
        family_id: product.family_id || "",
        price: product.price?.toString() || "",
        stock: product.stock?.toString() || "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        sku: "",
        name: "",
        family_id: families[0]?.id || "",
        price: "",
        stock: "0",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (editMode === "catalogo") {
      if (!formData.sku || !formData.name || !formData.price) {
        alert("Por favor completa los campos obligatorios (SKU, Nombre, Precio).");
        return;
      }
    } else {
      if (!formData.stock) {
        alert("Por favor indica la cantidad de Stock.");
        return;
      }
    }

    setIsSaving(true);
    const payload = editMode === "inventario"
      ? { stock: parseFloat(formData.stock) || 0 }
      : {
        sku: formData.sku.trim(),
        name: formData.name.trim().toUpperCase(),
        family_id: formData.family_id || null,
        price: parseFloat(formData.price) || 0,
        ...(!editingProduct ? { stock: parseFloat(formData.stock) || 0 } : {})
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
      alert("Error al guardar producto: " + err.message);
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
      .delete()
      .eq("id", productToDelete.id);
    if (!error) {
      fetchProducts();
    } else {
      alert("Error al eliminar el producto.");
    }
    setProductToDelete(null);
  };

  // Service CRUD functions
  const filteredServices = services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()));

  const openServiceModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServiceFormData({
        name: service.name || "",
        is_quick_access: service.is_quick_access || false
      });
    } else {
      setEditingService(null);
      setServiceFormData({ name: "", is_quick_access: false });
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
      alert("El nombre del servicio es obligatorio.");
      return;
    }
    setIsSavingService(true);
    const payload = {
      name: serviceFormData.name.trim().toUpperCase(),
      is_quick_access: serviceFormData.is_quick_access
    };
    try {
      if (editingService) {
        const { error } = await supabase.from("services").update(payload).eq("id", editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
      }
      setIsServiceModalOpen(false);
      fetchServices();
    } catch (err: any) {
      alert("Error al guardar servicio: " + err.message);
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
      const { error } = await supabase.from("services").delete().eq("id", serviceToDelete.id);
      if (error) throw error;
      fetchServices();
    } catch (err: any) {
      alert("Error al eliminar servicio: " + err.message);
    } finally {
      setServiceToDelete(null);
    }
  };

  // Family CRUD functions
  const openFamilyModal = (family?: Family) => {
    if (family) {
      setEditingFamily(family);
      setFamilyFormData({
        name: family.name || "",
        description: family.description || "",
        code: family.code || ""
      });
    } else {
      setEditingFamily(null);
      setFamilyFormData({ name: "", description: "", code: "" });
    }
    setIsFamilyModalOpen(true);
  };

  const handleSaveFamily = async () => {
    if (!familyFormData.name.trim()) {
      alert("El nombre de la familia es obligatorio.");
      return;
    }

    setIsSavingFamily(true);
    const payload = {
      name: familyFormData.name.trim().toUpperCase(),
      description: familyFormData.description.trim(),
      code: familyFormData.code.trim() || null
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
      alert("Error al guardar familia: " + err.message);
    } finally {
      setIsSavingFamily(false);
    }
  };

  const handleDeleteFamily = async (family: Family) => {
    const { count, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("family_id", family.id);

    if (countError) {
      alert("Error al verificar productos asociados.");
      return;
    }

    if (count && count > 0) {
      alert(`No se puede eliminar la familia "${family.name}" porque tiene ${count} producto(s) asociado(s).`);
      return;
    }

    setFamilyToDelete(family);
  };

  const confirmDeleteFamily = async () => {
    if (!familyToDelete) return;
    const { error } = await supabase
      .from("families")
      .delete()
      .eq("id", familyToDelete.id);

    if (!error) {
      fetchFamilies();
    } else {
      alert("Error al eliminar la familia.");
    }
    setFamilyToDelete(null);
  };

  const getFamilyName = (family_id: string) => {
    return families.find(f => f.id === family_id)?.name || "—";
  };

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
          {activeTab === "catalogo" && (
            <button onClick={() => openModal(undefined, "catalogo")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Nuevo Producto
            </button>
          )}
          {activeTab === "familias" && (
            <button onClick={() => openFamilyModal()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90">
              <FolderPlus className="w-3.5 h-3.5" /> Nueva Familia
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
                onClick={() => setActiveTab(id)}
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
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="w-[100px]">SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Familia</TableHead>
                    <TableHead className="text-right">Precio/m</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProducts ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        Cargando catálogo...
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No se encontraron productos registrados en la base de datos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-white/5 transition-colors">
                        <TableCell className="font-mono text-sm font-bold text-primary">
                          {product.sku}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {getFamilyName(product.family_id)}
                        </TableCell>
                        <TableCell className="text-right font-medium">S/ {product.price?.toFixed(2) || "0.00"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openModal(product, "catalogo")} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(product)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Inventory Tab Content */}
        {activeTab === "inventario" && (
          <Card className="bg-glass border-white/10 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-border bg-surface/50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Inventario de Stock</CardTitle>
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
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="w-[100px]">SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Familia</TableHead>
                    <TableHead className="text-right">Stock (m)</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProducts ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        Cargando inventario...
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No se encontraron productos registrados para el inventario.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-white/5 transition-colors">
                        <TableCell className="font-mono text-sm font-bold text-primary">
                          {product.sku}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {getFamilyName(product.family_id)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`inline-flex items-center gap-1.5 ${product.stock <= 10 ? 'text-amber-500 font-bold' : ''}`}>
                            {product.stock <= 10 && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                            {product.stock?.toFixed(2) || "0.00"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={product.stock <= 10 ? 'warning' : 'success'}>
                            {product.stock <= 10 ? 'Stock Bajo' : 'Disponible'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openModal(product, "inventario")} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Family Tab Content */}
        {activeTab === "familias" && (
          <Card className="bg-glass border-white/10 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-border bg-surface/50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Familias del Sistema</CardTitle>
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
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead className="w-[300px]">Nombre de Familia</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right w-[150px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingFamilies ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        Cargando familias...
                      </TableCell>
                    </TableRow>
                  ) : filteredFamilies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        No se encontraron familias registradas. Agrega una nueva familia para organizar tus productos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFamilies.map((family) => (
                      <TableRow key={family.id} className="hover:bg-white/5 transition-colors">
                        <TableCell className="font-mono text-muted-foreground font-bold">
                          {family.code || "—"}
                        </TableCell>
                        <TableCell className="font-bold text-foreground">
                          {family.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {family.description || "Sin descripción"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openFamilyModal(family)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteFamily(family)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Services Tab Content */}
        {activeTab === "servicios" && (
          <Card className="bg-glass border-white/10 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-border bg-surface/50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Servicios del Sistema</CardTitle>
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
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="w-[300px]">Nombre del Servicio</TableHead>
                    <TableHead>Acceso Rápido en Punto 1 (POS)</TableHead>
                    <TableHead className="text-right w-[150px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingServices ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        Cargando servicios...
                      </TableCell>
                    </TableRow>
                  ) : filteredServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        No se encontraron servicios registrados. Agrega uno nuevo para usar en el POS.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredServices.map((service) => (
                      <TableRow key={service.id} className="hover:bg-white/5 transition-colors">
                        <TableCell className="font-bold text-foreground">
                          {service.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={service.is_quick_access ? 'success' : 'outline'}>
                            {service.is_quick_access ? 'Sí' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openServiceModal(service)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteService(service)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
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
                  {/* SKU */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">SKU *</label>
                    <Input
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="Ej: 2.2"
                    />
                  </div>
                  {/* Nombre */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Producto (Nombre) *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: JERSEY LISO"
                      className="uppercase"
                    />
                  </div>
                  {/* Familia */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Familia</label>
                    <select
                      value={formData.family_id}
                      onChange={(e) => setFormData({ ...formData, family_id: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— Sin familia —</option>
                      {families.map((fam) => (
                        <option key={fam.id} value={fam.id}>
                          {fam.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Precio y Stock Inicial */}
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
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2 col-span-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Código</label>
                  <Input
                    value={familyFormData.code}
                    onChange={(e) => setFamilyFormData({ ...familyFormData, code: e.target.value })}
                    placeholder="Ej: 37"
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
      </main>
    </div>
  );
}
