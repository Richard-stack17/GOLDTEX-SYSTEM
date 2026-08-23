// app/configuracion/utils/printerEngine.ts

import { supabase } from '../../lib/supabase';
import { isNativeAndroidApp } from '../../lib/platform';

export interface TicketLine {
  align?: 'center' | 'left' | 'right';
  text: string;
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
  const totalRedondeado = Math.round(sumaRedondeada2Dec * 10) / 10;
  const totalFinalStr = totalRedondeado.toFixed(2);

  // Total optimizado en Doble Ancho 2X (Ocupa la mitad de columnas para llenar el 100% de la bobina de borde a borde)
  const halfCols = Math.floor(maxChars / 2);
  const totalNumStr = `S/ ${totalFinalStr}`;
  const spaces2X = Math.max(1, halfCols - 'TOTAL'.length - totalNumStr.length);
  const total2XLine = `TOTAL${' '.repeat(spaces2X)}${totalNumStr}`;
  left(total2XLine);

  const dateObj = new Date();
  const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  center(dateStr);
  const docNum = saleData.proforma_number || saleData.invoice_number || saleData.document_number || 'N/A';
  const cleanDocNum = docNum.replace(/^TKT-/, '');
  const isConsolidated = saleData.source_type === 'CONSOLIDATED' || (Array.isArray(saleData._consolidated_tickets) && saleData._consolidated_tickets.length > 0) || (Array.isArray(saleData.children) && saleData.children.length > 0);

  if (isConsolidated) {
    center('--- VENTA UNIFICADA ---');
    const subTickets = Array.isArray(saleData._consolidated_tickets) && saleData._consolidated_tickets.length > 0
      ? saleData._consolidated_tickets
      : (Array.isArray(saleData.children) ? saleData.children : []);

    if (subTickets.length > 0) {
      const ticketNums = subTickets.map((t: any) => t.internal_ticket_number ? `#${t.internal_ticket_number}` : (t.proforma_number || '')).filter(Boolean);
      center(`TICKETS: ${ticketNums.join(' + ')}`);
    } else {
      const docHeader = `TKT-${cleanDocNum}`;
      if (docHeader.length <= maxChars) {
        center(docHeader);
      } else {
        const parts = cleanDocNum.split(' + ');
        center('TICKETS UNIFICADOS:');
        parts.forEach((p: string) => center(p.trim()));
      }
    }
  } else {
    center(`TKT-${cleanDocNum}`);
  }

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

