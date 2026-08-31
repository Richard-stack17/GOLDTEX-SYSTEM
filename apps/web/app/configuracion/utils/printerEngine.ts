// app/configuracion/utils/printerEngine.ts

import { supabase } from '../../lib/supabase';
import { isNativeAndroidApp } from '../../lib/platform';

export interface TicketLine {
  align?: 'center' | 'left' | 'right';
  text: string;
}

// ── Helpers de Almacenamiento Local (Modelo Híbrido: Dispositivo First + Plataforma Fallback) ──

export function getActivePrinterStorageKey(storeId?: string | null): string {
  return storeId ? `goltex_active_printer_${storeId}` : 'goltex_active_printer';
}

export function getActiveDevicePrinter(storeId?: string | null): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const isMobile = isNativeAndroidApp();
    const targetPlatform = isMobile ? 'MOBILE' : 'WEB';

    let cachedStr: string | null = null;
    let storageKeyUsed = 'goltex_active_printer';

    if (storeId) {
      storageKeyUsed = `goltex_active_printer_${storeId}`;
      cachedStr = localStorage.getItem(storageKeyUsed)
        || localStorage.getItem(`cached_printer_config_${storeId}`);
    }

    if (!cachedStr) {
      storageKeyUsed = 'goltex_active_printer';
      cachedStr = localStorage.getItem('goltex_active_printer')
        || localStorage.getItem('cached_printer_config');
    }

    if (cachedStr) {
      const printer = JSON.parse(cachedStr);
      // 1. Validar que pertenezca a la tienda solicitada si se especificó una
      if (storeId && printer.store_id && printer.store_id !== storeId) {
        return null;
      }
      // 2. Validar que la plataforma coincida con el entorno actual (no usar móvil en web ni web en móvil)
      if (printer.platform && printer.platform !== 'ALL' && printer.platform !== targetPlatform) {
        try {
          localStorage.removeItem(storageKeyUsed);
          if (storageKeyUsed !== 'goltex_active_printer') {
            localStorage.removeItem('goltex_active_printer');
          }
        } catch (_) { }
        return null;
      }
      // 3. Validar que no esté desactivada
      if (printer.is_active === false) {
        return null;
      }
      return printer;
    }
  } catch (_) { }
  return null;
}

export function setActiveDevicePrinter(printer: any, storeId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const dataStr = JSON.stringify(printer);
    const targetStoreId = storeId || printer?.store_id;
    const key = getActivePrinterStorageKey(targetStoreId);

    localStorage.setItem(key, dataStr);
    localStorage.setItem('goltex_active_printer', dataStr);

    // Legacy compatibility keys
    localStorage.setItem('cached_printer_config', dataStr);
    if (targetStoreId) {
      localStorage.setItem(`cached_printer_config_${targetStoreId}`, dataStr);
    }
  } catch (_) { }
}

export async function resolveActivePrinter(storeId?: string | null): Promise<any | null> {
  const isMobile = isNativeAndroidApp();
  const targetPlatform = isMobile ? 'MOBILE' : 'WEB';

  // 1. Local-First: Preferencia guardada en este dispositivo
  let activePrinter = getActiveDevicePrinter(storeId);
  if (activePrinter && activePrinter.is_active !== false) {
    if (!activePrinter.platform || activePrinter.platform === 'ALL' || activePrinter.platform === targetPlatform) {
      return activePrinter;
    }
  }

  // 2. Cloud Fallback: Si no hay en localStorage, consultar Supabase por plataforma
  try {
    let query = supabase
      .from('printers')
      .select('*')
      .eq('is_active', true);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    // Filtrar por plataforma (MOBILE o ALL si es Android, WEB o ALL si es Web)
    query = query.in('platform', [targetPlatform, 'ALL']);

    const { data: printers } = await query.order('auto_print', { ascending: false });

    if (printers && printers.length > 0) {
      activePrinter = printers.find((p: any) => p.auto_print) || printers[0];
      if (activePrinter) {
        setActiveDevicePrinter(activePrinter, storeId);
        return activePrinter;
      }
    }
  } catch (err) {
    console.error('Error resolving fallback printer from Supabase:', err);
  }

  return null;
}

export const DEFAULT_TEST_SALE_DATA = {
  proforma_number: 'T001-00001234',
  customer_name: 'Cliente Prueba',
  items: [
    { name: 'TELA ALGODON PREMIUM 100%', quantity: 2, price: 15.5 },
    { name: 'HILO POLYESTER X', quantity: 1, price: 5 },
    { name: 'CONFECCIÓN', quantity: 1, price: 8, is_service: true }
  ],
  total: 39,
  comment: 'Prueba de calibración de ticket'
};

// Convert string to ESC/POS safe byte array (CP437 / ISO-8859-1)
export function textToEscPosBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Replace Spanish special characters with standard CP437 bytes
    if (code === 209) bytes.push(0xA5); // Ñ
    else if (code === 241) bytes.push(0xA4); // ñ
    else if (code === 193) bytes.push(0x41); // Á -> A
    else if (code === 201) bytes.push(0x90); // É
    else if (code === 205) bytes.push(0x49); // Í -> I
    else if (code === 211) bytes.push(0x4F); // Ó -> O
    else if (code === 218) bytes.push(0x55); // Ú -> U
    else if (code === 225) bytes.push(0xA0); // á
    else if (code === 233) bytes.push(0x82); // é
    else if (code === 237) bytes.push(0xA1); // í
    else if (code === 243) bytes.push(0xA2); // ó
    else if (code === 250) bytes.push(0xA3); // ú
    else if (code < 128) bytes.push(code);
    else bytes.push(0x20); // Fallback to space
  }
  return bytes;
}

