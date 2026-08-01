"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Users, Search, Plus, Edit, Trash2, ArrowLeft, RotateCcw, CheckCircle2, ShieldAlert } from "lucide-react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import Link from "next/link";
import { useRole } from "../context/RoleContext";
import { useStore } from "../context/StoreContext";
import StoreSwitcher from "../components/StoreSwitcher";
import { AccessDeniedView } from "../components/AccessDeniedView";
import { Pagination, SortableTableHead } from "@goltex/ui";
import { useTableSort } from "../hooks/useTableSort";

type Customer = {
  id: string;
  business_name: string;
  doc_number: string;
  document_type: string;
  is_frequent: boolean;
  store_id?: string | null;
  created_at?: string;
  is_active?: boolean;
};

// ─── Toast helper ─────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl font-bold text-sm opacity-100 animate-in fade-in slide-in-from-bottom-4 ${
      type === 'success'
        ? 'bg-emerald-600 text-white border-emerald-700'
        : 'bg-red-600 text-white border-red-700'
    }`}>
      {type === 'success'
        ? <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />
        : <ShieldAlert className="w-5 h-5 shrink-0 text-white" />}
      <span>{message}</span>
    </div>
  );
}

export default function ClientesPage() {
  const { role, isHydrated, permissions } = useRole();
  const { activeStoreId, availableStores } = useStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    business_name: "",
    doc_number: "",
    document_type: "DNI",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, [activeStoreId]);

  // Reset page when search or toggle changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, showInactive]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCustomers = async () => {
    setLoading(true);
    let query = supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (activeStoreId) {
      query = query.or(`store_id.eq.${activeStoreId},store_id.is.null`);
    }
    const { data, error } = await query;

    if (!error && data) {
      setCustomers(data as Customer[]);
    }
    setLoading(false);
  };

  const baseFilteredCustomers = customers.filter(c => {
    const matchesSearch = c.business_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.doc_number && c.doc_number.includes(search));
    const matchesActive = showInactive ? true : (c.is_active !== false);
    return matchesSearch && matchesActive;
  });

  const { items: sortedCustomers, requestSort, sortConfig } = useTableSort(baseFilteredCustomers, {
    key: "business_name",
    direction: "asc"
  });

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = sortedCustomers.slice(startIndex, startIndex + itemsPerPage);

  const handleOpenModal = (customer?: Customer) => {
    setError(null);
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        business_name: customer.business_name || "",
        doc_number: customer.doc_number || "",
        document_type: customer.document_type || (customer.doc_number?.length === 11 ? "RUC" : "DNI"),
      });
    } else {
      setEditingCustomer(null);
      setFormData({ business_name: "", doc_number: "", document_type: "DNI" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    const { business_name, doc_number, document_type } = formData;

    if (business_name.trim().length < 3) {
      setError("La Razón Social debe tener al menos 3 caracteres.");
      return;
    }

    const cleanDoc = doc_number.replace(/\D/g, "");
    if (document_type === "DNI" && cleanDoc.length !== 8) {
      setError("El DNI debe tener exactamente 8 dígitos.");
      return;
    }
    if (document_type === "RUC" && cleanDoc.length !== 11) {
      setError("El RUC debe tener exactamente 11 dígitos.");
      return;
    }

    setIsSaving(true);
    const payload = {
      business_name: business_name.trim().toUpperCase(),
      doc_number: cleanDoc,
      document_type,
      is_frequent: true,
      store_id: activeStoreId,
      is_active: true,
    };

    try {
      if (editingCustomer) {
        const { error: updateErr } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomer.id);
        if (updateErr) throw updateErr;
        showToast("Cliente actualizado correctamente", "success");
      } else {
        const { error: insertErr } = await supabase
          .from("customers")
          .insert([payload]);
        if (insertErr) throw insertErr;
        showToast("Cliente creado correctamente", "success");
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || "Error al guardar el cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      const { error } = await supabase
        .from("customers")
        .update({ is_active: false })
        .eq("id", customerToDelete.id);

      if (error) throw error;

      showToast("Cliente desactivado correctamente", "success");
      fetchCustomers();
    } catch (err: any) {
      showToast(err.message || "Error al desactivar cliente", "error");
    } finally {
      setCustomerToDelete(null);
    }
  };

  const handleReactivate = async (customer: Customer) => {
    try {
      const { error } = await supabase
        .from("customers")
        .update({ is_active: true })
        .eq("id", customer.id);

      if (error) throw error;

      showToast("Cliente reactivado correctamente", "success");
      fetchCustomers();
    } catch (err: any) {
      showToast(err.message || "Error al reactivar cliente", "error");
    }
  };

  if (!isHydrated) return null;
  if (!permissions?.access_clientes) {
    return <AccessDeniedView moduleName="Clientes Frecuentes" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <main className="flex-1">
        <header className="bg-card border-b border-border px-6 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-none">Módulo de Clientes</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Gestión de Clientes Frecuentes</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StoreSwitcher />
            {Boolean(permissions?.customers_create) && (
              <button
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Nuevo Cliente
              </button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto space-y-6">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-3 flex-1">
              <Search className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
              <input
                type="text"
                placeholder="Buscar por DNI/RUC o Nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent border-none focus:outline-none text-gray-900 font-medium placeholder:text-gray-400"
              />
            </div>

            {/* Toggle show inactive */}
            <div className="bg-white px-4 py-3.5 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-3 shrink-0">
              <label className="text-xs font-bold text-gray-600 cursor-pointer select-none flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                Mostrar inactivos
              </label>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <SortableTableHead field="doc_number" currentSort={sortConfig} onSort={(k) => requestSort(k as any)}>
                    Documento
                  </SortableTableHead>
                  <SortableTableHead field="business_name" currentSort={sortConfig} onSort={(k) => requestSort(k as any)}>
                    Razón Social / Nombre
                  </SortableTableHead>
                  <SortableTableHead field="document_type" currentSort={sortConfig} onSort={(k) => requestSort(k as any)} className="text-center">
                    Tipo
                  </SortableTableHead>
                  <SortableTableHead field="is_active" currentSort={sortConfig} onSort={(k) => requestSort(k as any)} className="text-center">
                    Estado
                  </SortableTableHead>
                  <th className="px-6 py-4 font-bold text-center">Tienda</th>
                  <th className="px-6 py-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Cargando clientes...</td>
                  </tr>
                ) : paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      {search ? "No se encontraron clientes que coincidan con la búsqueda." : "No hay clientes registrados en esta vista."}
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map(c => {
                    const isActive = c.is_active !== false;
                    return (
                      <tr key={c.id} className={`transition-colors ${!isActive ? 'bg-gray-50/80 opacity-75' : 'hover:bg-gray-50/50'}`}>
                        <td className="px-6 py-4 font-mono font-medium text-gray-600">{c.doc_number || "---"}</td>
                        <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-2">
                          <span>{c.business_name}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            c.document_type === 'RUC' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {c.document_type || "DNI"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-300'
                          }`}>
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {c.store_id && availableStores.find(s => s.id === c.store_id) ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-blue-50 text-blue-700 border border-blue-200">
                              {availableStores.find(s => s.id === c.store_id)?.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-purple-50 text-purple-700 border border-purple-200">
                              Acceso Global
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isActive ? (
                              <>
                                {Boolean(permissions?.customers_edit) && (
                                  <button onClick={() => handleOpenModal(c)} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors" title="Editar cliente">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}
                                {Boolean(permissions?.customers_delete) && (
                                  <button onClick={() => handleDelete(c)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Desactivar cliente">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            ) : (
                              Boolean(permissions?.customers_edit) && (
                                <button
                                  onClick={() => handleReactivate(c)}
                                  className="p-2 text-gray-400 hover:text-emerald-600 transition-colors flex items-center gap-1 text-xs font-bold"
                                  title="Reactivar cliente"
                                >
                                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                                  <span className="text-emerald-600 hidden sm:inline">Reactivar</span>
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Component */}
            {sortedCustomers.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50/50">
                <Pagination
                  currentPage={currentPage}
                  totalItems={sortedCustomers.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <ConfirmDialog
        isOpen={!!customerToDelete}
        onCancel={() => setCustomerToDelete(null)}
        onConfirm={confirmDelete}
        title="Desactivar Cliente"
        description={`¿Estás seguro de que deseas desactivar al cliente "${customerToDelete?.business_name}"? Podrás reactivarlo en cualquier momento desde el filtro de inactivos.`}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {editingCustomer ? "Actualiza los datos del cliente" : "Completa los datos para registrar un cliente"}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Razón Social / Nombre</label>
                  <input
                    type="text"
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Documento</label>
                  <input
                    type="text"
                    value={formData.doc_number}
                    maxLength={formData.document_type === "DNI" ? 8 : 11}
                    onChange={(e) => setFormData({ ...formData, doc_number: e.target.value.replace(/\D/g, "") })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none font-mono"
                    placeholder={formData.document_type === "DNI" ? "Ej. 71234567 (8 dígitos)" : "Ej. 20601234567 (11 dígitos)"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de documento</label>
                  <select
                    value={formData.document_type}
                    onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
                  >
                    <option value="DNI">DNI</option>
                    <option value="RUC">RUC</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setIsModalOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isSaving} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {isSaving ? "Guardando..." : editingCustomer ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
