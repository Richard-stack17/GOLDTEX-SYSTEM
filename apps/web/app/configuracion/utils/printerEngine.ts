// app/configuracion/utils/printerEngine.ts

/**
 * Solicita permisos al usuario para emparejar un dispositivo Bluetooth.
 * Usa Web Bluetooth API.
 */
export async function requestBluetoothDevice() {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth API no está soportada en este navegador (intenta con Chrome o Edge).');
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '00001101-0000-1000-8000-00805f9b34fb', // Estándar sugerido
        '000018f0-0000-1000-8000-00805f9b34fb', // Servicio típico impresoras térmicas BLE
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Otro común en genéricas
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'  // Ipos
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

/**
 * Conecta al dispositivo GATT, busca el canal de escritura,
 * construye y envía un buffer ESC/POS puro.
 */
export async function printTestReceipt(device: any, paperWidth: number) {
  if (!device) throw new Error('No hay un objeto de dispositivo Bluetooth proveído.');
  if (!device.gatt) throw new Error('El dispositivo seleccionado no soporta GATT.');

  const server = await device.gatt.connect();

  // Buscar dinámicamente un servicio que tenga una característica escribible
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

  // Construir Array ESC/POS puro
  const escpos: number[] = [];

  // 1. Inicialización
  escpos.push(0x1B, 0x40);

  // 2. Alinear al centro
  escpos.push(0x1B, 0x61, 0x01);
  const title = '=== PRUEBA DE IMPRESION ===\n';
  for (let i = 0; i < title.length; i++) escpos.push(title.charCodeAt(i));

  // 3. Alinear a la izquierda
  escpos.push(0x1B, 0x61, 0x00);
  const subtitle = 'Sistema GOLTEX - Operativo\n';
  for (let i = 0; i < subtitle.length; i++) escpos.push(subtitle.charCodeAt(i));

  // 4. Fecha y Hora
  const dateStr = new Date().toLocaleString() + '\n';
  for (let i = 0; i < dateStr.length; i++) escpos.push(dateStr.charCodeAt(i));

  // 5. Feed de papel (3 lineas)
  escpos.push(0x1B, 0x64, 0x03);

  // 6. Cutter (corte parcial/total)
  escpos.push(0x1D, 0x56, 0x41, 0x00);

  // Enviar a la impresora en chunks (límite BLE típico de ~512 o 20 bytes)
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

  // Desconectar al terminar la impresión de prueba
  device.gatt.disconnect();
}

export async function printSaleReceipt(device: any, saleData: any, paperWidth: number, maxChars: number = 42) {
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

  // Inicialización
  escpos.push(0x1B, 0x40);

  // Forzar Fuente A (Estándar 80mm)
  escpos.push(0x1B, 0x4D, 0x00);

  const lines = generateTicketLines(saleData, maxChars);

  for (const line of lines) {
    if (line.align === 'center') {
      escpos.push(0x1B, 0x61, 0x01); // Center
    } else if (line.align === 'right') {
      escpos.push(0x1B, 0x61, 0x02); // Right
    } else {
      escpos.push(0x1B, 0x61, 0x00); // Left
    }

    // Bold only for PROFORMA
    if (line.text === 'PROFORMA') escpos.push(0x1B, 0x45, 0x01); // Bold on

    append(line.text + '\n');

    if (line.text === 'PROFORMA') escpos.push(0x1B, 0x45, 0x00); // Bold off
  }

  // Feed de papel (3 lineas)
  escpos.push(0x1B, 0x64, 0x03);

  // Cutter (corte parcial/total)
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
    console.log('ITEM FOR PRINT:', item); // DEBUGGING: Verifica los nombres de las propiedades reales
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

    // precioVar = lo que el vendedor realmente cobró (editedPrice)
    const precioVar = Number(rawEditedPrice).toFixed(2);
    // precioFijo = el precio del catálogo tal cual (puede ser 0.00 si es precio libre)
    const precioFijo = Number(rawPrice).toFixed(2);
    
    const itemTotal = item.total !== undefined ? item.total : qty * Number(precioVar);
    sumaExacta += Number(itemTotal);

    const isService = itemName === 'CONFECCIÓN' || itemName === 'TAXI';

    if (isService) {
      // Si es SERVICIO: Imprime una sola línea. Nombre a la izq, precio total a la derecha. NO imprime cantidad/multiplicación.
      left(formatLR(itemName, `S/ ${Number(itemTotal).toFixed(2)}`));
    } else {
      // PRODUCTO NORMAL: Formato 2 líneas
      // Línea 1: [IZQ] {codigo} {nombre_producto} x S/. {precio_fijo}
      const suffixL1 = ` x S/. ${precioFijo}`;
      const maxNameLen = maxChars - suffixL1.length - code.length;
      let safeName = itemName;
      if (safeName.length > maxNameLen) {
        safeName = safeName.substring(0, maxNameLen);
      }
      left(`${code}${safeName}${suffixL1}`);

      // Línea 2: [IZQ] {cantidad} {unidad} x S/{precio_variable}   [DER] S/ {total_item}
      left(formatLR(`${qty} M x S/${precioVar}`, `S/ ${Number(itemTotal).toFixed(2)}`));
    }
  }

  left(separatorThin);
  // Paso 1 (Limpieza): Primero, redondea la suma a 2 decimales para eliminar errores de coma flotante
  const sumaRedondeada2Dec = Math.round(sumaExacta * 100) / 100;
  // Paso 2 (Redondeo a Décimos): Ahora redondea ese resultado al décimo (0.10) más cercano
  const totalRedondeado = Math.round(sumaRedondeada2Dec * 10) / 10;
  const totalFinalStr = totalRedondeado.toFixed(2);
  left(formatLR('TOTAL FINAL', `S/ ${totalFinalStr}`));


  const dateObj = new Date();
  const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  center(dateStr);
  const cleanDocNum = (saleData.document_number || 'N/A').replace(/^TKT-/, '');
  center(`TKT-${cleanDocNum} - Caja 1`);

  return lines;
}