export function generateTicketLines(saleData: any, maxChars: number): TicketLine[] {
  const lines: TicketLine[] = [];

  const center = (text: string) => lines.push({ align: 'center', text });
  const left = (text: string) => lines.push({ align: 'left', text });

  const formatLR = (l: string, r: string) => {
    const spaces = maxChars - l.length - r.length;
    if (spaces > 0) return l + ' '.repeat(spaces) + r;
    const truncatedL = l.substring(0, Math.max(1, maxChars - r.length - 1));
    return truncatedL + ' ' + r;
  };

  const separator = '='.repeat(maxChars);
  const separatorThin = '-'.repeat(maxChars);

  // Margen superior mínimo para guillotina
  center('');

  // Layout Estricto
  center('PROFORMA');
  left(`Empleado: Propietario`);
  left(separator);

  const items = saleData.items || [];
  let sumaExacta = 0;

  for (const item of items) {
    let itemName = item.name || item.description || item.nombre_producto || 'Producto';

    // Simplificación Automática de Servicios
    const upperName = itemName.toUpperCase();
    if (upperName.includes('COSTO POR CONFECCIÓN') || upperName.includes('CONFECCION')) {
      itemName = 'CONFECCIÓN';
    } else if (upperName.includes('COSTO POR TAXI') || upperName.includes('TAXI')) {
      itemName = 'TAXI';
    }

    const code = item.code || item.codigo ? `${item.code || item.codigo} ` : '';
    const qty = item.quantity || item.cantidad || 1;

    const rawEditedPrice = item.editedPrice ?? item.precio_variable ?? item.precio_unitario ?? item.price ?? item.precio ?? 0;
    const rawPrice = item.price ?? item.precio_fijo ?? item.precio ?? 0;

    const precioVar = Number(rawEditedPrice).toFixed(2);
    const precioFijo = Number(rawPrice).toFixed(2);

    const itemTotal = item.total !== undefined ? item.total : qty * Number(precioVar);
    sumaExacta += Number(itemTotal);

    const isService = itemName === 'CONFECCIÓN' || itemName === 'TAXI';

    if (isService) {
      left(formatLR(itemName, `S/ ${Number(itemTotal).toFixed(2)}`));
    } else {
      const suffixL1 = ` x S/. ${precioFijo}`;
      const maxNameLen = maxChars - suffixL1.length - code.length;
      let safeName = itemName;
      if (safeName.length > maxNameLen && maxNameLen > 0) {
        safeName = safeName.substring(0, maxNameLen);
      }
      left(`${code}${safeName}${suffixL1}`);
      left(formatLR(`${qty} M x S/${precioVar}`, `S/ ${Number(itemTotal).toFixed(2)}`));
    }
    left('.'.repeat(maxChars));
  }

  left(separatorThin);
  const sumaRedondeada2Dec = Math.round(sumaExacta * 100) / 100;

  // Detección de recargo por Izipay/Tarjeta (solo aplica si la venta viene con transacciones o si fue cobrada con recargo)
  const txs = Array.isArray(saleData.transactions) ? saleData.transactions : [];
  const izipayTx = txs.find((t: any) => t.payment_method === 'IZIPAY');

  let surchargeAmt = 0;
  let surchargePct = 0;

  if (izipayTx) {
    if (izipayTx.surcharge_amount != null && Number(izipayTx.surcharge_amount) > 0) {
      surchargeAmt = Number(izipayTx.surcharge_amount);
      surchargePct = Number(izipayTx.surcharge_pct || 0);
    } else {
      const diff = Number(saleData.total || 0) - sumaRedondeada2Dec;
      if (diff > 0.04) {
        surchargeAmt = diff;
        surchargePct = Number(izipayTx.surcharge_pct || (Math.round((diff / (sumaRedondeada2Dec || 1)) * 1000) / 10));
      }
    }
  } else if (saleData.total && Number(saleData.total) > sumaRedondeada2Dec + 0.04) {
    surchargeAmt = Number(saleData.total) - sumaRedondeada2Dec;
  }

  let totalFinalStr: string;

  if (surchargeAmt > 0.01) {
    left(formatLR('Subtotal Items:', `S/ ${sumaRedondeada2Dec.toFixed(2)}`));
    const recargoLabel = surchargePct > 0
      ? `Recargo Izipay (${surchargePct % 1 === 0 ? surchargePct : surchargePct.toFixed(1)}%):`
      : 'Recargo Izipay / Tarj:';
    left(formatLR(recargoLabel, `+ S/ ${surchargeAmt.toFixed(2)}`));
    left(separatorThin);

    const finalTotalNum = (saleData.total != null && Number(saleData.total) > 0)
      ? Number(saleData.total)
      : (sumaRedondeada2Dec + surchargeAmt);
    totalFinalStr = finalTotalNum.toFixed(2);
  } else {
    const totalRedondeado = Math.round(sumaRedondeada2Dec * 10) / 10;
    totalFinalStr = totalRedondeado.toFixed(2);
  }

  // Total optimizado en Doble Ancho 2X (Ocupa la mitad de columnas para llenar el 100% de la bobina de borde a borde)
  const halfCols = Math.floor(maxChars / 2);
  const totalNumStr = `S/ ${totalFinalStr}`;
  const spaces2X = Math.max(1, halfCols - 'TOTAL'.length - totalNumStr.length);
  const total2XLine = `TOTAL${' '.repeat(spaces2X)}${totalNumStr}`;
  left(total2XLine);

  center('');

  const dateObj = new Date();
  const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
  const docNum = saleData.proforma_number || saleData.invoice_number || saleData.document_number || 'N/A';
  // Limpiamos el prefijo TKT- y cualquier formato de fecha YYYYMMDD- (ej. TKT-20260816-0001 -> 0001)
  const cleanDocNum = docNum.replace(/^TKT-/, '').replace(/^\d{8}-/, '');
  const isConsolidated = saleData.source_type === 'CONSOLIDATED' || (Array.isArray(saleData._consolidated_tickets) && saleData._consolidated_tickets.length > 0) || (Array.isArray(saleData.children) && saleData.children.length > 0);

  if (isConsolidated) {
    left(formatLR(dateStr, 'UNIFICADO'));
    const subTickets = Array.isArray(saleData._consolidated_tickets) && saleData._consolidated_tickets.length > 0
      ? saleData._consolidated_tickets
      : (Array.isArray(saleData.children) ? saleData.children : []);

    if (subTickets.length > 0) {
      const ticketNums = subTickets.map((t: any) => t.internal_ticket_number ? `#${t.internal_ticket_number}` : (t.proforma_number || '')).filter(Boolean);
      center(`TICKETS: ${ticketNums.join(' + ')}`);
    } else {
      center(`TKT-${cleanDocNum}`);
    }
  } else {
    left(formatLR(dateStr, `TKT-${cleanDocNum}`));
  }

  center('');
  center('NO ES BOLETA NI COMPROBANTE DE PAGO');

  return lines;
}

export function generateClosureTicketLines(cajaSummary: any, maxChars: number = 48): TicketLine[] {
  const lines: TicketLine[] = [];
  const separator = '='.repeat(maxChars);
  const separatorThin = '-'.repeat(maxChars);

  const center = (text: string) => lines.push({ align: 'center', text });
  const left = (text: string) => lines.push({ align: 'left', text });

  const formatLR = (leftText: string, rightText: string) => {
    const spaceCount = Math.max(1, maxChars - leftText.length - rightText.length);
    return leftText + ' '.repeat(spaceCount) + rightText;
  };

  center('ARQUEO DE CAJA');
  center(separator);

  const dateObj = new Date();
  const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  left(`FECHA: ${dateStr}`);
  left(separatorThin);

  left(formatLR('EFECTIVO', `S/ ${Number(cajaSummary?.efectivo || 0).toFixed(2)}`));
  left(formatLR('BCP', `S/ ${Number(cajaSummary?.bcp || 0).toFixed(2)}`));
  left(formatLR('BBVA', `S/ ${Number(cajaSummary?.bbva || 0).toFixed(2)}`));
  left(formatLR('IZIPAY', `S/ ${Number(cajaSummary?.izipay || 0).toFixed(2)}`));

  left(separatorThin);

  const totalStr = `S/ ${Number(cajaSummary?.total || 0).toFixed(2)}`;
  const halfCols = Math.floor(maxChars / 2);
  const spaces2X = Math.max(1, halfCols - 'TOTAL'.length - totalStr.length);
  const total2XLine = `TOTAL${' '.repeat(spaces2X)}${totalStr}`;
  left(total2XLine);

  center(separator);

  return lines;
}

