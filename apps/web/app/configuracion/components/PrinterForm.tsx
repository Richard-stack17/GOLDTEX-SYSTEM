'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Trash2, Search, CheckCircle2, AlertCircle, Loader2, Save, ChevronDown, X, RefreshCw, Wifi } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../context/RoleContext';
import { useStore } from '../../context/StoreContext';
import {
  requestBluetoothDevice,
  requestUsbDevice,
  scanBluetoothPrinters,
  printTestReceipt,
  usbSerialAdapter,
  printViaThermalHtml,
  generateTicketLines,
  buildEscPosBytes,
  DEFAULT_TEST_SALE_DATA,
  androidWifiAdapter,
  setActiveDevicePrinter
} from '../utils/printerEngine';
import ReceiptPreview from '../../components/ReceiptPreview';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useIsNativeAndroid } from '../../lib/platform';

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 ${type === 'success'
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
  const [platform, setPlatform] = useState<'WEB' | 'MOBILE' | 'ALL'>('ALL');
  const [paperWidth, setPaperWidth] = useState(80);
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('192.168.1.100');
  const [port, setPort] = useState(9100);
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

  // Bluetooth Device Picker Modal State
  const [isBtModalOpen, setIsBtModalOpen] = useState(false);
  const [isBtScanning, setIsBtScanning] = useState(false);
  const [discoveredBtDevices, setDiscoveredBtDevices] = useState<Array<{ name: string; address: string; device: any }>>([]);
  const [btScanError, setBtScanError] = useState<string | null>(null);

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
      setPlatform(data.platform || 'ALL');
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
      if (data.type === 'usb' && typeof window !== 'undefined') {
        const nav = navigator as any;
        if (nav?.usb?.getDevices) {
          nav.usb.getDevices().then((devices: any[]) => {
            if (devices && devices.length > 0) {
              const matched = devices.find((d: any) => d.productName === data.mac_address) || devices[0];
              setUsbDeviceObj({ device: matched, name: matched.productName || data.mac_address || 'USB' });
              setUsbName(matched.productName || data.mac_address || 'USB');
            }
          }).catch(() => {});
        } else if (nav?.serial?.getPorts) {
          nav.serial.getPorts().then((ports: any[]) => {
            if (ports && ports.length > 0) {
              setUsbDeviceObj({ port: ports[0], name: data.mac_address || 'Puerto Serie USB' });
              setUsbName(data.mac_address || 'Puerto Serie USB');
            }
          }).catch(() => {});
        }
      }
      if (data.type === 'bluetooth' && typeof window !== 'undefined' && !isNativeAndroid) {
        const nav = navigator as any;
        if (nav?.bluetooth?.getDevices) {
          nav.bluetooth.getDevices().then((devices: any[]) => {
            if (devices && devices.length > 0) {
              const matched = devices.find((d: any) => d.id === data.mac_address || d.name === data.mac_address) || devices[0];
              if (matched) setBtDeviceObj(matched);
            }
          }).catch(() => {});
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
      platform,
      paper_width: paperWidth,
      mac_address: (type === 'bluetooth' || type === 'usb') ? (macAddress || usbName) : null,
      ip_address: type === 'wifi' ? ipAddress : null,
      port: type === 'wifi' ? port : null,
      auto_print: autoPrint,
      max_chars: safeNumericCols,
      store_id: storeId
    };

    let error;
    if (autoPrint && storeId) {
      // Desmarcar solo las de la misma tienda y la misma plataforma para no pisar otras plataformas
      let query = supabase.from('printers').update({ auto_print: false }).eq('store_id', storeId);
      if (platform !== 'ALL') {
        query = query.in('platform', [platform, 'ALL']);
      }
      if (isEditing && printerId) {
        query = query.neq('id', printerId);
      }
      await query;
    }

    let savedId = printerId;
    if (isEditing) {
      const res = await supabase.from('printers').update(payload).eq('id', printerId);
      error = res.error;
    } else {
      payload.is_active = true;
      const res = await supabase.from('printers').insert(payload).select('id').single();
      error = res.error;
      if (res.data?.id) savedId = res.data.id;
    }

    setIsLoading(false);

    if (error) {
      showToast(error.message, 'error');
    } else {
      setHasUnsavedChanges(false);
      try {
        const savedData = { ...payload, id: savedId || 'local', is_active: true };
        setActiveDevicePrinter(savedData, storeId);
      } catch (_) { }
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

  const runBtScan = async () => {
    setDiscoveredBtDevices([]); // Limpiar memoria previa antes de escanear
    setIsBtScanning(true);
    setBtScanError(null);
    try {
      const devices = await scanBluetoothPrinters();
      setDiscoveredBtDevices(devices);
      if (devices.length === 0) {
        setBtScanError('No se encontraron dispositivos Bluetooth encendidos cerca.');
      }
    } catch (err: any) {
      setBtScanError(err.message || 'Error al buscar dispositivos Bluetooth');
    } finally {
      setIsBtScanning(false);
    }
  };

  const handleBuscarBT = async () => {
    if (isNativeAndroid) {
      setDiscoveredBtDevices([]); // Limpiar caché al abrir modal
      setIsBtModalOpen(true);
      void runBtScan();
    } else {
      try {
        setIsSearching(true);
        const res = await requestBluetoothDevice();
        const btName = res.name;
        const btAddress = (res as any).address || (res.device as any)?.address || btName;
        setMacAddress(btAddress);
        setBtDeviceObj(res.device);
        setHasUnsavedChanges(true);
        showToast(`Conectado a: ${btName}`, 'success');
      } catch (error: any) {
        showToast(error.message, 'error');
      } finally {
        setIsSearching(false);
      }
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
      let activeBt = btDeviceObj;
      if (isNativeAndroid && macAddress) {
        activeBt = { address: macAddress, name: name || 'Impresora Bluetooth' };
      }

      if (!activeBt && typeof window !== 'undefined' && !isNativeAndroid) {
        const nav = navigator as any;
        if (nav?.bluetooth?.getDevices) {
          try {
            const devices = await nav.bluetooth.getDevices();
            if (devices && devices.length > 0) {
              const matched = devices.find((d: any) => d.id === macAddress || d.name === macAddress) || devices[0];
              if (matched) {
                activeBt = matched;
                setBtDeviceObj(matched);
              }
            }
          } catch (_) {}
        }
      }

      if (!activeBt) {
        showToast('Por favor, busca y empareja la impresora Bluetooth con el botón BUSCAR primero.', 'error');
        return;
      }

      try {
        showToast('Conectando con la impresora Bluetooth...', 'success');
        await printTestReceipt(activeBt, paperWidth, currentCols);
        showToast('¡Impresión Bluetooth enviada con éxito!', 'success');
      } catch (error: any) {
        showToast(error.message, 'error');
      }
      return;
    }

    if (type === 'usb') {
      let activeUsb = usbDeviceObj;

      // Auto-recuperar si el navegador ya otorgó permisos previos a este dominio
      if (!activeUsb && typeof window !== 'undefined') {
        const nav = navigator as any;
        if (nav?.usb?.getDevices) {
          try {
            const devices = await nav.usb.getDevices();
            if (devices && devices.length > 0) {
              const matched = devices.find((d: any) => d.productName === macAddress) || devices[0];
              activeUsb = { device: matched, name: matched.productName || macAddress || 'USB' };
              setUsbDeviceObj(activeUsb);
            }
          } catch (_) {}
        }
        if (!activeUsb && nav?.serial?.getPorts) {
          try {
            const ports = await nav.serial.getPorts();
            if (ports && ports.length > 0) {
              activeUsb = { port: ports[0], name: macAddress || 'Puerto Serie USB' };
              setUsbDeviceObj(activeUsb);
            }
          } catch (_) {}
        }
      }

      if (!activeUsb) {
        showToast('Para conectar por USB en el navegador, presiona el botón BUSCAR arriba.', 'error');
        return;
      }

      try {
        showToast('Enviando datos al puerto USB...', 'success');
        const lines = generateTicketLines(DEFAULT_TEST_SALE_DATA, currentCols);
        const uint8 = buildEscPosBytes(lines, currentCols);
        await usbSerialAdapter.printEscPos(activeUsb, uint8);
        showToast('Datos enviados al puerto USB con éxito.', 'success');
      } catch (error: any) {
        showToast(error.message, 'error');
      }
      return;
    }

    if (type === 'wifi') {
      try {
        if (isNativeAndroid) {
          if (!ipAddress || !port) {
            showToast('Por favor ingresa la IP y el Puerto de la impresora.', 'error');
            return;
          }
          showToast(`Conectando a la impresora en ${ipAddress}:${port}...`, 'success');
          // En Android nativo: enviamos bytes ESC/POS directo por TCP (RAW Socket)
          await androidWifiAdapter.printTestReceipt({ ipAddress, port }, paperWidth, currentCols);
          showToast('¡Impresión WiFi TCP enviada con éxito!', 'success');
        } else {
          // En Web: abrimos la ventana de impresión del SO que gestiona las impresoras de red instaladas
          showToast('Abriendo ventana de impresión térmica...', 'success');
          const lines = generateTicketLines(DEFAULT_TEST_SALE_DATA, currentCols);
          printViaThermalHtml(lines, paperWidth);
        }
      } catch (error: any) {
        showToast(error.message, 'error');
      }
      return;
    }
  };



  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => hasUnsavedChanges ? setShowExitConfirm(true) : router.push('/configuracion')}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-slate-500 rounded-lg flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">{isEditing ? 'Editar Impresora' : 'Agregar Impresora'}</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">Configuración de dispositivo</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold transition-all shadow-sm hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 cursor-pointer shrink-0"
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
            <div className="relative flex items-center">
              <select
                value={model}
                onChange={e => { setModel(e.target.value); setHasUnsavedChanges(true); }}
                className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer pr-7"
              >
                <option value="Otro modelo">Otro modelo (ESC/POS Genérico)</option>
                <option value="Epson TM-T20">Epson TM-T20</option>
                <option value="Xprinter XP-58">Xprinter XP-58 / XP-80</option>
                <option value="Star Micronics">Star Micronics</option>
              </select>
              <ChevronDown className="absolute right-0 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
            </div>
          </div>

          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo de Conexión</label>
            <div className="relative flex items-center">
              <select
                value={type}
                onChange={e => { setType(e.target.value); setHasUnsavedChanges(true); }}
                className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer pr-7"
              >
                <option value="bluetooth">Bluetooth (Inalámbrico)</option>
                {isNativeAndroid ? (
                  <option value="usb" disabled>USB (Solo disponible en PC / Laptop)</option>
                ) : (
                  <option value="usb">USB (Cable Directo)</option>
                )}
                {isNativeAndroid ? (
                  <option value="wifi">WiFi / Red Local (LAN)</option>
                ) : (
                  <option value="wifi" disabled>WiFi (Solo disponible en App Móvil Android)</option>
                )}
              </select>
              <ChevronDown className="absolute right-0 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
            </div>
          </div>

          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Tienda / Sucursal *</label>
            <div className="relative flex items-center">
              <select
                value={storeId || ''}
                onChange={e => { setStoreId(e.target.value || null); setHasUnsavedChanges(true); }}
                className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer pr-7"
              >
                <option value="">-- Selecciona una tienda --</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
            </div>
          </div>

          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Plataforma de Compatibilidad</label>
            <div className="relative flex items-center">
              <select
                value={platform}
                onChange={e => { setPlatform(e.target.value as any); setHasUnsavedChanges(true); }}
                className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer pr-7"
              >
                <option value="ALL">Universal (PC / Web y Teléfonos Móviles APK)</option>
                <option value="WEB">Exclusiva para PC / Web</option>
                <option value="MOBILE">Exclusiva para Teléfonos Móviles (APK Android)</option>
              </select>
              <ChevronDown className="absolute right-0 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground/70 mt-1.5">
              Determina si esta impresora servirá de respaldo por defecto para PC, para celulares o para ambos.
            </p>
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
                className={`px-4 py-2 font-bold text-sm rounded-lg border transition-colors flex items-center shadow-sm shrink-0 cursor-pointer ${isNativeAndroid
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
            <div className="px-5 py-4">
              {isNativeAndroid ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-amber-500 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> Conexión USB exclusiva para PC
                  </p>
                  <p className="text-muted-foreground">
                    Los teléfonos Android no admiten conexión USB directa. Para usar esta impresora desde el teléfono, cambia el tipo de conexión a <strong>Bluetooth</strong> o <strong>WiFi</strong>.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
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
            </div>
          )}

          {type === 'wifi' && (
            <>
              {isNativeAndroid ? (
                <>
                  <div className="px-5 py-4">
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Dirección IP de la Impresora</label>
                    <input
                      type="text"
                      value={ipAddress}
                      onChange={e => { setIpAddress(e.target.value); setHasUnsavedChanges(true); }}
                      className="w-full text-[15px] font-medium bg-transparent outline-none font-mono"
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div className="px-5 py-4">
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Puerto RAW ESC/POS</label>
                    <input
                      type="number"
                      value={port}
                      onChange={e => { setPort(Number(e.target.value)); setHasUnsavedChanges(true); }}
                      className="w-full text-[15px] font-medium bg-transparent outline-none font-mono"
                      placeholder="9100"
                    />
                  </div>
                  <div className="mx-5 mb-4 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs space-y-1.5">
                    <p className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 shrink-0" /> Requisito de Red WiFi / LAN
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      El teléfono y la impresora deben estar conectados a la <strong>misma red WiFi / Router</strong> del local.
                    </p>
                    <p className="text-muted-foreground/80 text-[11px]">
                      <strong>Nota:</strong> Si la impresora emite su propia red WiFi directa (modo punto de acceso) y te conectas directamente a ella, tu celular no tendrá salida a internet. Se recomienda conectar la impresora al router principal de la tienda.
                    </p>
                  </div>
                </>
              ) : (
                <div className="px-5 py-4">
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-1.5">
                    <p className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" /> Conexión WiFi exclusiva para App Móvil
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Los navegadores web en PC o Laptop no admiten conexión por sockets TCP directos a impresoras por restricciones de seguridad del navegador. Para imprimir desde la PC, utiliza conexión por <strong>Cable USB</strong> o <strong>Bluetooth</strong>.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="px-5 py-4">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Ancho de papel</label>
            <div className="relative flex items-center">
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
                className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer pr-7"
              >
                <option value={80}>80 mm</option>
                <option value={58}>58 mm</option>
              </select>
              <ChevronDown className="absolute right-0 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
            </div>
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
              <div className="relative flex items-center">
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
                  className="w-full text-[15px] font-medium bg-transparent outline-none appearance-none cursor-pointer pr-7"
                >
                  <option value={32}>32 (58mm Portátil)</option>
                  <option value={42}>42 (80mm Genérico)</option>
                  <option value={48}>48 (80mm Font A Estándar)</option>
                  <option value={64}>64 (80mm Font B Condensada)</option>
                  <option value="custom">Personalizado...</option>
                </select>
                <ChevronDown className="absolute right-0 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
              </div>
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

      {/* Modal Selector de Dispositivos Bluetooth (Capacitor / Android) */}
      {isBtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Impresoras Bluetooth</h2>
                  <p className="text-xs text-muted-foreground">Dispositivos detectados en el teléfono</p>
                </div>
              </div>
              <button
                onClick={() => setIsBtModalOpen(false)}
                className="w-9 h-9 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List / Content */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {isBtScanning ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-12 h-12 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">Buscando dispositivos Bluetooth...</p>
                    <p className="text-xs text-muted-foreground">Asegúrate de que la impresora esté encendida.</p>
                  </div>
                </div>
              ) : btScanError ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground">No se pudo completar la búsqueda</p>
                  <p className="text-xs text-muted-foreground max-w-xs">{btScanError}</p>
                </div>
              ) : discoveredBtDevices.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground">No se encontraron impresoras</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Verifica que la impresora esté encendida o vinculada en los ajustes de Bluetooth de tu teléfono.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                    Selecciona tu impresora ({discoveredBtDevices.length})
                  </p>
                  {discoveredBtDevices.map((dev, idx) => {
                    const isSelected = macAddress === dev.name || macAddress === dev.address;
                    return (
                      <button
                        key={dev.address || idx}
                        onClick={() => {
                          const chosenAddress = dev.address || dev.name;
                          setMacAddress(chosenAddress);
                          setBtDeviceObj(dev.device);
                          setHasUnsavedChanges(true);
                          setIsBtModalOpen(false);
                          showToast(`Impresora seleccionada: ${dev.name}`, 'success');
                        }}
                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${isSelected
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-foreground ring-2 ring-indigo-500/20'
                            : 'bg-secondary/30 border-border hover:bg-secondary/60 text-foreground'
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-500 text-white' : 'bg-secondary text-muted-foreground'
                            }`}>
                            <Printer className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate">{dev.name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground truncate">{dev.address || 'Bluetooth SPP'}</p>
                          </div>
                        </div>
                        {isSelected ? (
                          <span className="text-xs font-bold text-indigo-500 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 shrink-0">
                            Activo
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full shrink-0">
                            Seleccionar
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-secondary/10 flex items-center gap-2">
              <button
                onClick={runBtScan}
                disabled={isBtScanning}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBtScanning ? 'animate-spin' : ''}`} />
                {isBtScanning ? 'Escaneando...' : 'Volver a Buscar'}
              </button>
              <button
                onClick={() => setIsBtModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-border hover:bg-secondary text-muted-foreground text-xs font-bold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
