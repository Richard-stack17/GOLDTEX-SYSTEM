'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, ArrowLeft, Printer, Plus, ChevronRight, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ConfiguracionPage() {
  const [printers, setPrinters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchPrinters();
  }, []);

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
              <p className="text-xs text-muted-foreground mt-0.5">Dispositivos e Impresoras</p>
            </div>
          </div>
        </div>
        <Link href="/configuracion/impresoras/nueva" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90">
          <Plus className="w-3.5 h-3.5" /> Nueva Impresora
        </Link>
      </header>

      <main className="flex-1 p-6 max-w-screen-xl w-full mx-auto space-y-6">

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
      </main>
    </div>
  );
}