export function buildEscPosBytes(lines: TicketLine[], maxChars: number = 48): Uint8Array {
  const escpos: number[] = [];

  // Reset / Init Printer
  escpos.push(0x1B, 0x40); // ESC @
  escpos.push(0x1B, 0x74, 0x00); // Code Page CP437

  for (const line of lines) {
    if (line.align === 'center') escpos.push(0x1B, 0x61, 0x01);
    else if (line.align === 'right') escpos.push(0x1B, 0x61, 0x02);
    else escpos.push(0x1B, 0x61, 0x00);

    const isProforma = line.text === 'PROFORMA';
    const isTotal = line.text.startsWith('TOTAL');

    if (isProforma) {
      escpos.push(0x1B, 0x45, 0x01); // Negrita
    }

    if (isTotal) {
      // Doble Alto + Doble Ancho (2X Grueso y Gigante)
      escpos.push(0x1D, 0x21, 0x11);
      escpos.push(0x1B, 0x45, 0x01);
    }

    const textBytes = textToEscPosBytes(line.text + '\n');
    escpos.push(...textBytes);

    if (isProforma) {
      escpos.push(0x1B, 0x45, 0x00);
    }

    if (isTotal) {
      escpos.push(0x1D, 0x21, 0x00); // Reset tamaño normal
      escpos.push(0x1B, 0x45, 0x00); // Reset negrita
    }
  }

  // Feed 1 line & Cut
  escpos.push(0x1B, 0x64, 0x01);
  escpos.push(0x1D, 0x56, 0x41, 0x00);

  return new Uint8Array(escpos);
}

export interface IPrinterAdapter {
  requestDevice(): Promise<any>;
  printTestReceipt(device: any, paperWidth: number, maxChars?: number): Promise<void>;
  printSaleReceipt(device: any, saleData: any, paperWidth: number, maxChars?: number): Promise<void>;
  silentPrintSaleReceipt(saleData: any, doubleCopy?: boolean): Promise<void>;
}

// ── BLUETOOTH ADAPTER (Web Bluetooth API con verificación ACK estricta) ──
export class WebBluetoothAdapter implements IPrinterAdapter {
  private knownServices = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000fee7-0000-1000-8000-00805f9b34fb',
    '0000ae00-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb',
    '00001101-0000-1000-8000-00805f9b34fb',
    '00001800-0000-1000-8000-00805f9b34fb',
    '00001801-0000-1000-8000-00805f9b34fb',
    '0000180a-0000-1000-8000-00805f9b34fb'
  ];

  async requestDevice() {
    const nav = typeof window !== 'undefined' ? (navigator as any) : null;
    if (!nav?.bluetooth) {
      throw new Error('Web Bluetooth API no está soportada en este navegador. Utiliza Google Chrome o Microsoft Edge.');
    }

    try {
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.knownServices
      });

      return {
        name: device.name || 'Impresora Bluetooth',
        device: device
      };
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        throw new Error('Selección Bluetooth cancelada.');
      }
      throw err;
    }
  }

  private async getWriteCharacteristic(device: any) {
    if (!device?.gatt) throw new Error('El dispositivo no soporta comunicación GATT.');

    let server = null;
    try {
      server = device.gatt.connected ? device.gatt : await device.gatt.connect();
    } catch (err: any) {
      try { device.gatt.disconnect(); } catch (_) { }
      await new Promise(r => setTimeout(r, 400));
      server = await device.gatt.connect();
    }

    const services = await server.getPrimaryServices();

    // Lista de servicios genéricos a ignorar (no pertenecen al cabezal térmico)
    const ignoredServices = [
      '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
      '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
      '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
      '0000180f-0000-1000-8000-00805f9b34fb'  // Battery Service
    ];

    let writeChar = null;

    // 1. Prioridad: Buscar en servicios propietarios de impresión térmica
    for (const service of services) {
      const sUuid = service.uuid.toLowerCase();
      if (ignoredServices.includes(sUuid)) continue;

      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.writeWithoutResponse || char.properties.write) {
            writeChar = char;
            break;
          }
        }
      } catch (_) { }
      if (writeChar) break;
    }

    // 2. Fallback si no encontró en los prioritarios
    if (!writeChar) {
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.writeWithoutResponse || char.properties.write) {
              writeChar = char;
              break;
            }
          }
        } catch (_) { }
        if (writeChar) break;
      }
    }

    if (!writeChar) {
      throw new Error('No se encontró una característica de impresión válida en la impresora.');
    }

    return { server, writeChar };
  }

  private async sendBytes(writeChar: any, uint8: Uint8Array, server?: any) {
    const CHUNK_SIZE = 20; // Estándar universal BLE MTU seguro para evitar overflow en el microcontrolador
    for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
      if (server && !server.connected) {
        throw new Error('La impresora Bluetooth se desconectó durante la transmisión. Acérquese a la impresora y verifique que esté encendida.');
      }
      const chunk = uint8.slice(i, i + CHUNK_SIZE);
      try {
        if (writeChar.properties.writeWithoutResponse) {
          if (typeof writeChar.writeValueWithoutResponse === 'function') {
            await writeChar.writeValueWithoutResponse(chunk);
          } else {
            await writeChar.writeValue(chunk);
          }
        } else if (writeChar.properties.write) {
          if (typeof writeChar.writeValueWithResponse === 'function') {
            await writeChar.writeValueWithResponse(chunk);
          } else {
            await writeChar.writeValue(chunk);
          }
        } else {
          await writeChar.writeValue(chunk);
        }
      } catch (err: any) {
        throw new Error(`Error al enviar datos al cabezal térmico (${err?.message || 'Fallo de transmisión'}).`);
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  async printTestReceipt(device: any, paperWidth: number, maxChars: number = 48) {
    let targetDevice = device;
    if (!targetDevice?.gatt) {
      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
      if (nav?.bluetooth) {
        if (typeof nav.bluetooth.getDevices === 'function') {
          try {
            const devices = await nav.bluetooth.getDevices();
            if (devices && devices.length > 0) {
              targetDevice = devices.find((d: any) => d.name === device?.name) || devices[0];
            }
          } catch (_) { }
        }
        if (!targetDevice?.gatt) {
          targetDevice = await nav.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: this.knownServices
          });
        }
      }
    }

    if (!targetDevice?.gatt) throw new Error('El dispositivo no soporta comunicación GATT o no fue seleccionado.');

    const lines = generateTicketLines(DEFAULT_TEST_SALE_DATA, maxChars);
    const uint8 = buildEscPosBytes(lines, maxChars);

    const { server, writeChar } = await this.getWriteCharacteristic(targetDevice);

    try {
      await this.sendBytes(writeChar, uint8, server);
      await new Promise(resolve => setTimeout(resolve, 1200));
    } finally {
      if (server?.connected) {
        try { server.disconnect(); } catch (_) { }
      }
    }
  }

  async printSaleReceipt(device: any, saleData: any, paperWidth: number, maxChars: number = 48) {
    const lines = generateTicketLines(saleData, maxChars);
    const uint8 = buildEscPosBytes(lines, maxChars);

    const { server, writeChar } = await this.getWriteCharacteristic(device);

    try {
      await this.sendBytes(writeChar, uint8, server);
      await new Promise(resolve => setTimeout(resolve, 1200));
    } finally {
      if (server?.connected) {
        try { server.disconnect(); } catch (_) { }
      }
    }
  }

  async silentPrintSaleReceipt(saleData: any, doubleCopy: boolean = false, printerConfig?: any) {
    let activePrinter: any = printerConfig || await resolveActivePrinter();

    if (!activePrinter) {
      throw new Error("NO_PRINTER_CONFIGURED");
    }

    const nav = typeof window !== 'undefined' ? (navigator as any) : null;
    if (!nav?.bluetooth) {
      throw new Error("PRINTER_CONNECTION_ERROR");
    }

    let deviceToPrint: any = null;
    try {
      if (typeof nav.bluetooth.getDevices === 'function') {
        const devices = await nav.bluetooth.getDevices();
        if (devices && devices.length > 0) {
          deviceToPrint = devices.find((d: any) => d.name === activePrinter.name) || devices[0];
        }
      }
    } catch (_) { }

    if (!deviceToPrint) {
      try {
        deviceToPrint = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: this.knownServices
        });
      } catch (reqErr: any) {
        console.warn("Web Bluetooth no autorizado en esta sesión, aplicando impresión térmica del sistema:", reqErr);
        const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
        const lines = generateTicketLines(saleData, maxCharsConfig);
        printViaThermalHtml(lines, activePrinter.paper_width || 80);
        throw new Error(`PRINTER_NOT_AUTHORIZED_IN_BROWSER:${activePrinter.name || 'Impresora'}`);
      }
    }

    if (!deviceToPrint) {
      const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
      const lines = generateTicketLines(saleData, maxCharsConfig);
      printViaThermalHtml(lines, activePrinter.paper_width || 80);
      throw new Error(`PRINTER_NOT_AUTHORIZED_IN_BROWSER:${activePrinter.name || 'Impresora'}`);
    }

    const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);

    try {
      await this.printSaleReceipt(deviceToPrint, saleData, activePrinter.paper_width || 80, maxCharsConfig);

      if (doubleCopy) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.printSaleReceipt(deviceToPrint, saleData, activePrinter.paper_width || 80, maxCharsConfig);
      }
    } catch (printErr: any) {
      console.warn("Fallo durante transmisión Bluetooth, recurriendo a impresión térmica del sistema:", printErr);
      const lines = generateTicketLines(saleData, maxCharsConfig);
      printViaThermalHtml(lines, activePrinter.paper_width || 80);
      throw new Error(`PRINTER_COMMUNICATION_ERROR:${activePrinter.name || 'Impresora'}`);
    }
  }
}

