// app/configuracion/utils/printerEngine.ts

import { supabase } from '../../lib/supabase';

export interface TicketLine {
  align?: 'center' | 'left' | 'right';
  text: string;
}

export function generateTicketLines(saleData: any, maxChars: number): TicketLine[] {
  const lines: TicketLine[] = [];

  const center = (text: string) => lines.push({ align: 'center', text });
  const left = (text: string) => lines.push({ align: 'left', text });

  const formatLR = (l: string, r: string) => {
    const spaces = maxChars - l.length - r.length;
    if (spaces > 0) return l + ' '.repeat(spaces) + r;
    const truncatedL = l.substring(0, maxChars - r.length - 1);
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
    
    // Robust Price Fallbacks
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
      if (safeName.length > maxNameLen) {
        safeName = safeName.substring(0, maxNameLen);
      }
      left(`${code}${safeName}${suffixL1}`);
      left(formatLR(`${qty} M x S/${precioVar}`, `S/ ${Number(itemTotal).toFixed(2)}`));
    }
  }

  left(separatorThin);
  const sumaRedondeada2Dec = Math.round(sumaExacta * 100) / 100;
  const totalRedondeado = Math.round(sumaRedondeada2Dec * 10) / 10;
  const totalFinalStr = totalRedondeado.toFixed(2);
  left(formatLR('TOTAL FINAL', `S/ ${totalFinalStr}`));


  const dateObj = new Date();
  const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  center(dateStr);
  const docNum = saleData.proforma_number || saleData.invoice_number || saleData.document_number || 'N/A';
  const cleanDocNum = docNum.replace(/^TKT-/, '');
  center(`TKT-${cleanDocNum} - Caja 1`);

  return lines;
}

export interface IPrinterAdapter {
  requestDevice(): Promise<any>;
  printTestReceipt(device: any, paperWidth: number): Promise<void>;
  printSaleReceipt(device: any, saleData: any, paperWidth: number, maxChars?: number): Promise<void>;
  silentPrintSaleReceipt(saleData: any, doubleCopy?: boolean): Promise<void>;
}

