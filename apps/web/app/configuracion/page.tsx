'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, ArrowLeft, Printer, Plus, ChevronRight, Loader2, Info, CreditCard, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRole } from '../context/RoleContext';

export default function ConfiguracionPage() {
  const { role, isHydrated } = useRole();
  const router = useRouter();

  // Tabs state
  const [activeTab, setActiveTab] = useState<'PRINTERS' | 'FINANCE'>('PRINTERS');

  // Printers state
  const [printers, setPrinters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Settings state
  const [settingsForm, setSettingsForm] = useState({ izipay_debit_fee: '4', izipay_credit_fee: '5' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isHydrated && role === 'VENDEDOR') {
      router.push('/pos');
    }
  }, [isHydrated, role, router]);

  useEffect(() => {
    if (activeTab === 'PRINTERS') {
      fetchPrinters();
    } else {
      fetchSettings();
    }
  }, [activeTab]);

  const fetchPrinters = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from('printers')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setPrinters(data);
    } else if (error) {
      console.error("Error fetching printers:", error);
    }
    setIsLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*');
    if (data) {
      const debit = data.find(s => s.key === 'izipay_debit_fee')?.value;
      const credit = data.find(s => s.key === 'izipay_credit_fee')?.value;
      setSettingsForm({
        izipay_debit_fee: debit ? String(debit) : '4',
        izipay_credit_fee: credit ? String(credit) : '5'
      });
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    const updates = [
      { key: 'izipay_debit_fee', value: parseFloat(settingsForm.izipay_debit_fee) || 0, description: 'Porcentaje de recargo para débito (Izipay)' },
      { key: 'izipay_credit_fee', value: parseFloat(settingsForm.izipay_credit_fee) || 0, description: 'Porcentaje de recargo para crédito (Izipay)' }
    ];

    let hasError = false;
    for (const update of updates) {
      const { error } = await supabase.from('settings').upsert({
        key: update.key,
        value: update.value,
        description: update.description,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      if (error) hasError = true;
    }

    if (!hasError) {
      setToast({ message: 'Configuración guardada correctamente', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } else {
      setToast({ message: 'Error al guardar configuración', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
    setIsSavingSettings(false);
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
        {activeTab === 'PRINTERS' && (
          <Link href="/configuracion/impresoras/nueva" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> Nueva Impresora
          </Link>
        )}
      </header>

      <main className="flex-1 flex flex-col p-6 max-w-screen-xl w-full mx-auto">
        {/* Tabs */}
        <div className="flex space-x-1 bg-secondary/50 p-1 rounded-xl mb-6 w-max border border-border">
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
          <button
            onClick={() => setActiveTab('FINANCE')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === 'FINANCE' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Pagos y Recargos
            </div>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'PRINTERS' ? (
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
          <div className="max-w-2xl">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-500" />
                Recargos de Izipay
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground">Tasa Débito (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={settingsForm.izipay_debit_fee}
                      onChange={(e) => setSettingsForm({ ...settingsForm, izipay_debit_fee: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 font-mono font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground">Tasa Crédito (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={settingsForm.izipay_credit_fee}
                      onChange={(e) => setSettingsForm({ ...settingsForm, izipay_credit_fee: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 font-mono font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>
                
                <div className="pt-6 border-t border-border flex justify-end">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
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
    </div>
  );
}