// ── ANDROID BLUETOOTH CLASSIC (SPP) ADAPTER — @e-is/capacitor-bluetooth-serial ──
// Utilizado exclusivamente en la APK de Android (Capacitor nativo).
// Usa la API nativa de Android para escanear, conectar y enviar bytes por SPP.
export class AndroidBluetoothSerialAdapter implements IPrinterAdapter {

  async requestDevice(): Promise<{ name: string; device: any }> {
    // Import dinámico para evitar que el bundle web rompa si el plugin no existe
    const { BluetoothSerial } = await import('@e-is/capacitor-bluetooth-serial');

    // 1. Solicitar permisos en tiempo de ejecución (Android 12+ / API 31+)
    try {
      if (typeof (BluetoothSerial as any).requestPermissions === 'function') {
        await (BluetoothSerial as any).requestPermissions();
      }
    } catch (_) { }

    // 2. Escanear dispositivos Bluetooth Classic cercanos / emparejados
    let scanRes: any = null;
    try {
      scanRes = await BluetoothSerial.scan();
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.toLowerCase().includes('disabled')) {
        throw new Error('El Bluetooth de tu teléfono está apagado. Actívalo en los ajustes o panel superior de tu dispositivo.');
      }
      if (errMsg.toLowerCase().includes('permission')) {
        throw new Error('Se requieren permisos de Bluetooth. Concede los permisos a la aplicación para buscar impresoras.');
      }
      throw new Error(`Error al buscar dispositivos Bluetooth: ${errMsg}`);
    }

    const devices = scanRes?.devices;
    if (!devices || devices.length === 0) {
      throw new Error('No se encontraron dispositivos Bluetooth. Asegúrate de que la impresora esté encendida y visible.');
    }

    // Preferir dispositivos con nombre de impresora o el primero encontrado
    const first = devices.find((d: any) => d.name && (
      d.name.toLowerCase().includes('printer') ||
      d.name.toLowerCase().includes('pos') ||
      d.name.toLowerCase().includes('bt') ||
      d.name.toLowerCase().includes('tp') ||
      d.name.toLowerCase().includes('rp')
    )) || devices[0]!;

