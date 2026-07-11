'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Trash2, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { requestBluetoothDevice, printTestReceipt } from '../utils/printerEngine';

// Helper de Toast (mismo estilo que Contabilidad)
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl font-bold text-sm animate-in fade-in slide-in-from-bottom-4 ${
      type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
        : 'bg-red-500/10 border-red-500/30 text-red-500'
    }`}>
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

export default function PrinterForm({ printerId }: { printerId?: string }) {
  const router = useRouter();
  const isEditing = !!printerId;

  const [name, setName] = useState('Caja');
  const [model, setModel] = useState('Otro modelo');
  const [type, setType] = useState('bluetooth');
  const [paperWidth, setPaperWidth] = useState(80);
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('192.168.1.100');
  const [port, setPort] = useState(9100);
  const [printReceipts, setPrintReceipts] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);

  // Hardware state
  const [btDeviceObj, setBtDeviceObj] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isEditing) {
      fetchPrinter();
    }
  }, [isEditing]);

  const fetchPrinter = async () => {
    const { data, error } = await supabase.from('printers').select('*').eq('id', printerId).single();
    if (data) {
      setName(data.name);
      setType(data.type);
      setPaperWidth(data.paper_width);
      setMacAddress(data.mac_address || '');
      setIpAddress(data.ip_address || '192.168.1.100');
      setPort(data.port || 9100);
      setAutoPrint(data.auto_print);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }

    setIsLoading(true);

    const payload: any = {
      name,
      type,
      paper_width: paperWidth,
      mac_address: type === 'bluetooth' ? macAddress : null,
      ip_address: type === 'wifi' ? ipAddress : null,
      port: type === 'wifi' ? port : null,
      auto_print: autoPrint
    };

    let error;
    if (isEditing) {
      const res = await supabase.from('printers').update(payload).eq('id', printerId);
      error = res.error;
    } else {
      const res = await supabase.from('printers').insert(payload);
      error = res.error;
    }

    setIsLoading(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(isEditing ? 'Impresora actualizada' : 'Impresora agregada', 'success');
      setTimeout(() => router.push('/configuracion'), 1000);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar esta impresora?')) return;
    setIsLoading(true);
    const { error } = await supabase.from('printers').delete().eq('id', printerId);
    setIsLoading(false);
    
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Impresora eliminada', 'success');
      setTimeout(() => router.push('/configuracion'), 1000);
    }
  };

  const handleBuscarBT = async () => {
    try {
      setIsSearching(true);
      const { name, device } = await requestBluetoothDevice();
      setMacAddress(name); // Guardamos el nombre comercial en el UI para que el usuario lo vea
      setBtDeviceObj(device);
      showToast(`Conectado a: ${name}`, 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleTestPrint = async () => {
    if (type !== 'bluetooth') {
      showToast('Por ahora la prueba solo está simulada para redes WiFi.', 'error');
      return;
    }

    if (!btDeviceObj) {
      showToast('Por favor, busca y empareja la impresora Bluetooth primero.', 'error');
      return;
    }

    try {
      showToast('Enviando página de prueba...', 'success');
      await printTestReceipt(btDeviceObj, paperWidth);
      showToast('¡Impresión enviada con éxito!', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-gray-50 flex flex-col relative pb-20">
      {/* Header Estilo App */}
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-4 py-3 shadow-sm sticky top-0 z-10">
        <div className="flex items-center">
          <button onClick={() => router.push('/configuracion')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors mr-2">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold tracking-wide text-gray-900">{isEditing ? 'Editar impresora' : 'Agregar impresora'}</h1>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isLoading}
          className="font-bold text-[15px] uppercase tracking-wider px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
        >
          Guardar
        </button>
      </div>

      <div className="flex-1 mt-6">
        {/* Bloque 1: Básicos */}
        <div className="bg-white border-y border-gray-200 divide-y divide-gray-100">
          <div className="px-4 py-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full text-[17px] font-medium text-gray-900 bg-transparent outline-none placeholder-gray-400 py-1"
              placeholder="Ej: Caja"
            />
          </div>
          <div className="px-4 py-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Modelo de la impresora</label>
            <select 
              value={model} 
              onChange={e => setModel(e.target.value)}
              className="w-full text-[17px] font-medium text-gray-900 bg-transparent outline-none py-1 appearance-none cursor-pointer"
            >
              <option value="Otro modelo">Otro modelo</option>
              <option value="Epson TM-T20">Epson TM-T20</option>
              <option value="Star Micronics">Star Micronics</option>
            </select>
          </div>
          <div className="px-4 py-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Interfaz</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value)}
              className="w-full text-[17px] font-medium text-gray-900 bg-transparent outline-none py-1 appearance-none cursor-pointer"
            >
              <option value="bluetooth">Bluetooth</option>
              <option value="wifi">WiFi</option>
              <option value="usb">USB</option>
            </select>
          </div>
        </div>

        {/* Lógica Condicional de Interfaz */}
        <div className="bg-white border-y border-gray-200 divide-y divide-gray-100 mt-6">
          {type === 'bluetooth' && (
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Impresora Bluetooth</label>
                <input 
                  type="text" 
                  readOnly
                  value={macAddress} 
                  className="w-full text-[17px] font-medium text-gray-400 bg-transparent outline-none py-1 cursor-not-allowed"
                  placeholder="No seleccionada"
                />
              </div>
              <button 
                onClick={handleBuscarBT}
                className="ml-4 px-4 py-2 bg-gray-100 text-gray-700 font-bold text-sm rounded-lg border border-gray-300 hover:bg-gray-200 active:bg-gray-300 transition-colors flex items-center shadow-sm"
              >
                <Search className="w-4 h-4 mr-2 text-gray-500" />
                BUSCAR
              </button>
            </div>
          )}
          
          {type === 'wifi' && (
            <>
              <div className="px-4 py-3">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Dirección IP</label>
                <input 
                  type="text" 
                  value={ipAddress} 
                  onChange={e => setIpAddress(e.target.value)}
                  className="w-full text-[17px] font-medium text-gray-900 bg-transparent outline-none py-1"
                  placeholder="192.168.1.100"
                />
              </div>
              <div className="px-4 py-3">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Puerto</label>
                <input 
                  type="number" 
                  value={port} 
                  onChange={e => setPort(Number(e.target.value))}
                  className="w-full text-[17px] font-medium text-gray-900 bg-transparent outline-none py-1"
                  placeholder="9100"
                />
              </div>
            </>
          )}

          <div className="px-4 py-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ancho de papel</label>
            <select 
              value={paperWidth} 
              onChange={e => setPaperWidth(Number(e.target.value))}
              className="w-full text-[17px] font-medium text-gray-900 bg-transparent outline-none py-1 appearance-none cursor-pointer"
            >
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="bg-white border-y border-gray-200 divide-y divide-gray-100 mt-6">
          <div className="px-4 py-4 flex items-center justify-between">
            <span className="text-[17px] font-medium text-gray-900">Imprimir recibos</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={printReceipts} onChange={e => setPrintReceipts(e.target.checked)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          {printReceipts && (
            <div className="px-4 py-4 flex items-center justify-between bg-gray-50/50">
              <span className="text-[17px] font-medium text-gray-900">Imprimir recibos automáticamente</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="mt-8 px-4 flex flex-col items-center space-y-4">
          <button 
            onClick={handleTestPrint}
            className="flex items-center justify-center w-full max-w-sm py-3.5 bg-white border-2 border-gray-200 text-gray-800 font-bold rounded-xl shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <Printer className="w-5 h-5 mr-2 text-gray-600" />
            IMPRESIÓN DE PRUEBA
          </button>

          {isEditing && (
            <button 
              onClick={handleDelete}
              disabled={isLoading}
              className="flex items-center justify-center w-full max-w-sm py-3.5 text-red-600 font-bold rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              ELIMINAR IMPRESORA
            </button>
          )}
        </div>
      </div>

      {/* Modal Básico Buscando BT */}
      {isSearching && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-8 max-w-xs w-full shadow-2xl flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">Buscando...</h3>
            <p className="text-sm text-gray-500 text-center">Asegúrate de que la impresora esté encendida y emparejada.</p>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