import { supabase } from '../../lib/supabase';

export async function silentPrintSaleReceipt(saleData: any, doubleCopy: boolean = false) {
  try {
    // 1. Fetch default printer configuration from Supabase (prioritize the one with auto_print: true)
    const { data: printers, error } = await supabase
      .from('printers')
      .select('*')
      .order('auto_print', { ascending: false });
    const activePrinter = printers?.[0];

    if (error || !activePrinter || activePrinter.type !== 'bluetooth') {
      console.warn("No hay impresora Bluetooth por defecto configurada en Supabase.");
      return;
    }

    let deviceToPrint = null;
    const nav = navigator as any;

    if (!nav.bluetooth) {
      console.warn("Web Bluetooth API no está soportada en este navegador.");
      return;
    }

    // 2. Reconexión Silenciosa (getDevices)
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

    // 3. Fallback (Plan B) - Request Device
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
        console.warn("El usuario canceló o falló requestDevice:", err);
        return; // Salir silenciosamente sin alertar
      }
    }

    if (!deviceToPrint) return;

    // 4. Conexión GATT Dinámica & Imprimir
    const maxCharsConfig = activePrinter.max_chars || 42;
    await printSaleReceipt(deviceToPrint, saleData, activePrinter.paper_width || 80, maxCharsConfig);

    if (doubleCopy) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await printSaleReceipt(deviceToPrint, saleData, activePrinter.paper_width || 80, maxCharsConfig);
    }

    // Desconectar al terminar la impresión
    if (deviceToPrint.gatt && deviceToPrint.gatt.connected) {
      deviceToPrint.gatt.disconnect();
    }
  } catch (err) {
    console.error("Error en silentPrintSaleReceipt:", err);
  }
}
