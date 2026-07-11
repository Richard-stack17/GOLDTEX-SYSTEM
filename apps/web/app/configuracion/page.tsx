'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Printer, Plus, ChevronRight, Loader2, Info } from 'lucide-react';
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
    <div className="max-w-2xl mx-auto min-h-screen bg-gray-50 flex flex-col">
      {/* Header Estilo App */}
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-4 py-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center">
          <Link href="/hub" className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors mr-2">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide text-gray-900">Impresoras</h1>
        </div>
        <Link href="/configuracion/impresoras/nueva" className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors">
          <Plus className="w-6 h-6" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
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
            <h2 className="text-lg font-bold text-gray-800 mb-2">No hay impresoras</h2>
            <p className="text-sm text-gray-500 mb-6">Agrega una impresora para comenzar a emitir recibos desde tu punto de venta.</p>
          </div>
        ) : (
          <div className="bg-white border-y border-gray-200 mt-4 divide-y divide-gray-100">
            {printers.map(printer => (
              <div 
                key={printer.id}
                onClick={() => router.push(`/configuracion/impresoras/${printer.id}`)}
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
    </div>
  );
}
