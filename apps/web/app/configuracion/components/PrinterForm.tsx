'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Trash2, Search, CheckCircle2, AlertCircle, Loader2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { requestBluetoothDevice, printTestReceipt } from '../utils/printerEngine';
import ReceiptPreview from '../../components/ReceiptPreview';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

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
  const [maxChars, setMaxChars] = useState(42);

  // Hardware state
  const [btDeviceObj, setBtDeviceObj] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

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
      if (data.max_chars) setMaxChars(data.max_chars);
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
      auto_print: autoPrint,
      max_chars: maxChars
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
      setHasUnsavedChanges(false);
      showToast(isEditing ? 'Impresora actualizada' : 'Impresora agregada', 'success');
      setTimeout(() => router.push('/configuracion'), 1000);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setIsLoading(true);
    const { error } = await supabase.from('printers').delete().eq('id', printerId);
    setIsLoading(false);
    
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Impresora eliminada', 'success');
      setTimeout(() => router.push('/configuracion'), 1000);
    }
    setShowDeleteConfirm(false);
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

  const handleRestoreDefaults = () => {
    setShowRestoreConfirm(true);
  };

  const confirmRestoreDefaults = () => {
    setName('Caja');
    setModel('Otro modelo');
    setType('bluetooth');
    setPaperWidth(80);
    setMacAddress('');
    setIpAddress('192.168.1.100');
    setPort(9100);
    setPrintReceipts(true);
    setAutoPrint(false);
    setMaxChars(42);
    setBtDeviceObj(null);
    showToast('Valores predeterminados restaurados', 'success');
    setShowRestoreConfirm(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-card border-b border-border px-6 h-16 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => hasUnsavedChanges ? setShowExitConfirm(true) : router.push('/configuracion')} 
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-500 rounded-lg flex items-center justify-center">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">{isEditing ? 'Editar Impresora' : 'Agregar Impresora'}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Configuración de dispositivo</p>
            </div>
          </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> GUARDAR
        </button>
      </header>

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-6 pb-20">
        {/* Bloque 1: Básicos */}
        <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Nombre</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => { setName(e.target.value); setHasUnsavedChanges(true); }}
              className="w-full text-[15px] font-medium bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Ej: Caja"
            />
          </div>
          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Modelo de la impresora</label>
            <select 
              value={model} 
              onChange={e => { setModel(e.target.value); setHasUnsavedChanges(true); }}
              className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer"
            >
              <option value="Otro modelo">Otro modelo</option>
              <option value="Epson TM-T20">Epson TM-T20</option>
              <option value="Star Micronics">Star Micronics</option>
            </select>
          </div>
          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Interfaz</label>
            <select 
              value={type} 
              onChange={e => { setType(e.target.value); setHasUnsavedChanges(true); }}
              className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer"
            >
              <option value="bluetooth">Bluetooth</option>
              <option value="wifi">WiFi</option>
              <option value="usb">USB</option>
            </select>
          </div>
        </div>

        {/* Lógica Condicional de Interfaz */}
        <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
          {type === 'bluetooth' && (
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Impresora Bluetooth</label>
                <input 
                  type="text" 
                  readOnly
                  value={macAddress} 
                  className="w-full text-[15px] font-medium text-muted-foreground bg-transparent outline-none cursor-not-allowed"
                  placeholder="No seleccionada"
                />
              </div>
              <button 
                onClick={handleBuscarBT}
                className="ml-4 px-4 py-2 bg-secondary text-secondary-foreground font-bold text-sm rounded-lg border border-border hover:bg-secondary/80 active:bg-secondary/60 transition-colors flex items-center shadow-sm"
              >
                <Search className="w-4 h-4 mr-2" />
                BUSCAR
              </button>
            </div>
          )}
          
          {type === 'wifi' && (
            <>
              <div className="px-5 py-4">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Dirección IP</label>
                <input 
                  type="text" 
                  value={ipAddress} 
                  onChange={e => { setIpAddress(e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full text-[15px] font-medium bg-transparent outline-none"
                  placeholder="192.168.1.100"
                />
              </div>
              <div className="px-5 py-4">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Puerto</label>
                <input 
                  type="number" 
                  value={port} 
                  onChange={e => { setPort(Number(e.target.value)); setHasUnsavedChanges(true); }}
                  className="w-full text-[15px] font-medium bg-transparent outline-none"
                  placeholder="9100"
                />
              </div>
            </>
          )}

          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Ancho de papel</label>
            <select 
              value={paperWidth} 
              onChange={e => { setPaperWidth(Number(e.target.value)); setHasUnsavedChanges(true); }}
              className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer"
            >
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </select>
          </div>
          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Caracteres por línea</label>
            <select 
              value={maxChars} 
              onChange={e => { setMaxChars(Number(e.target.value)); setHasUnsavedChanges(true); }}
              className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer"
            >
              <option value={32}>32 (58mm)</option>
              <option value={42}>42 (80mm genérico)</option>
              <option value={48}>48 (80mm estándar)</option>
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <span className="text-[15px] font-medium">Imprimir recibos</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={printReceipts} onChange={e => { setPrintReceipts(e.target.checked); setHasUnsavedChanges(true); }} />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          {printReceipts && (
            <div className="px-5 py-4 flex items-center justify-between bg-muted/20">
              <span className="text-[15px] font-medium">Imprimir recibos automáticamente</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={autoPrint} onChange={e => { setAutoPrint(e.target.checked); setHasUnsavedChanges(true); }} />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          )}
        </div>

        {/* Vista Previa / Calibrador */}
        <div className="mt-4">
          <ReceiptPreview 
            maxChars={maxChars} 
            saleData={{
              document_number: 'T001-00001234',
              customer_name: 'Cliente Prueba',
              items: [
                { name: 'TELA ALGODON PREMIUM 100%', quantity: 2, price: 15.5 },
                { name: 'HILO POLYESTER X', quantity: 1, price: 5 },
                { name: 'AGUJAS INDUSTRIALES', quantity: 10, price: 0.5 }
              ],
              total: 41,
              comment: 'Prueba de calibración de ticket'
            }} 
          />
        </div>

        {/* Botones de Acción */}
        <div className="mt-8 flex flex-col items-center space-y-4">
          <button 
            onClick={handleTestPrint}
            className="flex items-center justify-center w-full max-w-sm py-3 bg-card border border-border font-bold text-sm rounded-xl shadow-sm hover:bg-muted active:bg-muted/80 transition-colors"
          >
            <Printer className="w-4 h-4 mr-2" />
            IMPRESIÓN DE PRUEBA
          </button>
          
          <button 
            onClick={handleRestoreDefaults}
            className="flex items-center justify-center w-full max-w-sm py-3 text-muted-foreground font-bold text-sm rounded-xl hover:bg-muted active:bg-muted/80 transition-colors"
          >
            RESTAURAR VALORES PREDETERMINADOS
          </button>

          {isEditing && (
            <button 
              onClick={handleDelete}
              disabled={isLoading}
              className="flex items-center justify-center w-full max-w-sm py-3 text-red-500 font-bold text-sm rounded-xl hover:bg-red-500/10 active:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              ELIMINAR IMPRESORA
            </button>
          )}
        </div>
      </main>

      {/* Modal Básico Buscando BT */}
      {isSearching && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl p-8 max-w-xs w-full shadow-2xl flex flex-col items-center border border-border">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
            <h3 className="text-lg font-bold mb-1">Buscando...</h3>
            <p className="text-sm text-muted-foreground text-center">Asegúrate de que la impresora esté encendida y emparejada.</p>
          </div>
        </div>
      )}

      {/* Modal Confirmación Salir */}
      <ConfirmDialog
        isOpen={showExitConfirm}
        onCancel={() => setShowExitConfirm(false)}
        onConfirm={() => router.push('/configuracion')}
        title="Cambios sin guardar"
        description="Tienes cambios que no han sido guardados. ¿Estás seguro de que quieres salir? Se perderán todas tus modificaciones."
        isLoading={false}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Eliminar Impresora"
        description="¿Estás seguro de eliminar esta impresora? Esta acción no se puede deshacer."
        isLoading={isLoading}
      />

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={confirmRestoreDefaults}
        title="Restaurar Valores"
        description="¿Deseas restaurar la configuración predeterminada? Se perderán los cambios no guardados."
        isLoading={false}
      />

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