  // Feed 4 lines & Cut
  escpos.push(0x1B, 0x64, 0x04);
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
        throw new Error('Emparejamiento cancelado por el usuario.');
      }
      throw err;
    }
  }

  private async getWriteCharacteristic(device: any) {
    if (!device?.gatt) throw new Error('El dispositivo no soporta comunicación GATT.');
    
    let server = device.gatt.connected ? device.gatt : await device.gatt.connect();
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
      } catch (_) {}
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
        } catch (_) {}
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
    const lines = generateTicketLines(DEFAULT_TEST_SALE_DATA, maxChars);
    const uint8 = buildEscPosBytes(lines, maxChars);

    const { server, writeChar } = await this.getWriteCharacteristic(device);

    try {
      await this.sendBytes(writeChar, uint8, server);
      await new Promise(resolve => setTimeout(resolve, 1200));
    } finally {
      if (server?.connected) {
        try { server.disconnect(); } catch (_) {}
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
        try { server.disconnect(); } catch (_) {}
      }
    }
  }

  async silentPrintSaleReceipt(saleData: any, doubleCopy: boolean = false) {
    let activePrinter: any = null;
    try {
      const { data: printers } = await supabase
        .from('printers')
        .select('*')
        .eq('is_active', true)
        .order('auto_print', { ascending: false });
      if (printers && printers.length > 0) {
        activePrinter = printers.find((p: any) => p.auto_print) || printers[0];
        try { localStorage.setItem('cached_printer_config', JSON.stringify(activePrinter)); } catch (_) {}
      }
    } catch (_) {}

    if (!activePrinter) {
      try {
        const cached = localStorage.getItem('cached_printer_config');
        if (cached) activePrinter = JSON.parse(cached);
      } catch (_) {}
    }

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
    } catch (_) {}

    if (!deviceToPrint) {
      deviceToPrint = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.knownServices
      });
    }

    if (!deviceToPrint) throw new Error("PRINTER_CONNECTION_ERROR");

    const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
    await this.printSaleReceipt(deviceToPrint, saleData, activePrinter.paper_width || 80, maxCharsConfig);

    if (doubleCopy) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await this.printSaleReceipt(deviceToPrint, saleData, activePrinter.paper_width || 80, maxCharsConfig);
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

    // Verificar si Bluetooth está habilitado en el dispositivo
    const { enabled } = await BluetoothSerial.isEnabled();
    if (!enabled) {
      // Solicitar al OS que habilite el Bluetooth
      await BluetoothSerial.enable();
      const { enabled: enabledAfter } = await BluetoothSerial.isEnabled();
      if (!enabledAfter) {
        throw new Error('Bluetooth no está habilitado. Actívalo en los ajustes del dispositivo.');
      }
    }

    // Escanear dispositivos Bluetooth Classic cercanos
    const { devices } = await BluetoothSerial.scan();
    if (!devices || devices.length === 0) {
      throw new Error('No se encontraron dispositivos Bluetooth. Asegúrate de que la impresora esté encendida y visible.');
    }

    // Devolver el primer dispositivo encontrado
    // El check de length garantiza que devices[0] existe; el ! es correcto aquí
    const first = devices[0]!;
    return { name: first.name || first.address || 'Impresora BT', device: first };
  }

  private async writeBytes(address: string, uint8: Uint8Array): Promise<void> {
    const { BluetoothSerial } = await import('@e-is/capacitor-bluetooth-serial');

    await BluetoothSerial.connect({ address });
    try {
      // BluetoothWriteOptions: { address: string, value: string }
      // value debe ser la cadena de bytes codificada en latin1 (ISO-8859-1)
      const value = Array.from(uint8).map(b => String.fromCharCode(b)).join('');
      await BluetoothSerial.write({ address, value });
      // Pausa para que la impresora procese los bytes antes de desconectar
      await new Promise(r => setTimeout(r, 1200));
    } finally {
      try { await BluetoothSerial.disconnect({ address }); } catch (_) {}
    }
  }

  async printTestReceipt(device: any, paperWidth: number, maxChars: number = 48): Promise<void> {
    const lines = generateTicketLines(DEFAULT_TEST_SALE_DATA, maxChars);
    const uint8 = buildEscPosBytes(lines, maxChars);
    const address = device?.address;
    if (!address) throw new Error('Dispositivo Bluetooth sin dirección MAC. Vuelve a buscar la impresora.');
    await this.writeBytes(address, uint8);
  }

  async printSaleReceipt(device: any, saleData: any, paperWidth: number, maxChars: number = 48): Promise<void> {
    const lines = generateTicketLines(saleData, maxChars);
    const uint8 = buildEscPosBytes(lines, maxChars);
    const address = device?.address;
    if (!address) throw new Error('Dispositivo Bluetooth sin dirección MAC.');
    await this.writeBytes(address, uint8);
  }

  async silentPrintSaleReceipt(saleData: any, doubleCopy: boolean = false): Promise<void> {
    const { BluetoothSerial } = await import('@e-is/capacitor-bluetooth-serial');

    let activePrinter: any = null;
    try {
      const { data: printers } = await supabase
        .from('printers')
        .select('*')
        .eq('is_active', true)
        .order('auto_print', { ascending: false });
      if (printers && printers.length > 0) {
        activePrinter = printers.find((p: any) => p.auto_print) || printers[0];
        try { localStorage.setItem('cached_printer_config', JSON.stringify(activePrinter)); } catch (_) {}
      }
    } catch (_) {}

    if (!activePrinter) {
      try {
        const cached = localStorage.getItem('cached_printer_config');
        if (cached) activePrinter = JSON.parse(cached);
      } catch (_) {}
    }

    if (!activePrinter) throw new Error('NO_PRINTER_CONFIGURED');

    const address = activePrinter.mac_address;
    if (!address) throw new Error('PRINTER_CONNECTION_ERROR');

    const maxCharsConfig = activePrinter.max_chars || (activePrinter.paper_width <= 58 ? 32 : 48);
    const lines = generateTicketLines(saleData, maxCharsConfig);
    const uint8 = buildEscPosBytes(lines, maxCharsConfig);

    await BluetoothSerial.connect({ address });
    try {
      // BluetoothWriteOptions: { address: string, value: string }
      const value = Array.from(uint8).map(b => String.fromCharCode(b)).join('');
      await BluetoothSerial.write({ address, value });
      await new Promise(r => setTimeout(r, 1200));
      if (doubleCopy) {
        await new Promise(r => setTimeout(r, 1500));
        await BluetoothSerial.write({ address, value });
        await new Promise(r => setTimeout(r, 1200));
      }
    } finally {
      try { await BluetoothSerial.disconnect({ address }); } catch (_) {}
    }
  }
}

