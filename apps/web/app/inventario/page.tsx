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
import { ArrowLeft, Search, Download, Filter, Plus, Edit2, Trash2, Save, FolderPlus } from "lucide-react";
import { supabase } from "../lib/supabase";

// Real schema: { id, category_id, name, sku, price, stock, unit }
type Product = {
  id: string;
  category_id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  unit?: string;
};

type Category = {
  id: string;
  name: string;
  description: string;
  created_at?: string;
};

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState<"productos" | "categorias">("productos");
  
  // Products states
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category_id: "",
    price: "",
    stock: "",
  });

  // Categories states
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
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

  const fetchCategories = async () => {
    setLoadingCategories(true);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data) {
      setCategories(data as Category[]);
    }
    setLoadingCategories(false);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  // Product CRUD functions
  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        sku: product.sku || "",
        name: product.name || "",
        category_id: product.category_id || "",
        price: product.price?.toString() || "",
        stock: product.stock?.toString() || "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        sku: "",
        name: "",
        category_id: categories[0]?.id || "",
        price: "",
        stock: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.sku || !formData.name || !formData.price || !formData.stock) {
      alert("Por favor completa los campos obligatorios (SKU, Nombre, Precio, Stock).");
      return;
    }

    setIsSaving(true);
    const payload = {
      sku: formData.sku.trim(),
      name: formData.name.trim().toUpperCase(),
      category_id: formData.category_id || null,
      price: parseFloat(formData.price) || 0,
      stock: parseFloat(formData.stock) || 0,
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

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este producto?")) return;
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);
    if (!error) {
      fetchProducts();
    } else {
      alert("Error al eliminar el producto.");
    }
  };

  // Category CRUD functions
  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name || "",
        description: category.description || ""
      });
    } else {
      setEditingCategory(null);
      setCategoryFormData({ name: "", description: "" });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      alert("El nombre de la categoría es obligatorio.");
      return;
    }

    setIsSavingCategory(true);
    const payload = {
      name: categoryFormData.name.trim().toUpperCase(),
      description: categoryFormData.description.trim()
    };

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update(payload)
          .eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .insert([payload]);
        if (error) throw error;
      }
      setIsCategoryModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      alert("Error al guardar categoría: " + err.message);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    // Check if category_id is used by any products
    const { count, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", category.id);

    if (countError) {
      alert("Error al verificar productos asociados.");
      return;
    }

    if (count && count > 0) {
      alert(`No se puede eliminar la categoría "${category.name}" porque tiene ${count} producto(s) asociado(s).`);
      return;
    }

    if (!window.confirm(`¿Estás seguro de que deseas eliminar la categoría "${category.name}"?`)) return;

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (!error) {
      fetchCategories();
    } else {
      alert("Error al eliminar la categoría.");
    }
  };

  // Helper: get category name by id
  const getCategoryName = (category_id: string) => {
    return categories.find(c => c.id === category_id)?.name || "—";
  };

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/hub">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Catálogo e Inventario</h1>
            <p className="text-muted-foreground">Mantenimiento de telas y categorías de la tienda</p>
          </div>
        </div>
        
        {activeTab === "productos" ? (
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
            <Button onClick={() => openModal()} className="gap-2 bg-primary">
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button onClick={() => openCategoryModal()} className="gap-2 bg-primary">
              <FolderPlus className="w-4 h-4" />
              Nueva Categoría
            </Button>
          </div>
        )}
      </header>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab("productos")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "productos" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Stock de Telas
        </button>
        <button
          onClick={() => setActiveTab("categorias")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "categorias" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Categorías
        </button>
      </div>

      {/* Product Tab Content */}
      {activeTab === "productos" && (
        <Card className="bg-glass border-white/10 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-surface/50 pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Todos los Productos</CardTitle>
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
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Precio/m</TableHead>
                  <TableHead className="text-right">Stock (m)</TableHead>
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
                      No se encontraron productos.
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
                        {getCategoryName(product.category_id)}
                      </TableCell>
                      <TableCell className="text-right font-medium">S/ {product.price?.toFixed(2) || "0.00"}</TableCell>
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
                          <button onClick={() => openModal(product)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(product.id)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors">
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

      {/* Category Tab Content */}
      {activeTab === "categorias" && (
        <Card className="bg-glass border-white/10 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-surface/50 pb-4">
            <CardTitle className="text-lg">Categorías del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead className="w-[300px]">Nombre de Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right w-[150px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCategories ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      Cargando categorías...
                    </TableCell>
                  </TableRow>
                ) : categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      No se encontraron categorías.
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => (
                    <TableRow key={category.id} className="hover:bg-white/5 transition-colors">
                      <TableCell className="font-bold text-foreground">
                        {category.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {category.description || "Sin descripción"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openCategoryModal(category)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteCategory(category)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors">
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
            <DialogTitle>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* SKU — reads from product.sku */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">SKU *</label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                placeholder="Ej: 2.2"
              />
            </div>
            {/* Nombre */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Producto (Nombre) *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Ej: JERSEY LISO"
                className="uppercase"
              />
            </div>
            {/* Categoría — dropdown linked to category_id */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Categoría</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Sin categoría —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Precio y Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Precio por metro (S/) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Stock actual (mts) *</label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? "Guardando..." : "Guardar Producto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Nombre de Categoría *</label>
              <Input
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({...categoryFormData, name: e.target.value})}
                placeholder="Ej: ALGODÓN"
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Descripción</label>
              <Input
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({...categoryFormData, description: e.target.value})}
                placeholder="Descripción breve"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCategory} disabled={isSavingCategory} className="gap-2">
              <Save className="w-4 h-4" />
              {isSavingCategory ? "Guardando..." : "Guardar Categoría"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
