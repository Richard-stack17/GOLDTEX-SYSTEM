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

export async function printSaleReceipt(device: any, saleData: any, paperWidth: number) {
  if (!device) throw new Error('No hay un dispositivo Bluetooth emparejado.');
  if (!device.gatt) throw new Error('El dispositivo no soporta GATT.');

  let server;
  try {
    server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  } catch(e) {
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

  // Centro
  escpos.push(0x1B, 0x61, 0x01);
  escpos.push(0x1B, 0x45, 0x01); // Bold on
  append('GOLTEX\n');
  escpos.push(0x1B, 0x45, 0x00); // Bold off
  append('Ticket de Venta\n');
  append(`Doc: ${saleData.document_number || 'N/A'}\n`);
  append(`Fecha: ${new Date().toLocaleString()}\n`);
  
  if (saleData.customer_name) {
    append(`Cliente: ${saleData.customer_name}\n`);
  }

  // Izquierda
  escpos.push(0x1B, 0x61, 0x00);
  
  // Dependiendo del ancho, definimos la línea de separación. 
  // 32 chars genérico para 58mm y 80mm
  const MAX_CHARS = paperWidth === 80 ? 48 : 32;
  const separator = '-'.repeat(MAX_CHARS) + '\n';
  
  append(separator);
  
  // Titulos de tabla
  const titleProd = 'PRODUCTO'.padEnd(MAX_CHARS - 17, ' ');
  const titleCant = 'CANT'.padStart(6, ' ');
  const titleTot = 'TOTAL'.padStart(10, ' ');
  append(`${titleProd} ${titleCant} ${titleTot}\n`);
  
  append(separator);

  // Items (el usuario no proporcionó el schema exacto de los items, asumo description, quantity, total)
  const items = saleData.items || [];
  for (const item of items) {
    const nameStr = (item.description || 'Producto').substring(0, MAX_CHARS - 17).padEnd(MAX_CHARS - 17, ' ');
    const qtyStr = String(item.quantity || 1).padStart(6, ' ');
    const totalStr = Number(item.total || 0).toFixed(2).padStart(10, ' ');
    append(`${nameStr} ${qtyStr} ${totalStr}\n`);
  }

  append(separator);
  
  // Derecha
  escpos.push(0x1B, 0x61, 0x02);
  append(`SUBTOTAL: S/ ${Number(saleData.total || 0).toFixed(2)}\n`);
  append(`TOTAL: S/ ${Number(saleData.total || 0).toFixed(2)}\n`);
  
  // Centro pie de pagina
  escpos.push(0x1B, 0x61, 0x01);
  append('\n');
  if (saleData.comment) {
    append(`Nota: ${saleData.comment}\n`);
  }
  append('Gracias por su preferencia!\n');
  append('Software por GOLTEX\n');

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