// ── USB / CABLE ADAPTER (Web Serial & WebUSB API) ──
export class WebUsbSerialAdapter {
  async requestDevice() {
    const nav = typeof window !== 'undefined' ? (navigator as any) : null;
    
    if (nav?.serial) {
      try {
        const port = await nav.serial.requestPort();
        return {
          name: 'Impresora USB (Cable)',
          port
        };
      } catch (err: any) {
        if (err.name === 'NotFoundError') throw new Error('Selección USB cancelada.');
        throw err;
      }
    }

    if (nav?.usb) {
      try {
        const device = await nav.usb.requestDevice({ filters: [] });
        return {
          name: device.productName || 'Impresora USB',
          device
        };
      } catch (err: any) {
        if (err.name === 'NotFoundError') throw new Error('Selección USB cancelada.');
        throw err;
      }
    }

    throw new Error('Tu navegador no soporta Web Serial ni Web USB. Utiliza Google Chrome o Microsoft Edge.');
  }

  async printEscPos(usbObj: any, uint8: Uint8Array) {
    if (usbObj?.port) {
      const port = usbObj.port;
      await port.open({ baudRate: 9600 });
      const writer = port.writable.getWriter();
      await writer.write(uint8);
      writer.releaseLock();
      await new Promise(r => setTimeout(r, 500));
      await port.close();
      return;
    }

    if (usbObj?.device) {
      const device = usbObj.device;
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      const iface = device.configuration.interfaces[0];
      const alt = iface.alternates[0];
      const endpoint = alt.endpoints.find((e: any) => e.direction === 'out');
      const endpointNumber = endpoint ? endpoint.endpointNumber : 1;

      await device.transferOut(endpointNumber, uint8);
      await new Promise(r => setTimeout(r, 500));
      await device.close();
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
        try { document.body.removeChild(iframe); } catch (_) {}
      }, 2000);
    }
  }, 350);
}

// ── EXPORTED HELPERS — Lógica dual: Android nativo vs Web ────────────────────
// Si la app corre en Android nativo (Capacitor APK) → usa AndroidBluetoothSerialAdapter (SPP Classic)
// Si corre en el navegador (PC, Mac, Chrome Móvil) → usa WebBluetoothAdapter (Web Bluetooth API)
export const webBluetoothAdapter = new WebBluetoothAdapter();
export const androidBluetoothAdapter = new AndroidBluetoothSerialAdapter();
export const usbSerialAdapter = new WebUsbSerialAdapter();

function getBluetoothAdapter(): IPrinterAdapter {
  return isNativeAndroidApp() ? androidBluetoothAdapter : webBluetoothAdapter;
}

export const requestBluetoothDevice = () => getBluetoothAdapter().requestDevice();
export const requestUsbDevice = () => usbSerialAdapter.requestDevice();
export const printTestReceipt = (device: any, paperWidth: number, maxChars: number = 48) => getBluetoothAdapter().printTestReceipt(device, paperWidth, maxChars);
export const printSaleReceipt = (device: any, saleData: any, paperWidth: number, maxChars: number = 48) => getBluetoothAdapter().printSaleReceipt(device, saleData, paperWidth, maxChars);
export const silentPrintSaleReceipt = (saleData: any, doubleCopy: boolean = false) => getBluetoothAdapter().silentPrintSaleReceipt(saleData, doubleCopy);

// Alias de compatibilidad — mantiene la referencia legacy para imports existentes
export const printerEngine: IPrinterAdapter = webBluetoothAdapter;

export async function safePrint(saleData: any, doubleCopy = false): Promise<{ success: boolean; error?: string }> {
  try {
    await silentPrintSaleReceipt(saleData, doubleCopy);
    return { success: true };
  } catch (err: any) {
    const msg = err?.message?.includes('NO_PRINTER_CONFIGURED')
      ? 'No hay impresora configurada por defecto.'
      : 'Error de conexión con la impresora. Verifique que esté encendida.';
    return { success: false, error: msg };
  }
}