    return {
      name: first.name || first.address || 'Impresora BT',
      device: first
    };
  }

  private async resolveValidMacAddress(addressOrName: string): Promise<string> {
    if (!addressOrName) {
      throw new Error('Dispositivo Bluetooth sin dirección MAC.');
    }
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (macRegex.test(addressOrName)) {
      return addressOrName;
    }

    // Comprobar memoria local para conectar de inmediato sin escanear el aire
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('goltex_bt_mac_' + addressOrName);
      if (cached && macRegex.test(cached)) {
        return cached;
      }
    }

    // Si addressOrName es un nombre de dispositivo (ej. "POS-58" o "MTP-II")
    // buscamos entre los dispositivos escaneados / vinculados para obtener la MAC real
    try {
      const { BluetoothSerial } = await import('@e-is/capacitor-bluetooth-serial');
      const scanRes = await BluetoothSerial.scan();
      const devices = scanRes?.devices || [];
      const match = devices.find((d: any) =>
        (d.name && d.name.toLowerCase() === addressOrName.toLowerCase()) ||
        (d.address && d.address.toLowerCase() === addressOrName.toLowerCase())
      );
      if (match?.address && macRegex.test(match.address)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('goltex_bt_mac_' + addressOrName, match.address);
        }
        return match.address;
      }
      if (devices.length > 0 && devices[0]?.address && macRegex.test(devices[0].address)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('goltex_bt_mac_' + addressOrName, devices[0].address);
        }
        return devices[0].address;
      }
    } catch (_) { }

    throw new Error(`La dirección Bluetooth "${addressOrName}" no es válida. Vuelve a seleccionar la impresora en Configuración.`);
  }

  private async writeBytes(addressOrName: string, uint8: Uint8Array): Promise<void> {
    const { BluetoothSerial } = await import('@e-is/capacitor-bluetooth-serial');
    const address = await this.resolveValidMacAddress(addressOrName);

    // Intentos de conexión con auto-reintento si la impresora está ocupada por otro vendedor
    const maxRetries = 3;
    let connected = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 1. Limpieza preventiva
        try { await BluetoothSerial.disconnect({ address }); } catch (_) { }

        // 2. Conexión rápida Insecure / Secure
        try {
          await BluetoothSerial.connectInsecure({ address });
        } catch (_) {
          await BluetoothSerial.connect({ address });
        }

        connected = true;
        break; // Conexión exitosa, salir del bucle de reintento
      } catch (err: any) {
        const errMsg = (err?.message || String(err)).toLowerCase();

        // Si el Bluetooth está apagado o faltan permisos, abortar de inmediato
        if (errMsg.includes('disabled') || errMsg.includes('permission') || errMsg.includes('inválid') || errMsg.includes('not valid')) {
          throw err;
        }

        // Si falló por canal ocupado o socket bloqueado, esperar a que el otro vendedor libere el canal
        if (attempt < maxRetries) {
          const waitMs = attempt === 1 ? 800 : 1200;
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
    }

    if (!connected) {
      throw new Error(`Error al conectar con la impresora Bluetooth (${address}). Verifique que esté encendida o intente nuevamente.`);
    }

    // Escritura de bytes garantizada y única (sin riesgo de duplicación)
    try {
      await new Promise(r => setTimeout(r, 60));
      const value = Array.from(uint8).map(b => String.fromCharCode(b)).join('');
      await BluetoothSerial.write({ address, value });
      await new Promise(r => setTimeout(r, 400));
    } finally {
      try { await BluetoothSerial.disconnect({ address }); } catch (_) { }
    }
  }

  async printTestReceipt(device: any, paperWidth: number, maxChars: number = 48): Promise<void> {
    const lines = generateTicketLines(DEFAULT_TEST_SALE_DATA, maxChars);
    const uint8 = buildEscPosBytes(lines, maxChars);
    const address = device?.address || device?.mac_address || device?.macAddress || device?.name;
    if (!address) throw new Error('Dispositivo Bluetooth sin dirección MAC. Vuelve a buscar la impresora.');
    await this.writeBytes(address, uint8);
  }

  async printSaleReceipt(device: any, saleData: any, paperWidth: number, maxChars: number = 48): Promise<void> {
    const lines = generateTicketLines(saleData, maxChars);
    const uint8 = buildEscPosBytes(lines, maxChars);
    const address = device?.address || device?.mac_address || device?.macAddress || device?.name;
    if (!address) throw new Error('Dispositivo Bluetooth sin dirección MAC.');
    await this.writeBytes(address, uint8);
  }

  async writeRawBytes(addressOrName: string, uint8: Uint8Array): Promise<void> {
    await this.writeBytes(addressOrName, uint8);
  }

  async silentPrintSaleReceipt(saleData: any, doubleCopy: boolean = false, printerConfig?: any): Promise<void> {
    const { BluetoothSerial } = await import('@e-is/capacitor-bluetooth-serial');

    let activePrinter: any = printerConfig;
    if (!activePrinter) {
      activePrinter = await resolveActivePrinter();
    }

    if (!activePrinter) throw new Error('NO_PRINTER_CONFIGURED');

    const addressOrName = activePrinter.mac_address;
    if (!addressOrName) throw new Error('PRINTER_CONNECTION_ERROR');

    const address = await this.resolveValidMacAddress(addressOrName);
    const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
    const lines = generateTicketLines(saleData, maxCharsConfig);
    const uint8 = buildEscPosBytes(lines, maxCharsConfig);

    // Intentos de conexión con auto-reintento si la impresora está ocupada por otro vendedor
    const maxRetries = 3;
    let connected = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 1. Limpieza preventiva
        try { await BluetoothSerial.disconnect({ address }); } catch (_) { }

        // 2. Conexión rápida Insecure / Secure
        try {
          await BluetoothSerial.connectInsecure({ address });
        } catch (_) {
          await BluetoothSerial.connect({ address });
        }

        connected = true;
        break; // Conexión exitosa, salir del bucle de reintento
      } catch (err: any) {
        const errMsg = (err?.message || String(err)).toLowerCase();

        // Si el Bluetooth está apagado o faltan permisos, abortar de inmediato
        if (errMsg.includes('disabled') || errMsg.includes('permission') || errMsg.includes('inválid') || errMsg.includes('not valid')) {
          throw err;
        }

        // Si la impresora está ocupada por otro teléfono, esperar a que termine y libere el canal
        if (attempt < maxRetries) {
          const waitMs = attempt === 1 ? 800 : 1200;
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
    }

    if (!connected) {
      throw new Error(`Error al conectar con la impresora Bluetooth (${address}). Verifique que esté encendida o intente nuevamente.`);
    }

    // Escritura de bytes atómica y única para esta proforma
    try {
      await new Promise(r => setTimeout(r, 60));
      const value = Array.from(uint8).map(b => String.fromCharCode(b)).join('');
      await BluetoothSerial.write({ address, value });

      if (doubleCopy) {
        await new Promise(r => setTimeout(r, 350));
        await BluetoothSerial.write({ address, value });
      }

      await new Promise(r => setTimeout(r, 400));
    } finally {
      try { await BluetoothSerial.disconnect({ address }); } catch (_) { }
    }
  }
}

// ── ANDROID WIFI TCP ADAPTER — @spryrocks/capacitor-socket-connection-plugin ──
export class AndroidWifiTcpAdapter implements IPrinterAdapter {
  async requestDevice(): Promise<any> {
    // En WiFi no hay popup de escaneo, se configuran IP y Puerto manualmente
    return { name: 'Impresora TCP (Configurada)' };
  }

  private async writeBytes(ip: string, port: number, uint8: Uint8Array): Promise<void> {
    const { Socket } = await import('@spryrocks/capacitor-socket-connection-plugin');
    const socket = new Socket();
    
    // Auto-reintento si el socket TCP está ocupado por otra transmisión
    const maxRetries = 3;
    let connected = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await socket.open(ip, port);
        connected = true;
        break;
      } catch (err: any) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 800));
        }
      }
    }

    if (!connected) {
      throw new Error(`No se pudo conectar a la impresora de red (${ip}:${port}). Verifique su conexión.`);
    }

    try {
      await socket.write(uint8);
      await new Promise(r => setTimeout(r, 1200));
    } finally {
      try { await socket.close(); } catch (_) { }
    }
  }

  async printTestReceipt(device: any, paperWidth: number, maxChars: number = 48): Promise<void> {
    const ip = device?.ipAddress;
    const port = device?.port || 9100;
    if (!ip) throw new Error('No se ha configurado la dirección IP de la impresora.');
    const lines = generateTicketLines(DEFAULT_TEST_SALE_DATA, maxChars);
    const uint8 = buildEscPosBytes(lines, maxChars);
    await this.writeBytes(ip, port, uint8);
  }

  async printSaleReceipt(device: any, saleData: any, paperWidth: number, maxChars: number = 48): Promise<void> {
    const ip = device?.ipAddress;
    const port = device?.port || 9100;
    if (!ip) throw new Error('Dirección IP no válida.');
    const lines = generateTicketLines(saleData, maxChars);
    const uint8 = buildEscPosBytes(lines, maxChars);
    await this.writeBytes(ip, port, uint8);
  }

  async silentPrintSaleReceipt(saleData: any, doubleCopy: boolean = false, printerConfig?: any): Promise<void> {
    let activePrinter: any = printerConfig;
    if (!activePrinter) {
      try {
        const { data: printers } = await supabase.from('printers').select('*').eq('is_active', true).order('auto_print', { ascending: false });
        if (printers && printers.length > 0) {
          activePrinter = printers.find((p: any) => p.auto_print) || printers[0];
        }
      } catch (_) { }

      if (!activePrinter) {
        try {
          const cached = localStorage.getItem('cached_printer_config');
          if (cached) activePrinter = JSON.parse(cached);
        } catch (_) { }
      }
    }

    if (!activePrinter) throw new Error('NO_PRINTER_CONFIGURED');
    if (!activePrinter.ip_address && !activePrinter.ipAddress) throw new Error('PRINTER_CONNECTION_ERROR');

    const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
    const lines = generateTicketLines(saleData, maxCharsConfig);
    const uint8 = buildEscPosBytes(lines, maxCharsConfig);

    await this.writeBytes(activePrinter.ip_address, activePrinter.port || 9100, uint8);

    if (doubleCopy) {
      await new Promise(r => setTimeout(r, 1500));
      await this.writeBytes(activePrinter.ip_address, activePrinter.port || 9100, uint8);
    }
  }
}

