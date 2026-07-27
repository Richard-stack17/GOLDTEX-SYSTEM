'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, ArrowLeft, Printer, Plus, ChevronRight, Loader2, Info, CreditCard, Save, Store, Edit2, Power } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRole } from '../context/RoleContext';
import { useStore } from '../context/StoreContext';
import { AccessDeniedView } from '../components/AccessDeniedView';
import StoreSwitcher from '../components/StoreSwitcher';

export default function ConfiguracionPage() {
  const { role, isHydrated, permissions } = useRole();
  const { activeStoreId, activeStore, reloadStores } = useStore();
  const router = useRouter();

  // Permissions
  const canManageStores = Boolean(permissions?.settings_manage_stores);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'STORES' | 'PRINTERS' | 'FINANCE'>('PRINTERS');

  useEffect(() => {
    if (canManageStores && activeTab === 'PRINTERS' && isHydrated) {
      // Keep default or allow STORES if permitted
    }
    if (!canManageStores && activeTab === 'STORES') {
      setActiveTab('PRINTERS');
    }
  }, [canManageStores, activeTab, isHydrated]);

  // Printers state
  const [printers, setPrinters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Settings state per store
  const [storeSettingsMap, setStoreSettingsMap] = useState<Record<string, { izipay_debit_fee: string; izipay_credit_fee: string; isDefault: boolean }>>({});
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Stores state
  const [stores, setStores] = useState<any[]>([]);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [storeForm, setStoreForm] = useState({ name: '', address: '', phone: '' });
  const [isSavingStore, setIsSavingStore] = useState(false);

  // Store Deactivation states
  const [isCheckingStoreRefs, setIsCheckingStoreRefs] = useState(false);
  const [targetStoreToDeactivate, setTargetStoreToDeactivate] = useState<any>(null);
  const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false);
  const [linkedEmpCount, setLinkedEmpCount] = useState(0);
  const [linkedProfCount, setLinkedProfCount] = useState(0);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (activeTab === 'PRINTERS') {
      fetchPrinters();
    } else if (activeTab === 'FINANCE') {
      fetchSettings();
    } else if (activeTab === 'STORES') {
      fetchStores();
    }
  }, [activeTab, activeStoreId]);

  const fetchStores = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('stores').select('*').order('created_at', { ascending: true });
    if (data) setStores(data);
    setIsLoading(false);
  };

  const handleSaveStore = async () => {
    setIsSavingStore(true);
    try {
      if (editingStore) {
        const { error } = await supabase.from('stores').update({ name: storeForm.name, address: storeForm.address, phone: storeForm.phone }).eq('id', editingStore.id);
        if (error) throw error;
        showToast('Tienda actualizada', 'success');
      } else {
        const { error } = await supabase.from('stores').insert({ name: storeForm.name, address: storeForm.address, phone: storeForm.phone });
        if (error) throw error;
        showToast('Tienda creada', 'success');
      }
      setIsStoreModalOpen(false);
      fetchStores();
    } catch (e: any) {
      showToast(e.message || 'Error al guardar tienda', 'error');
    }
    setIsSavingStore(false);
  };

  const handleToggleStoreActive = async (store: any) => {
    if (store.is_active !== false) {
      setIsCheckingStoreRefs(true);
      setTargetStoreToDeactivate(store);
      try {
        const { count: empCount, error: empErr } = await supabase
          .from('employee_stores')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', store.id);

        if (empErr) throw empErr;

        const { count: profCount, error: profErr } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('default_store_id', store.id);

        if (profErr) throw profErr;

        setLinkedEmpCount(empCount || 0);
        setLinkedProfCount(profCount || 0);
        setIsConfirmDeactivateOpen(true);
      } catch (err: any) {
        showToast('Error al verificar referencias: ' + err.message, 'error');
      } finally {
        setIsCheckingStoreRefs(false);
      }
    } else {
      try {
        const { error } = await supabase
          .from('stores')
          .update({ is_active: true })
          .eq('id', store.id);
          
        if (error) throw error;
        showToast(`Tienda "${store.name}" reactivada con éxito.`, 'success');
        fetchStores();
        reloadStores();
      } catch (err: any) {
        showToast('Error al reactivar tienda: ' + err.message, 'error');
      }
    }
  };

  const confirmDeactivateStore = async () => {
    if (!targetStoreToDeactivate) return;
    setIsSavingStore(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ is_active: false })
        .eq('id', targetStoreToDeactivate.id);
        
      if (error) throw error;
      showToast(`Tienda "${targetStoreToDeactivate.name}" desactivada con éxito.`, 'success');
      setIsConfirmDeactivateOpen(false);
      setTargetStoreToDeactivate(null);
      fetchStores();
      reloadStores();
    } catch (err: any) {
      showToast('Error al desactivar tienda: ' + err.message, 'error');
    } finally {
      setIsSavingStore(false);
    }
  };

  const fetchPrinters = async () => {
    setIsLoading(true);

    let query = supabase.from('printers').select('*').order('created_at', { ascending: false });
    if (activeStoreId) query = query.eq('store_id', activeStoreId);
    const { data, error } = await query;
    
    if (!error && data) {
      setPrinters(data);
    } else if (error) {
      console.error("Error fetching printers:", error);
    }
    setIsLoading(false);
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    let storeList = stores;
    if (storeList.length === 0) {
      const { data: storesData } = await supabase.from('stores').select('*').order('created_at', { ascending: true });
      if (storesData) {
        storeList = storesData;
        setStores(storesData);
      }
    }

    let query = supabase.from('settings').select('*');
    if (activeStoreId) {
      query = query.eq('store_id', activeStoreId);
    }
    const { data: settingsData } = await query;

    const targetStores = activeStoreId
      ? storeList.filter(s => s.id === activeStoreId)
      : storeList;

    const newMap: Record<string, { izipay_debit_fee: string; izipay_credit_fee: string; isDefault: boolean }> = {};

    targetStores.forEach(st => {
      const storeSettings = (settingsData || []).filter(s => s.store_id === st.id);
      const debit = storeSettings.find(s => s.key === 'izipay_debit_fee')?.value;
      const credit = storeSettings.find(s => s.key === 'izipay_credit_fee')?.value;

      newMap[st.id] = {
        izipay_debit_fee: debit != null ? String(debit) : '4',
        izipay_credit_fee: credit != null ? String(credit) : '5',
        isDefault: storeSettings.length === 0
      };
    });

    setStoreSettingsMap(newMap);
    setIsLoading(false);
  };

  const handleSaveSettingsForStore = async (targetStoreId: string, storeName: string) => {
    const formData = storeSettingsMap[targetStoreId];
    if (!formData) return;

    setSavingStoreId(targetStoreId);

    const payload = [
      {
        key: 'izipay_debit_fee',
        value: parseFloat(formData.izipay_debit_fee) || 0,
        description: 'Porcentaje de recargo para débito (Izipay)',
        store_id: targetStoreId,
        updated_at: new Date().toISOString()
      },
      {
        key: 'izipay_credit_fee',
        value: parseFloat(formData.izipay_credit_fee) || 0,
        description: 'Porcentaje de recargo para crédito (Izipay)',
        store_id: targetStoreId,
        updated_at: new Date().toISOString()
      }
    ];

    const { error } = await supabase
      .from('settings')
      .upsert(payload, { onConflict: 'key,store_id' });

    if (error) {
      console.error(`Error guardando configuración para ${storeName}:`, error);
      showToast(`Error al guardar: ${error.message}`, 'error');
    } else {
      showToast(`Comisiones guardadas correctamente para ${storeName}`, 'success');
      fetchSettings();
    }
    setSavingStoreId(null);
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
            <div className="w-8 h-8 bg-slate-500 rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">Módulo de Configuración</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Ajustes globales del sistema</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StoreSwitcher />
          {activeTab === 'PRINTERS' && Boolean(permissions?.settings_printers_manage) && (
            <Link href="/configuracion/impresoras/nueva" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Nueva Impresora
            </Link>
          )}
          {activeTab === 'STORES' && canManageStores && (
            <button 
              onClick={() => { setEditingStore(null); setStoreForm({name: '', address: '', phone: ''}); setIsStoreModalOpen(true); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva Tienda
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 max-w-screen-xl w-full mx-auto">
        {/* Tabs */}
        <div className="flex space-x-1 bg-secondary/50 p-1 rounded-xl mb-6 w-max border border-border">
          {canManageStores && (
            <button
              onClick={() => setActiveTab('STORES')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeTab === 'STORES' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-500" /> Tiendas
              </div>
            </button>
          )}
          <button
            onClick={() => setActiveTab('PRINTERS')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === 'PRINTERS' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Impresoras
            </div>
          </button>
          {Boolean(permissions?.settings_finance) && (
            <button
              onClick={() => setActiveTab('FINANCE')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeTab === 'FINANCE' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-orange-500" /> Finanzas
              </div>
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'STORES' ? (
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center mt-20 text-blue-600">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium text-gray-500">Cargando tiendas...</p>
              </div>
            ) : stores.length === 0 ? (
              <div className="flex flex-col items-center justify-center mt-24 text-center px-6">
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                  <Store className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-800 mb-2">No se encontraron tiendas</h2>
                <p className="text-sm text-gray-500">Agrega una tienda para empezar a operar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stores.map(store => (
                  <div key={store.id} className={`bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group ${store.is_active === false ? 'opacity-60 bg-secondary/10' : ''}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                        <Store className="w-6 h-6 text-blue-600" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        store.is_active !== false 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                          : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500'
                      }`}>
                        {store.is_active !== false ? 'ACTIVA' : 'INACTIVA'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{store.name}</h3>
                    <div className="text-sm text-muted-foreground space-y-1 mt-3 font-semibold">
                      <p><span className="font-bold text-muted-foreground/80">Dirección:</span> {store.address || 'No especificada'}</p>
                      <p><span className="font-bold text-muted-foreground/80">Teléfono:</span> {store.phone || 'No especificado'}</p>
                    </div>
                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingStore(store); setStoreForm({name: store.name, address: store.address || '', phone: store.phone || ''}); setIsStoreModalOpen(true); }}
                        className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-border"
                        title="Editar tienda"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        disabled={isCheckingStoreRefs}
                        onClick={() => handleToggleStoreActive(store)}
                        className={`p-2 rounded-lg border border-border transition-colors ${
                          store.is_active !== false 
                            ? 'bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500'
                            : 'bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-500'
                        }`}
                        title={store.is_active !== false ? 'Desactivar tienda' : 'Reactivar tienda'}
                      >
                        {isCheckingStoreRefs && targetStoreToDeactivate?.id === store.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'PRINTERS' ? (
          <div className="space-y-6">
            {isLoading ? (
          <div className="flex flex-col items-center justify-center mt-20 text-emerald-600">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm font-medium text-gray-500">Cargando impresoras...</p>
          </div>
        ) : printers.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-24 text-center px-6">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <Printer className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">No se encontraron impresoras</h2>
            <p className="text-sm text-gray-500">Agrega una impresora térmica o de matriz para generar tickets.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {printers.map(printer => (
              <div 
                key={printer.id}
                onClick={() => router.push(`/configuracion/impresoras/editar?id=${printer.id}`)}
                className="flex items-center px-4 py-4 hover:bg-gray-50 cursor-pointer transition-colors active:bg-gray-100"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex flex-shrink-0 items-center justify-center mr-4 border border-gray-200">
                  <Printer className="w-6 h-6 text-gray-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-[17px] font-bold text-gray-900 truncate">{printer.name}</h3>
                  <div className="flex items-center mt-0.5 text-[14px] text-gray-500 space-x-1">
                    <span>{printer.type === 'wifi' ? 'WiFi' : printer.type === 'bluetooth' ? 'Bluetooth' : 'USB'}</span>
                    <span>•</span>
                    <span className="truncate">{printer.type === 'wifi' ? `${printer.ip_address}:${printer.port}` : printer.mac_address || 'Otro modelo'}</span>
                  </div>
                </div>

                <div className="flex items-center ml-2 space-x-3">
                  {(printer.auto_print || true) && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                      Recibos
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
        ) : (
          <div className="w-full">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center mt-20 text-emerald-600">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium text-gray-500">Cargando comisiones de tiendas...</p>
              </div>
            ) : (() => {
              const displayStores = activeStoreId
                ? stores.filter(s => s.id === activeStoreId)
                : stores;

              if (displayStores.length === 0) {
                return (
                  <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
                    No hay tiendas disponibles para configurar.
                  </div>
                );
              }

              return (
                <div className={`grid gap-6 ${displayStores.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'max-w-2xl'}`}>
                  {displayStores.map((st) => {
                    const stForm = storeSettingsMap[st.id] || { izipay_debit_fee: '4', izipay_credit_fee: '5', isDefault: true };
                    const isSavingThis = savingStoreId === st.id;

                    return (
                      <div key={st.id} className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-6 border-b border-border pb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                              <CreditCard className="w-5 h-5 text-orange-500" />
                              Recargos de Izipay
                            </h2>
                            <div className="flex items-center gap-2">
                              <span className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                                {st.name}
                              </span>
                              {stForm.isDefault && (
                                <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200">
                                  (Valores iniciales)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-muted-foreground">Tasa Débito (%)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={stForm.izipay_debit_fee}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStoreSettingsMap((prev: any) => ({
                                      ...prev,
                                      [st.id]: { ...(prev[st.id] || { izipay_debit_fee: '4', izipay_credit_fee: '5', isDefault: false }), izipay_debit_fee: val }
                                    }));
                                  }}
                                  className="w-full bg-background border border-border rounded-lg px-4 py-2 font-mono font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-muted-foreground">Tasa Crédito (%)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={stForm.izipay_credit_fee}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStoreSettingsMap((prev: any) => ({
                                      ...prev,
                                      [st.id]: { ...(prev[st.id] || { izipay_debit_fee: '4', izipay_credit_fee: '5', isDefault: false }), izipay_credit_fee: val }
                                    }));
                                  }}
                                  className="w-full bg-background border border-border rounded-lg px-4 py-2 font-mono font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-6 mt-6 border-t border-border flex justify-end">
                          <button
                            onClick={() => handleSaveSettingsForStore(st.id, st.name)}
                            disabled={isSavingThis}
                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                          >
                            {isSavingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar Cambios
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <div className="font-bold text-sm">{toast.message}</div>
        </div>
      )}
      {/* Store Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-border">
            <div className="px-6 py-4 border-b border-border bg-secondary/30 flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingStore ? 'Editar Tienda' : 'Nueva Tienda'}</h3>
              <button onClick={() => setIsStoreModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Nombre de la Tienda</label>
                <input 
                  autoFocus
                  type="text" 
                  value={storeForm.name}
                  onChange={e => setStoreForm({...storeForm, name: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="Ej. Tienda Central"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Dirección (Opcional)</label>
                <input 
                  type="text" 
                  value={storeForm.address}
                  onChange={e => setStoreForm({...storeForm, address: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="Ej. Av. Principal 123"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Teléfono (Opcional)</label>
                <input 
                  type="text" 
                  value={storeForm.phone}
                  onChange={e => setStoreForm({...storeForm, phone: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="Ej. 999 888 777"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setIsStoreModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-border font-bold text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveStore}
                  disabled={isSavingStore || !storeForm.name.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingStore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Warning Deactivate Modal */}
      {isConfirmDeactivateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-lg text-red-500 uppercase tracking-wider flex items-center gap-2">
              ⚠️ Desactivar Tienda
            </h3>
            <p className="text-sm text-foreground leading-relaxed">
              Estás a punto de desactivar la tienda <strong>{targetStoreToDeactivate?.name}</strong>.
            </p>
            <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 p-4 rounded-xl space-y-2 text-xs">
              <p className="font-bold">⚠️ Advertencias importantes:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Tiene <strong>{linkedEmpCount}</strong> empleados vinculados.</li>
                <li>Tiene <strong>{linkedProfCount}</strong> perfiles de usuario vinculados.</li>
                <li>Al desactivarla, estos usuarios <strong>perderán el acceso al sistema</strong> y no podrán operar hasta que sean reasignados.</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              ¿Estás seguro de que deseas continuar con la desactivación lógica de esta tienda?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                disabled={isSavingStore}
                onClick={() => { setIsConfirmDeactivateOpen(false); setTargetStoreToDeactivate(null); }}
                className="px-4 py-2 border border-border rounded-xl text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={isSavingStore}
                onClick={confirmDeactivateStore}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingStore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Sí, Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
