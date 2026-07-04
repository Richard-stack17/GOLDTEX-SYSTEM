"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Users, Search, Plus, Edit, Trash2, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Customer = {
  id: string;
  business_name: string;
  ruc: string;
  document_type: string;
  is_frequent: boolean;
  created_at?: string;
};

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    business_name: "",
    ruc: "",
    document_type: "DNI",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCustomers(data as Customer[]);
    }
    setLoading(false);
  };

  const filteredCustomers = customers.filter(c =>
    c.business_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.ruc && c.ruc.includes(search))
  );

  const handleOpenModal = (customer?: Customer) => {
    setError(null);
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        business_name: customer.business_name || "",
        ruc: customer.ruc || "",
        document_type: customer.document_type || (customer.ruc?.length === 11 ? "RUC" : "DNI"),
      });
    } else {
      setEditingCustomer(null);
      setFormData({ business_name: "", ruc: "", document_type: "DNI" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    const { business_name, ruc, document_type } = formData;

    if (business_name.trim().length < 3) {
      setError("La Razón Social debe tener al menos 3 caracteres.");
      return;
    }

    const cleanDoc = ruc.replace(/\D/g, "");
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
      ruc: cleanDoc,
      document_type,
      is_frequent: true,
    };

    try {
      if (editingCustomer) {
        const { error: updateErr } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomer.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from("customers")
          .insert([payload]);
        if (insertErr) throw insertErr;
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || "Error al guardar el cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este cliente?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (!error) {
      setCustomers(customers.filter(c => c.id !== id));
    } else {
      alert("Error al eliminar. Es posible que el cliente tenga ventas asociadas.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/hub" className="text-gray-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900 leading-none">Clientes Caseros</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Gestión de clientes frecuentes</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Nuevo Cliente
            </button>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
            <input
              type="text"
              placeholder="Buscar por DNI/RUC o Nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-gray-900 font-medium placeholder:text-gray-400"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="px-6 py-4 font-bold">Documento</th>
                  <th className="px-6 py-4 font-bold">Razón Social / Nombre</th>
                  <th className="px-6 py-4 font-bold text-center">Tipo</th>
                  <th className="px-6 py-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">Cargando clientes...</td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">No se encontraron clientes.</td>
                  </tr>
                ) : (
                  filteredCustomers.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-gray-600">{c.ruc || "---"}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{c.business_name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          c.document_type === 'RUC' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {c.document_type || "DNI"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleOpenModal(c)} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors ml-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

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
                    value={formData.ruc}
                    onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
                    placeholder="Ej. 12345678"
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