// ── USB / CABLE ADAPTER (Web Serial & WebUSB API) ──
export class WebUsbSerialAdapter {
  async requestDevice(options?: { filters?: any[] }) {
    const nav = typeof window !== 'undefined' ? (navigator as any) : null;
    let usbError: any = null;

    // 1. Intentar primero con WebUSB (La mayoría de impresoras térmicas modernas son Raw USB)
    if (nav?.usb) {
      try {
        const filters = options?.filters || [];
        const device = await nav.usb.requestDevice({ filters });
        return {
          name: device.productName || 'Impresora USB (Directa)',
          device
        };
      } catch (err: any) {
        if (err.name === 'NotFoundError') {
          throw new Error('Selección USB cancelada por el usuario.');
        }
        usbError = err; // Guardamos otros errores (ej. SecurityError) por si falla también serial
      }
    }

    // 2. Si falló WebUSB por otra razón o no está soportado, intentar con Web Serial (Emulación COM/TTY)
    if (nav?.serial) {
      try {
        const port = await nav.serial.requestPort();
        return {
          name: 'Impresora USB (Puerto Serie)',
          port
        };
      } catch (err: any) {
        if (err.name === 'NotFoundError') {
          throw new Error('Selección USB cancelada por el usuario.');
        }
        throw err;
      }
    }

    if (usbError) throw new Error('Selección USB falló o fue cancelada.');
    throw new Error('Tu navegador no soporta Web Serial ni Web USB. Utiliza Google Chrome o Microsoft Edge.');
  }

  async printEscPos(usbObj: any, uint8: Uint8Array) {
    if (usbObj?.port) {
      const port = usbObj.port;
      const baudRate = usbObj.baudRate || 9600;
      if (!port.readable && !port.writable) {
        await port.open({ baudRate });
      }
      const writer = port.writable.getWriter();
      await writer.write(uint8);
      writer.releaseLock();
      await new Promise(r => setTimeout(r, 300));
      try {
        await port.close();
      } catch (_) { }
      return;
    }

    if (usbObj?.device) {
      const device = usbObj.device;
      await device.open();

      if (device.configuration === null) {
        try {
          await device.selectConfiguration(1);
        } catch (_) { }
      }

      // Búsqueda dinámica de la interfaz y endpoint OUT (Crucial para Windows y distintas marcas de ticketeras)
      let targetInterfaceNumber = 0;
      let targetEndpointNumber = 1;
      let found = false;

      if (device.configuration?.interfaces) {
        for (const iface of device.configuration.interfaces) {
          for (const alt of iface.alternates || []) {
            const ep = alt.endpoints?.find((e: any) => e.direction === 'out');
            if (ep) {
              targetInterfaceNumber = iface.interfaceNumber;
              targetEndpointNumber = ep.endpointNumber;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      try {
        await device.claimInterface(targetInterfaceNumber);
      } catch (claimErr: any) {
        if (claimErr.name === 'SecurityError' || claimErr.message?.includes('Access denied')) {
          throw new Error('Windows tiene bloqueado el puerto USB por el driver instalado. En Windows, usa el puerto serie COM o el modo de impresión del sistema.');
        }
        throw claimErr;
      }

      await device.transferOut(targetEndpointNumber, uint8);
      await new Promise(r => setTimeout(r, 300));
      try {
        await device.releaseInterface(targetInterfaceNumber);
      } catch (_) { }
      try {
        await device.close();
      } catch (_) { }
      return;
    }

    throw new Error('Objeto de impresora USB no válido.');
  }
}

// ── HTML / SYSTEM PRINT ADAPTER (Universal WiFi / Driver / Network Fallback) ──
export function printViaThermalHtml(lines: TicketLine[], paperWidth: number = 80) {
  const widthMm = paperWidth <= 58 ? 58 : 80;
  const is58 = widthMm === 58;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket</title>
        <style>
          @page {
            size: ${widthMm}mm auto;
            margin: 0;
          }
          body {
            font-family: monospace;
            font-size: ${is58 ? '10px' : '11px'};
            line-height: 1.25;
            width: ${widthMm}mm;
            padding: 4mm;
            margin: 0;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .left { text-align: left; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .total {
            font-size: ${is58 ? '14px' : '16px'};
            font-weight: 900;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 3px 0;
            margin: 4px 0;
            display: flex;
            justify-content: space-between;
          }
          .sep {
            border-bottom: 1px solid #000;
            margin: 3px 0;
          }
          .dotted {
            border-bottom: 1px dotted #888;
            margin: 2px 0;
          }
        </style>
      </head>
      <body>
        ${lines.map(line => {
    if (line.text === 'PROFORMA') return `<div class="center bold" style="font-size: 13px; letter-spacing: 2px;">PROFORMA</div>`;
    if (line.text.startsWith('TOTAL')) {
      const parts = line.text.split('S/');
      const label = parts[0]?.trim() || 'TOTAL';
      const amount = parts[1] ? `S/ ${parts[1].trim()}` : '';
      return `<div class="total"><span>${label}</span><span>${amount}</span></div>`;
    }
    if (line.text.startsWith('===') || line.text.startsWith('---')) return `<div class="sep"></div>`;
    const alignClass = line.align === 'center' ? 'center' : line.align === 'right' ? 'right' : 'left';
    return `<div class="${alignClass}" style="white-space: pre;">${line.text}</div>`;
  }).join('')}
      </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (_) { }
      }, 2000);
    }
  }, 350);
}

// ── EXPORTED HELPERS — Lógica dual: Android nativo vs Web ────────────────────
// Si la app corre en Android nativo (Capacitor APK) → usa AndroidBluetoothSerialAdapter (SPP Classic)
// Si corre en el navegador (PC, Mac, Chrome Móvil) → usa WebBluetoothAdapter (Web Bluetooth API)
export const webBluetoothAdapter = new WebBluetoothAdapter();
export const androidBluetoothAdapter = new AndroidBluetoothSerialAdapter();
export const androidWifiAdapter = new AndroidWifiTcpAdapter();
export const usbSerialAdapter = new WebUsbSerialAdapter();

function getBluetoothAdapter(): IPrinterAdapter {
  return isNativeAndroidApp() ? androidBluetoothAdapter : webBluetoothAdapter;
}

export const requestBluetoothDevice = () => getBluetoothAdapter().requestDevice();
export const requestUsbDevice = () => usbSerialAdapter.requestDevice();
export const scanBluetoothPrinters = async (): Promise<Array<{ name: string; address: string; device: any }>> => {
  if (isNativeAndroidApp()) {
    const { BluetoothSerial } = await import('@e-is/capacitor-bluetooth-serial');

    // 1. Comprobar si Bluetooth está encendido y solicitar encendido si está apagado
    try {
      const { enabled } = await BluetoothSerial.isEnabled();
      if (!enabled) {
        try {
          await BluetoothSerial.enable();
        } catch (_) { }
      }
    } catch (_) { }

    let scanDevices: any[] = [];
    try {
      const scanRes = await BluetoothSerial.scan();
      scanDevices = scanRes?.devices || [];
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || '';
      if (errMsg.toLowerCase().includes('disabled')) {
        throw new Error('El Bluetooth de tu teléfono está apagado. Actívalo en los ajustes o panel superior de tu celular y presiona Volver a Buscar.');
      }
      if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('denied')) {
        throw new Error('Se requieren permisos de Bluetooth. Concede los permisos solicitados por Android para buscar impresoras.');
      }
      throw new Error('Asegúrate de tener el Bluetooth encendido y la impresora vinculada o encendida.');
    }

    // Filtrar estrictamente solo dispositivos con MAC address física válida (elimina entradas huérfanas o sin antena)
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    const allDevices: any[] = [];
    const seenAddresses = new Set<string>();
    for (const d of scanDevices) {
      const addr = d.address || d.id;
      if (addr && macRegex.test(addr) && !seenAddresses.has(addr)) {
        seenAddresses.add(addr);
        allDevices.push(d);
      }
    }

    return allDevices.map((d: any) => ({
      name: d.name || d.address || 'Impresora Bluetooth',
      address: d.address || d.id || '',
      device: d,
    }));
  } else {
    const res = await requestBluetoothDevice();
    return [{
      name: res.name,
      address: (res.device as any)?.id || res.name,
      device: res.device,
    }];
  }
};
export const printTestReceipt = (device: any, paperWidth: number, maxChars: number = 48) => getBluetoothAdapter().printTestReceipt(device, paperWidth, maxChars);
export const printSaleReceipt = (device: any, saleData: any, paperWidth: number, maxChars: number = 48) => getBluetoothAdapter().printSaleReceipt(device, saleData, paperWidth, maxChars);