export class WebBluetoothAdapter implements IPrinterAdapter {
  async requestDevice() {
    const nav = navigator as any;
    if (!nav.bluetooth) {
      throw new Error('Web Bluetooth API no está soportada en este navegador (intenta con Chrome o Edge).');
    }

    try {
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '00001101-0000-1000-8000-00805f9b34fb',
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'
        ]
      });

      return {
        name: device.name || 'Impresora Desconocida',
        device: device
      };
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        throw new Error('Emparejamiento cancelado por el usuario.');
      }
      throw err;
    }
  }

  async printTestReceipt(device: any, paperWidth: number) {
    if (!device) throw new Error('No hay un objeto de dispositivo Bluetooth proveído.');
    if (!device.gatt) throw new Error('El dispositivo seleccionado no soporta GATT.');

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    let writeCharacteristic = null;

    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeCharacteristic = char;
          break;
        }
      }
      if (writeCharacteristic) break;
    }

    if (!writeCharacteristic) {
      device.gatt.disconnect();
      throw new Error('No se encontró una característica de escritura válida en este dispositivo.');
    }

    const escpos: number[] = [];
    escpos.push(0x1B, 0x40);
    escpos.push(0x1B, 0x61, 0x01);
    const title = '=== PRUEBA DE IMPRESION ===\n';
    for (let i = 0; i < title.length; i++) escpos.push(title.charCodeAt(i));

    escpos.push(0x1B, 0x61, 0x00);
    const subtitle = 'Sistema GOLTEX - Operativo\n';
    for (let i = 0; i < subtitle.length; i++) escpos.push(subtitle.charCodeAt(i));

    const dateStr = new Date().toLocaleString() + '\n';
    for (let i = 0; i < dateStr.length; i++) escpos.push(dateStr.charCodeAt(i));

    escpos.push(0x1B, 0x64, 0x03);
    escpos.push(0x1D, 0x56, 0x41, 0x00);

    const uint8 = new Uint8Array(escpos);
    const CHUNK_SIZE = 256;

    try {
      for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
        const chunk = uint8.slice(i, i + CHUNK_SIZE);
        if (writeCharacteristic.properties.writeWithoutResponse) {
          await writeCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await writeCharacteristic.writeValue(chunk);
        }
      }
    } catch (error) {
      device.gatt.disconnect();
      throw new Error('Error al enviar bytes a la impresora: ' + (error as Error).message);
    }

    device.gatt.disconnect();
  }

  async printSaleReceipt(device: any, saleData: any, paperWidth: number, maxChars: number = 42) {
    if (!device) throw new Error('No hay un dispositivo Bluetooth emparejado.');
    if (!device.gatt) throw new Error('El dispositivo no soporta GATT.');

    let server;
    try {
      server = device.gatt.connected ? device.gatt : await device.gatt.connect();
    } catch (e) {
      throw new Error('No se pudo conectar con la impresora. Enciéndela o acércate a ella.');
    }

    const services = await server.getPrimaryServices();
    let writeCharacteristic = null;

    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeCharacteristic = char;
          break;
        }
      }
      if (writeCharacteristic) break;
    }

    if (!writeCharacteristic) {
      device.gatt.disconnect();
      throw new Error('No se encontró una característica de escritura válida.');
    }

    const escpos: number[] = [];
    const append = (text: string) => {
      for (let i = 0; i < text.length; i++) {
        escpos.push(text.charCodeAt(i));
      }
    };

    escpos.push(0x1B, 0x40);
    escpos.push(0x1B, 0x4D, 0x00);

    const lines = generateTicketLines(saleData, maxChars);

    for (const line of lines) {
      if (line.align === 'center') escpos.push(0x1B, 0x61, 0x01);
      else if (line.align === 'right') escpos.push(0x1B, 0x61, 0x02);
      else escpos.push(0x1B, 0x61, 0x00);

      if (line.text === 'PROFORMA') escpos.push(0x1B, 0x45, 0x01);
      append(line.text + '\n');
      if (line.text === 'PROFORMA') escpos.push(0x1B, 0x45, 0x00);
    }

    escpos.push(0x1B, 0x64, 0x03);
    escpos.push(0x1D, 0x56, 0x41, 0x00);

    const uint8 = new Uint8Array(escpos);
    const CHUNK_SIZE = 256;

    try {
      for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
        const chunk = uint8.slice(i, i + CHUNK_SIZE);
        if (writeCharacteristic.properties.writeWithoutResponse) {
          await writeCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await writeCharacteristic.writeValue(chunk);
        }
      }
    } catch (error) {
      device.gatt.disconnect();
      throw new Error('Error al enviar bytes a la impresora: ' + (error as Error).message);
    }
  }

  async silentPrintSaleReceipt(saleData: any, doubleCopy: boolean = false) {
    try {
      let activePrinter: any = null;
      try {
        const { data: printers } = await supabase
          .from('printers')
          .select('*')
          .order('auto_print', { ascending: false });
        if (printers && printers.length > 0) {
          activePrinter = printers.find((p: any) => p.auto_print) || printers[0];
          try { localStorage.setItem('cached_printer_config', JSON.stringify(activePrinter)); } catch (_) {}
        }
      } catch (e) {
        console.warn("📌 [Modo Avión / Offline] Fallo al consultar impresoras en Supabase. Usando caché local:", e);
      }

      if (!activePrinter) {
        try {
          const cached = localStorage.getItem('cached_printer_config');
          if (cached) activePrinter = JSON.parse(cached);
        } catch (_) {}
      }

      if (!activePrinter) {
        throw new Error("NO_PRINTER_CONFIGURED");
      }

      let deviceToPrint = null;
      const nav = navigator as any;

      if (!nav.bluetooth) {
        throw new Error("PRINTER_CONNECTION_ERROR");
      }

      try {
        if (typeof nav.bluetooth.getDevices === 'function') {
          const devices = await nav.bluetooth.getDevices();
          if (devices && devices.length > 0) {
            deviceToPrint = devices.find((d: any) => d.name === activePrinter.name) || devices[0];
          }
        }
      } catch (err) {
        console.warn("Error en reconexión silenciosa (getDevices):", err);
      }

      if (!deviceToPrint) {
        try {
          deviceToPrint = await nav.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
              '00001101-0000-1000-8000-00805f9b34fb',
              '000018f0-0000-1000-8000-00805f9b34fb',
              'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
              '49535343-fe7d-4ae5-8fa9-9fafd205e455'
            ]
          });
        } catch (err) {
          throw new Error("PRINTER_CONNECTION_ERROR");
        }
      }

      if (!deviceToPrint) {
        throw new Error("PRINTER_CONNECTION_ERROR");
      }

      const maxCharsConfig = activePrinter.max_chars || 42;
      await this.printSaleReceipt(deviceToPrint, saleData, activePrinter.paper_width || 80, maxCharsConfig);

      if (doubleCopy) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.printSaleReceipt(deviceToPrint, saleData, activePrinter.paper_width || 80, maxCharsConfig);
      }

      if (deviceToPrint.gatt && deviceToPrint.gatt.connected) {
        deviceToPrint.gatt.disconnect();
      }
    } catch (err) {
      console.error("Error en silentPrintSaleReceipt:", err);
      throw err;
    }
  }
}

export class NativeBluetoothAdapter implements IPrinterAdapter {
  async requestDevice() {
    console.log("Native requestDevice invoked via Capacitor plugin placeholder");
    return null;
  }
  
  async printTestReceipt(device: any, paperWidth: number) {
    console.log("Native printTestReceipt invoked via Capacitor plugin placeholder");
  }

  async printSaleReceipt(device: any, saleData: any, paperWidth: number, maxChars: number = 42) {
    console.log("Native printSaleReceipt invoked via Capacitor plugin placeholder", saleData);
  }

  async silentPrintSaleReceipt(saleData: any, doubleCopy: boolean = false) {
    console.log("Native silentPrintSaleReceipt invoked via Capacitor plugin placeholder", saleData);
  }
}

const isApkMode = process.env.NEXT_PUBLIC_APP_MODE === 'apk';
export const printerEngine: IPrinterAdapter = isApkMode ? new NativeBluetoothAdapter() : new WebBluetoothAdapter();

export const requestBluetoothDevice = () => printerEngine.requestDevice();
export const printTestReceipt = (device: any, paperWidth: number) => printerEngine.printTestReceipt(device, paperWidth);
export const printSaleReceipt = (device: any, saleData: any, paperWidth: number, maxChars: number = 42) => printerEngine.printSaleReceipt(device, saleData, paperWidth, maxChars);
export const silentPrintSaleReceipt = (saleData: any, doubleCopy: boolean = false) => printerEngine.silentPrintSaleReceipt(saleData, doubleCopy);
