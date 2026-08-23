'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Trash2, Search, CheckCircle2, AlertCircle, Loader2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../context/RoleContext';
import { useStore } from '../../context/StoreContext';
import { 
  requestBluetoothDevice, 
  requestUsbDevice, 
  printTestReceipt, 
  usbSerialAdapter, 
  printViaThermalHtml, 
  generateTicketLines, 
  buildEscPosBytes,
  DEFAULT_TEST_SALE_DATA
} from '../utils/printerEngine';
import ReceiptPreview from '../../components/ReceiptPreview';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useIsNativeAndroid } from '../../lib/platform';

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 ${
      type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
        : 'bg-rose-50 border-rose-200 text-rose-900'
    }`}>
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
      )}
      <span className={type === 'success' ? 'text-emerald-900' : 'text-rose-900'}>{message}</span>
    </div>
  );
}

export default function PrinterForm({ printerId }: { printerId?: string }) {
  const { permissions } = useRole();
  const router = useRouter();
  const isEditing = !!printerId;
  const isNativeAndroid = useIsNativeAndroid();

  const [name, setName] = useState('Caja');
  const [model, setModel] = useState('Otro modelo');
  const [type, setType] = useState('bluetooth');
  const [paperWidth, setPaperWidth] = useState(80);
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('192.168.1.100');
  const [port, setPort] = useState(9100);
  const [printReceipts, setPrintReceipts] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const [maxChars, setMaxChars] = useState<number | string>(48);
  const [isCustomChars, setIsCustomChars] = useState(false);
  const { activeStoreId } = useStore();

  // Store / Tenant assignment (required)
  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Hardware state
  const [btDeviceObj, setBtDeviceObj] = useState<any>(null);
  const [usbDeviceObj, setUsbDeviceObj] = useState<any>(null);
  const [usbName, setUsbName] = useState<string>('');
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
    const { data } = await supabase.from('printers').select('*').eq('id', printerId).single();
    if (data) {
      setName(data.name);
      setType(data.type);
      setPaperWidth(data.paper_width);
      setMacAddress(data.mac_address || '');
      setIpAddress(data.ip_address || '192.168.1.100');
      setPort(data.port || 9100);
      setAutoPrint(data.auto_print);
      setStoreId(data.store_id || null);
      setIsActive(data.is_active !== false);
      if (data.max_chars) {
        setMaxChars(data.max_chars);
        if (![32, 42, 48, 64].includes(data.max_chars)) {
          setIsCustomChars(true);
        }
      }
    }
  };

  useEffect(() => {
    const loadStores = async () => {
      const { data } = await supabase.from('stores').select('*').eq('is_active', true).order('created_at', { ascending: true });
      if (data) setStores(data);
    };
    loadStores();

    if (!isEditing && activeStoreId) {
      setStoreId(activeStoreId);
    }
  }, [activeStoreId, isEditing]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }

    if (!storeId) {
      showToast('La tienda es obligatoria', 'error');
      return;
    }

    setIsLoading(true);

    const safeNumericCols = Number(maxChars) || (paperWidth <= 58 ? 32 : 48);

    const payload: any = {
      name,
      type,
      paper_width: paperWidth,
      mac_address: (type === 'bluetooth' || type === 'usb') ? (macAddress || usbName) : null,
      ip_address: type === 'wifi' ? ipAddress : null,
      port: type === 'wifi' ? port : null,
      auto_print: autoPrint,
      max_chars: safeNumericCols,
      store_id: storeId
    };

    let error;
    if (isEditing) {
      const res = await supabase.from('printers').update(payload).eq('id', printerId);
      error = res.error;
    } else {
      payload.is_active = true;
      const res = await supabase.from('printers').insert(payload);
      error = res.error;
    }

    setIsLoading(false);

    if (error) {
      showToast(error.message, 'error');
    } else {
      setHasUnsavedChanges(false);
      showToast('Impresora guardada correctamente', 'success');
      setTimeout(() => router.push('/configuracion'), 800);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setIsLoading(true);
    const { error } = await supabase.from('printers').update({ is_active: false }).eq('id', printerId);
    setIsLoading(false);
    
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Impresora desactivada correctamente', 'success');
      setTimeout(() => router.push('/configuracion'), 1000);
    }
    setShowDeleteConfirm(false);
  };

  const confirmReactivate = async () => {
    if (!printerId) return;
    setIsLoading(true);
    const { error } = await supabase.from('printers').update({ is_active: true }).eq('id', printerId);
    setIsLoading(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Impresora reactivada', 'success');
      setIsActive(true);
      setTimeout(() => router.push('/configuracion'), 800);
    }
  };

  const handleBuscarBT = async () => {
    try {
      setIsSearching(true);
      const { name: btName, device } = await requestBluetoothDevice();
      setMacAddress(btName);
      setBtDeviceObj(device);
      setHasUnsavedChanges(true);
      showToast(`Conectado a: ${btName}`, 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleBuscarUSB = async () => {
    try {
      setIsSearching(true);
      const result = await requestUsbDevice();
      setUsbName(result.name);
      setUsbDeviceObj(result);
      setMacAddress(result.name);
      setHasUnsavedChanges(true);
      showToast(`Conectado a: ${result.name}`, 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleTestPrint = async () => {
    const currentCols = Number(maxChars) || (paperWidth <= 58 ? 32 : 48);

    if (type === 'bluetooth') {
      if (!btDeviceObj) {
        showToast('Por favor, busca y empareja la impresora Bluetooth con el botón BUSCAR primero.', 'error');
        return;
      }

      try {
        showToast('Conectando con la impresora Bluetooth...', 'success');
        await printTestReceipt(btDeviceObj, paperWidth, currentCols);
        showToast('¡Impresión Bluetooth enviada con éxito!', 'success');
      } catch (error: any) {
        showToast(error.message, 'error');
      }
      return;
    }

    if (type === 'usb') {
      if (!usbDeviceObj) {
        showToast('Por favor, selecciona la impresora USB con el botón BUSCAR primero.', 'error');
        return;
      }

      try {
        showToast('Enviando datos al puerto USB...', 'success');
        const lines = generateTicketLines(DEFAULT_TEST_SALE_DATA, currentCols);
        const uint8 = buildEscPosBytes(lines, currentCols);
        await usbSerialAdapter.printEscPos(usbDeviceObj, uint8);
        showToast('Datos enviados al puerto USB con éxito.', 'success');
      } catch (error: any) {
        showToast(error.message, 'error');
      }
      return;
    }

    if (type === 'wifi') {
      try {
        showToast('Abriendo ventana de impresión térmica...', 'success');
        const lines = generateTicketLines(DEFAULT_TEST_SALE_DATA, currentCols);
        printViaThermalHtml(lines, paperWidth);
      } catch (error: any) {
        showToast(error.message, 'error');
      }
      return;
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
    setMaxChars(48);
    setIsCustomChars(false);
    setBtDeviceObj(null);
    setUsbDeviceObj(null);
    setUsbName('');
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
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-foreground truncate">{isEditing ? 'Editar Impresora' : 'Agregar Impresora'}</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Configuración de dispositivo</p>
            </div>
          </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-colors shadow-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" /> GUARDAR
        </button>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner de Estado Inactivo */}
        {isEditing && !isActive && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-rose-900 dark:text-rose-200">Impresora Desactivada</p>
                <p className="text-xs text-rose-700 dark:text-rose-400">Esta impresora está oculta para el POS y Caja.</p>
              </div>
            </div>
            {Boolean(permissions?.settings_printers_manage) && (
              <button 
                onClick={confirmReactivate} 
                disabled={isLoading}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors shrink-0"
              >
                REACTIVAR
              </button>
            )}
          </div>
        )}

        {/* Formulario Principal */}
        <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Nombre de la impresora</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => { setName(e.target.value); setHasUnsavedChanges(true); }}
              className="w-full text-[15px] font-medium bg-transparent outline-none"
              placeholder="Ej. Caja Principal"
            />
          </div>

          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Modelo de la impresora</label>
            <select 
              value={model} 
              onChange={e => { setModel(e.target.value); setHasUnsavedChanges(true); }}
              className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer"
            >
              <option value="Otro modelo">Otro modelo (ESC/POS Genérico)</option>
              <option value="Epson TM-T20">Epson TM-T20</option>
              <option value="Xprinter XP-58">Xprinter XP-58 / XP-80</option>
              <option value="Star Micronics">Star Micronics</option>
            </select>
          </div>

          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo de Conexión</label>
            <select 
              value={type} 
              onChange={e => { setType(e.target.value); setHasUnsavedChanges(true); }}
              className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer"
            >
              <option value="bluetooth">Bluetooth (Inalámbrico)</option>
              <option value="usb">USB (Cable Directo)</option>
              <option value="wifi">WiFi / Red Local (LAN)</option>
            </select>
          </div>

          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Tienda / Sucursal *</label>
            <select 
              value={storeId || ''} 
              onChange={e => { setStoreId(e.target.value || null); setHasUnsavedChanges(true); }}
              className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer"
            >
              <option value="">-- Selecciona una tienda --</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lógica Condicional de Interfaz según Tipo */}
        <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
          {type === 'bluetooth' && (
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Dispositivo Bluetooth</label>
                <input 
                  type="text" 
                  readOnly
                  value={macAddress} 
                  className="w-full text-[15px] font-medium text-foreground bg-transparent outline-none truncate"
                  placeholder={isNativeAndroid ? 'Pulsa BUSCAR para escanear dispositivos Android' : 'No seleccionada (Haz clic en BUSCAR)'}
                />
              </div>
              {/* En Android nativo: usa AndroidBluetoothSerialAdapter (BT Classic SPP).
                  En Web: usa WebBluetoothAdapter (Web Bluetooth API / Chrome Desktop). */}
              <button 
                onClick={handleBuscarBT}
                disabled={isSearching}
                className={`px-4 py-2 font-bold text-sm rounded-lg border transition-colors flex items-center shadow-sm shrink-0 cursor-pointer ${
                  isNativeAndroid
                    ? 'bg-sky-500 hover:bg-sky-600 text-white border-sky-600 active:bg-sky-700'
                    : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 active:bg-secondary/60'
                }`}
              >
                <Search className="w-4 h-4 mr-2" />
                {isSearching ? 'BUSCANDO...' : 'BUSCAR'}
              </button>
            </div>
          )}

          {type === 'usb' && (
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Dispositivo USB (Cable Directo)</label>
                <input 
                  type="text" 
                  readOnly
                  value={usbName || macAddress} 
                  className="w-full text-[15px] font-medium text-foreground bg-transparent outline-none truncate"
                  placeholder="No seleccionada (Haz clic en BUSCAR)"
                />
              </div>
              <button 
                onClick={handleBuscarUSB}
                disabled={isSearching}
                className="px-4 py-2 bg-secondary text-secondary-foreground font-bold text-sm rounded-lg border border-border hover:bg-secondary/80 active:bg-secondary/60 transition-colors flex items-center shadow-sm shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4 mr-2" />
                {isSearching ? 'BUSCANDO...' : 'BUSCAR'}
              </button>
            </div>
          )}
          
          {type === 'wifi' && (
            <>
              <div className="px-5 py-4">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Dirección IP de la Impresora</label>
                <input 
                  type="text" 
                  value={ipAddress} 
                  onChange={e => { setIpAddress(e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full text-[15px] font-medium bg-transparent outline-none"
                  placeholder="192.168.1.100"
                />
              </div>
              <div className="px-5 py-4">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Puerto RAW ESC/POS</label>
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
              onChange={e => { 
                const newWidth = Number(e.target.value);
                setPaperWidth(newWidth);
                if (newWidth === 58) {
                  setMaxChars(32);
                } else if (newWidth === 80 && Number(maxChars) === 32) {
                  setMaxChars(48);
                }
                setHasUnsavedChanges(true); 
              }}
              className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer"
            >
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </select>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Caracteres por línea ({maxChars} columnas)
              </label>
              <button
                type="button"
                onClick={() => setIsCustomChars(!isCustomChars)}
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
              >
                {isCustomChars ? 'Ver lista estándar' : 'Escribir número manual'}
              </button>
            </div>

            {!isCustomChars ? (
              <select 
                value={[32, 42, 48, 64].includes(Number(maxChars)) ? Number(maxChars) : 'custom'} 
                onChange={e => { 
                  if (e.target.value === 'custom') {
                    setIsCustomChars(true);
                  } else {
                    setMaxChars(Number(e.target.value));
                    setHasUnsavedChanges(true); 
                  }
                }}
                className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value={32}>32 (58mm Portátil)</option>
                <option value={42}>42 (80mm Genérico)</option>
                <option value={48}>48 (80mm Font A Estándar)</option>
                <option value={64}>64 (80mm Font B Condensada)</option>
                <option value="custom">Personalizado...</option>
              </select>
            ) : (
              <div className="flex items-center gap-3">
                <input 
                  type="number"
                  min={20}
                  max={90}
                  value={maxChars}
                  onChange={e => {
                    const raw = e.target.value;
                    setMaxChars(raw);
                    setHasUnsavedChanges(true);
                  }}
                  onBlur={() => {
                    const num = Number(maxChars);
                    if (!maxChars || isNaN(num) || num < 20) {
                      setMaxChars(20);
                    } else if (num > 90) {
                      setMaxChars(90);
                    } else {
                      setMaxChars(Math.round(num));
                    }
                  }}
                  className="w-full text-[15px] font-bold bg-secondary/50 px-3 py-1.5 rounded-lg border border-border outline-none"
                  placeholder="Ej. 48"
                />
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">columnas</span>
              </div>
            )}
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
            maxChars={Number(maxChars) || 48}
            paperWidth={paperWidth}
            saleData={DEFAULT_TEST_SALE_DATA} 
          />
        </div>

        {/* Botones de Acción */}
        <div className="mt-8 flex flex-col items-center space-y-4">
          <button 
            onClick={handleTestPrint}
            className="flex items-center justify-center w-full max-w-sm py-3 bg-card border border-border font-bold text-sm rounded-xl shadow-sm hover:bg-muted active:bg-muted/80 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 mr-2" />
            IMPRESIÓN DE PRUEBA
          </button>
          
          <button 
            onClick={handleRestoreDefaults}
            className="flex items-center justify-center w-full max-w-sm py-3 text-muted-foreground font-bold text-sm rounded-xl hover:bg-muted active:bg-muted/80 transition-colors cursor-pointer"
          >
            RESTAURAR VALORES PREDETERMINADOS
          </button>

          {isEditing && Boolean(permissions?.settings_printers_delete) && (
            isActive ? (
              <button 
                onClick={handleDelete}
                className="flex items-center justify-center w-full max-w-sm py-3 text-rose-600 font-bold text-sm rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                DESACTIVAR IMPRESORA
              </button>
            ) : (
              <button 
                onClick={confirmReactivate}
                className="flex items-center justify-center w-full max-w-sm py-3 text-emerald-600 font-bold text-sm rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                ACTIVAR IMPRESORA
              </button>
            )
          )}
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} />}

      <ConfirmDialog
        isOpen={showExitConfirm}
        title="Cambios sin guardar"
        description="Tienes cambios pendientes. ¿Deseas salir sin guardar los cambios de la impresora?"
        confirmText="Salir sin guardar"
        cancelText="Permanecer aquí"
        isDestructive={false}
        onConfirm={() => router.push('/configuracion')}
        onCancel={() => setShowExitConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Desactivar Impresora"
        description="¿Estás seguro de que deseas desactivar esta impresora? Ya no estará disponible para impresión automática."
        confirmText="Desactivar"
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Restaurar Valores"
        description="¿Deseas restaurar todos los parámetros de la impresora a los valores predeterminados de fábrica?"
        confirmText="Restaurar"
        cancelText="Cancelar"
        isDestructive={false}
        onConfirm={confirmRestoreDefaults}
        onCancel={() => setShowRestoreConfirm(false)}
      />
    </div>
  );
}