export const silentPrintSaleReceipt = async (saleData: any, doubleCopy: boolean = false, storeIdOrPrinterConfig?: string | any): Promise<void> => {
  let activePrinter: any = null;
  if (typeof storeIdOrPrinterConfig === 'object' && storeIdOrPrinterConfig !== null) {
    activePrinter = storeIdOrPrinterConfig;
  } else {
    activePrinter = await resolveActivePrinter(storeIdOrPrinterConfig);
  }
  if (!activePrinter) throw new Error('NO_PRINTER_CONFIGURED');

  const type = activePrinter.type || activePrinter.connection_type || 'bluetooth';

  if (type === 'wifi') {
    if (isNativeAndroidApp()) {
      return androidWifiAdapter.silentPrintSaleReceipt(saleData, doubleCopy, activePrinter);
    } else {
      const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
      const lines = generateTicketLines(saleData, maxCharsConfig);
      printViaThermalHtml(lines, activePrinter.paper_width || 80);
      return;
    }
  }

  if (type === 'usb') {
    if (isNativeAndroidApp()) {
      throw new Error('La impresora seleccionada está conectada por cable USB a la PC. Para imprimir desde este teléfono, utiliza una impresora Bluetooth o WiFi.');
    }

    const nav = typeof window !== 'undefined' ? (navigator as any) : null;
    let deviceToPrint = null;

    if (nav?.usb && typeof nav.usb.getDevices === 'function') {
      try {
        const devices = await nav.usb.getDevices();
        if (devices && devices.length > 0) {
          const matched = devices.find((d: any) =>
            (activePrinter.mac_address && d.productName === activePrinter.mac_address) ||
            (activePrinter.name && d.productName === activePrinter.name)
          ) || devices.find((d: any) => {
            const pName = (d.productName || '').toLowerCase();
            return !pName.includes('mouse') && !pName.includes('keyboard');
          }) || devices[0];

          if (matched) deviceToPrint = { device: matched };
        }
      } catch (_) { }
    }

    if (!deviceToPrint && nav?.serial && typeof nav.serial.getPorts === 'function') {
      try {
        const ports = await nav.serial.getPorts();
        if (ports && ports.length > 0) {
          deviceToPrint = { port: ports[0] };
        }
      } catch (_) { }
    }

    if (!deviceToPrint) {
      throw new Error('No se encontraron impresoras USB con permisos. Ve a Configuración y vuelve a darle al botón BUSCAR en tu impresora USB.');
    }

    const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
    const lines = generateTicketLines(saleData, maxCharsConfig);
    const uint8 = buildEscPosBytes(lines, maxCharsConfig);

    try {
      await usbSerialAdapter.printEscPos(deviceToPrint, uint8);

      if (doubleCopy) {
        await new Promise(r => setTimeout(r, 1500));
        await usbSerialAdapter.printEscPos(deviceToPrint, uint8);
      }
      return;
    } catch (usbErr: any) {
      console.warn('Fallo impresión USB directa, recurriendo a impresión térmica del sistema:', usbErr);
      printViaThermalHtml(lines, activePrinter.paper_width || 80);
      return;
    }
  }

  // Por defecto (bluetooth o fallback general)
  if (isNativeAndroidApp()) {
    return androidBluetoothAdapter.silentPrintSaleReceipt(saleData, doubleCopy, activePrinter);
  }
  return webBluetoothAdapter.silentPrintSaleReceipt(saleData, doubleCopy, activePrinter);
};

export const silentPrintClosureReport = async (cajaSummary: any, storeId?: string): Promise<void> => {
  const activePrinter = await resolveActivePrinter(storeId);
  if (!activePrinter) throw new Error('NO_PRINTER_CONFIGURED');

  const type = activePrinter.type || activePrinter.connection_type || 'bluetooth';

  if (type === 'wifi') {
    if (isNativeAndroidApp()) {
      // Reutiliza la misma lógica del adaptador wifi pero pasamos los bytes manuales
      const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
      const lines = generateClosureTicketLines(cajaSummary, maxCharsConfig);
      const uint8 = buildEscPosBytes(lines, maxCharsConfig);
      await (androidWifiAdapter as any).writeBytes(activePrinter.ip_address, activePrinter.port || 9100, uint8);
      return;
    } else {
      const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
      const lines = generateClosureTicketLines(cajaSummary, maxCharsConfig);
      printViaThermalHtml(lines, activePrinter.paper_width || 80);
      return;
    }
  }

  if (type === 'usb') {
    if (isNativeAndroidApp()) {
      throw new Error('La impresora seleccionada está conectada por cable USB a la PC. Para imprimir desde este teléfono, utiliza una impresora Bluetooth o WiFi.');
    }

    const nav = typeof window !== 'undefined' ? (navigator as any) : null;
    let deviceToPrint = null;
    if (nav?.usb && typeof nav.usb.getDevices === 'function') {
      try {
        const devices = await nav.usb.getDevices();
        if (devices && devices.length > 0) deviceToPrint = { device: devices.find((d: any) => d.productName === activePrinter.mac_address) || devices[0] };
      } catch (_) { }
    }
    if (!deviceToPrint && nav?.serial && typeof nav.serial.getPorts === 'function') {
      try {
        const ports = await nav.serial.getPorts();
        if (ports && ports.length > 0) deviceToPrint = { port: ports[0] };
      } catch (_) { }
    }
    if (!deviceToPrint) throw new Error('No se encontraron impresoras USB con permisos. Ve a Configuración y vuelve a darle al botón BUSCAR en tu impresora USB.');

    const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
    const lines = generateClosureTicketLines(cajaSummary, maxCharsConfig);
    const uint8 = buildEscPosBytes(lines, maxCharsConfig);
    await usbSerialAdapter.printEscPos(deviceToPrint, uint8);
    return;
  }

  // Bluetooth fallback para reporte
  const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
  const lines = generateClosureTicketLines(cajaSummary, maxCharsConfig);
  const uint8 = buildEscPosBytes(lines, maxCharsConfig);

  if (isNativeAndroidApp()) {
    const address = activePrinter.mac_address || activePrinter.address || activePrinter.name;
    if (!address) throw new Error('Dispositivo Bluetooth sin dirección MAC.');
    return androidBluetoothAdapter.writeRawBytes(address, uint8);
  } else {
    // Web Bluetooth API
    const nav = typeof window !== 'undefined' ? (navigator as any) : null;
    if (!nav?.bluetooth) throw new Error("PRINTER_CONNECTION_ERROR");
    let deviceToPrint: any = null;
    try {
      if (typeof nav.bluetooth.getDevices === 'function') {
        const devices = await nav.bluetooth.getDevices();
        if (devices && devices.length > 0) deviceToPrint = devices.find((d: any) => d.name === activePrinter.name) || devices[0];
      }
    } catch (_) { }
    if (!deviceToPrint) {
      deviceToPrint = await nav.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: (webBluetoothAdapter as any).knownServices });
    }
    if (!deviceToPrint) throw new Error("PRINTER_CONNECTION_ERROR");

    if (!deviceToPrint.gatt.connected) await deviceToPrint.gatt.connect();
    let writeChar = null;
    for (const serviceUuid of (webBluetoothAdapter as any).knownServices) {
      try {
        const service = await deviceToPrint.gatt.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        writeChar = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
        if (writeChar) break;
      } catch (_) { }
    }
    if (!writeChar) throw new Error("No se pudo obtener la interfaz de escritura.");

    const CHUNK_SIZE = 200;
    for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
      await writeChar.writeValue(uint8.slice(i, i + CHUNK_SIZE));
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
};

// Alias de compatibilidad — mantiene la referencia legacy para imports existentes
export const printerEngine: IPrinterAdapter = webBluetoothAdapter;

export async function checkDevicePermission(activePrinter: any): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!activePrinter) return false;

  const type = activePrinter.type || activePrinter.connection_type || 'bluetooth';

  if (isNativeAndroidApp()) {
    if (type === 'wifi') return true;
    if (type === 'bluetooth') {
      try {
        const { BluetoothSerial } = await import('@e-is/capacitor-bluetooth-serial');
        const res = await BluetoothSerial.isEnabled();
        return Boolean(res?.enabled);
      } catch (_) {
        return false;
      }
    }
    return true;
  }

  if (type === 'wifi') return true;

  const nav = navigator as any;
  if (type === 'usb') {
    if (nav?.usb && typeof nav.usb.getDevices === 'function') {
      try {
        const devices = await nav.usb.getDevices();
        if (devices && devices.length > 0) {
          const isPrinter = devices.some((d: any) => {
            const pName = (d.productName || '').toLowerCase();
            return !pName.includes('mouse') && !pName.includes('keyboard');
          });
          if (isPrinter) return true;
        }
      } catch (_) { }
    }
    if (nav?.serial && typeof nav.serial.getPorts === 'function') {
      try {
        const ports = await nav.serial.getPorts();
        if (ports && ports.length > 0) return true;
      } catch (_) { }
    }
    return false;
  }

  // Bluetooth
  if (nav?.bluetooth && typeof nav.bluetooth.getDevices === 'function') {
    try {
      const devices = await nav.bluetooth.getDevices();
      if (devices && devices.length > 0) {
        return devices.some((d: any) => d.name === activePrinter.name) || true;
      }
    } catch (_) { }
  }
  return false;
}

export async function pairActivePrinter(activePrinter: any): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'No disponible en el servidor' };
  if (!activePrinter) return { success: false, error: 'No hay impresora activa seleccionada' };

  const type = activePrinter.type || activePrinter.connection_type || 'bluetooth';

  if (isNativeAndroidApp()) {
    if (type === 'wifi') return { success: true };
    if (type === 'bluetooth') {
      try {
        const { BluetoothSerial } = await import('@e-is/capacitor-bluetooth-serial');
        const isEnabledRes = await BluetoothSerial.isEnabled();
        if (!isEnabledRes?.enabled) {
          if (typeof (BluetoothSerial as any).enable === 'function') {
            await (BluetoothSerial as any).enable();
            const recheck = await BluetoothSerial.isEnabled();
            if (!recheck?.enabled) {
              return { success: false, error: 'El Bluetooth no fue activado. Enciéndelo para imprimir.' };
            }
          } else {
            return { success: false, error: 'El Bluetooth de tu teléfono está apagado. Actívalo en los ajustes de tu dispositivo.' };
          }
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'No se pudo encender el Bluetooth' };
      }
    }
    return { success: true };
  }

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;

  if (type === 'wifi') {
    return { success: true };
  }

  if (type === 'usb') {
    try {
      let filters: any[] = [];
      let savedVid: number | undefined;
      let savedPid: number | undefined;

      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`usb_vid_pid_${activePrinter.store_id || 'default'}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.vendorId) {
              savedVid = parsed.vendorId;
              savedPid = parsed.productId;
            }
          } catch (_) { }
        }
      }

      if (savedVid !== undefined) {
        filters.push(savedPid !== undefined ? { vendorId: savedVid, productId: savedPid } : { vendorId: savedVid });
      }

      let usbRes: any = null;
      try {
        usbRes = await usbSerialAdapter.requestDevice(filters.length > 0 ? { filters } : undefined);
      } catch (fErr: any) {
        if (fErr?.message?.includes('cancelada')) {
          return { success: false, error: 'Selección USB cancelada.' };
        }
        // Si el filtro específico no coincidió, reintentar sin filtros
        usbRes = await usbSerialAdapter.requestDevice();
      }

      if (usbRes) {
        if (typeof window !== 'undefined' && usbRes.device?.vendorId) {
          localStorage.setItem(`usb_vid_pid_${activePrinter.store_id || 'default'}`, JSON.stringify({
            vendorId: usbRes.device.vendorId,
            productId: usbRes.device.productId,
            productName: usbRes.device.productName
          }));
        }
        setActiveDevicePrinter(activePrinter, activePrinter.store_id);
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Selección USB cancelada' };
    }
  }

  // Bluetooth
  if (nav?.bluetooth) {
    try {
      const cleanName = activePrinter?.name?.trim();
      let dev = null;

      if (cleanName) {
        try {
          const namePrefix = cleanName.split(' ')[0] || cleanName.slice(0, 4);
          dev = await nav.bluetooth.requestDevice({
            filters: [
              { name: cleanName },
              { namePrefix: namePrefix }
            ],
            optionalServices: (webBluetoothAdapter as any).knownServices
          });
        } catch (filterErr: any) {
          if (filterErr?.name === 'NotFoundError') {
            return { success: false, error: 'Selección Bluetooth cancelada.' };
          }
          // Fallback a acceptAllDevices si el filtro estricto no coincidió con el broadcast BLE
          dev = await nav.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: (webBluetoothAdapter as any).knownServices
          });
        }
      } else {
        dev = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: (webBluetoothAdapter as any).knownServices
        });
      }

      if (dev) {
        setActiveDevicePrinter(activePrinter, activePrinter.store_id);
        return { success: true };
      }
    } catch (err: any) {
      if (err?.name === 'NotFoundError') {
        return { success: false, error: 'Selección Bluetooth cancelada.' };
      }
      return { success: false, error: err?.message || 'Error al conectar dispositivo Bluetooth' };
    }
  }

  return { success: false, error: 'Bluetooth no soportado en este navegador' };
}

export async function safePrint(saleData: any, doubleCopy = false, storeId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await silentPrintSaleReceipt(saleData, doubleCopy, storeId);
    return { success: true };
  } catch (err: any) {
    const msg = err?.message?.includes('NO_PRINTER_CONFIGURED')
      ? 'No hay impresora configurada por defecto.'
      : (err?.message || 'Error de conexión con la impresora. Verifique que esté encendida.');
    return { success: false, error: msg };
  }
}
