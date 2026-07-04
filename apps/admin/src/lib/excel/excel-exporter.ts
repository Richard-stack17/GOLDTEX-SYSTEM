/**
 * ═══════════════════════════════════════════════════════════════════
 * GOLTEX S.A.C. — Excel Exporter
 * ═══════════════════════════════════════════════════════════════════
 *
 * Función para exportar las ventas nuevas del sistema generando un
 * archivo Excel que tenga exactamente el mismo formato de BANCO JUNIO
 * (Historial Consolidado) para contabilidad.
 *
 * Reglas inversas implementadas:
 * - Desagrupación de pagos fraccionados: 1 Venta con 3 Transacciones → 3 filas
 * - Restauración lógica IZIPAY: DETALLE = IZIPAY, monto en columna BCP
 * - Reconstrucción de prefijo DOCUMENTO: FT.DD.MM.YYYY para facturas
 *
 * @module excel-exporter
 */

import * as XLSX from 'xlsx';
import type {
  ParsedSale,
  ExportOptions,
  AccountingExportRow,
  ParsedTransaction,
} from './excel-types';
import {
  EXPORT_HEADERS,
  EXPORT_COLUMN_WIDTHS,
  EXPORT_DATE_FORMAT,
  EXPORT_NUMBER_FORMAT,
  IZIPAY_KEYWORD,
  FACTURA_PREFIX,
  BOLETA_PREFIX,
} from './excel-constants';

// ─────────────────────────────────────────────────────────────────
// UTILIDADES INTERNAS
// ─────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha nativa a string DD/MM/YYYY.
 */
function formatDateString(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Reconstruye el número de documento a partir del tipo y la fecha de emisión.
 * Ej: FACTURA, 2026-06-02 → "FT.02.06.2026"
 * Si ya existe un documentNumber original, lo prioriza.
 */
function reconstructDocumentNumber(sale: ParsedSale): string {
  // Si ya tenemos el documento original (ej. de una importación previa), usarlo
  if (sale.documentNumber) {
    return sale.documentNumber;
  }

  // Si no tenemos fecha de emisión, no podemos construir el formato completo
  if (!sale.issueDate) {
    return sale.documentType === 'FACTURA'
      ? `${FACTURA_PREFIX}.---`
      : sale.documentType === 'BOLETA'
      ? `${BOLETA_PREFIX}.---`
      : 'TICKET';
  }

  const d = String(sale.issueDate.getDate()).padStart(2, '0');
  const m = String(sale.issueDate.getMonth() + 1).padStart(2, '0');
  
  // Para facturas usualmente usan YYYY, para boletas a veces YY
  // Estandarizamos a YYYY para mayor claridad
  const y = sale.issueDate.getFullYear();

  if (sale.documentType === 'FACTURA') {
    return `${FACTURA_PREFIX}.${d}.${m}.${y}`;
  } else if (sale.documentType === 'BOLETA') {
    return `${BOLETA_PREFIX}.${d}.${m}.${y}`;
  }

  return 'TICKET';
}

/**
 * Construye la fila de exportación basada en una transacción específica.
 */
function buildExportRow(
  sale: ParsedSale,
  transaction: ParsedTransaction,
): AccountingExportRow {
  const isIzipay = transaction.paymentMethod === 'IZIPAY';

  // Regla IZIPAY: Si es Izipay, el detalle lleva la palabra IZIPAY
  // y el monto se coloca en la columna BCP.
  const baseDetalle = transaction.originalDetail || sale.detail || '';
  const detalle = isIzipay
    ? baseDetalle
      ? `${IZIPAY_KEYWORD} - ${baseDetalle}`
      : IZIPAY_KEYWORD
    : baseDetalle;

  return Object.freeze({
    // Usamos recordDate como la fecha de la fila en contabilidad
    fecha: sale.recordDate || new Date(),
    documento: reconstructDocumentNumber(sale),
    nombreRazonSocial: sale.customerName,
    detalle,
    bbva: transaction.paymentMethod === 'BBVA' ? transaction.amount : 0,
    bcp: transaction.paymentMethod === 'BCP' || isIzipay ? transaction.amount : 0,
    efectivo: transaction.paymentMethod === 'EFECTIVO' ? transaction.amount : 0,
    total: transaction.amount,
  });
}

/**
 * Construye una fila consolidada para ventas que no se deben desagregar.
 */
function buildAggregatedExportRow(sale: ParsedSale): AccountingExportRow {
  let bbva = 0;
  let bcp = 0;
  let efectivo = 0;
  let hasIzipay = false;

  for (const t of sale.transactions) {
    if (t.paymentMethod === 'BBVA') bbva += t.amount;
    if (t.paymentMethod === 'BCP') bcp += t.amount;
    if (t.paymentMethod === 'EFECTIVO') efectivo += t.amount;
    if (t.paymentMethod === 'IZIPAY') {
      bcp += t.amount; // IZIPAY va a BCP
      hasIzipay = true;
    }
  }

  const baseDetalle = sale.detail || '';
  const detalle = hasIzipay
    ? baseDetalle
      ? `${IZIPAY_KEYWORD} - ${baseDetalle}`
      : IZIPAY_KEYWORD
    : baseDetalle;

  return Object.freeze({
    fecha: sale.recordDate || new Date(),
    documento: reconstructDocumentNumber(sale),
    nombreRazonSocial: sale.customerName,
    detalle,
    bbva,
    bcp,
    efectivo,
    total: sale.total, // Usamos el total real de la venta
  });
}

// ─────────────────────────────────────────────────────────────────
// EXPORTADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────

/**
 * Exporta un listado de ventas al formato contable requerido por GOLTEX
 * (similar a BANCO JUNIO).
 *
 * @param sales - Array de ventas normalizadas
 * @param options - Opciones de configuración
 * @returns Workbook de XLSX listo para ser descargado o guardado
 */
export function exportToAccountingExcel(
  sales: readonly ParsedSale[],
  options: ExportOptions = {},
): XLSX.WorkBook {
  const {
    sheetName = 'REPORTE CONTABLE',
    disaggregateFractional = true,
    includeTotals = true,
    fromDate,
    toDate,
  } = options;

  // 1. Filtrar por fechas si se solicita
  let filteredSales = sales;
  if (fromDate || toDate) {
    filteredSales = sales.filter((sale) => {
      const saleDate = sale.recordDate;
      if (!saleDate) return true; // Si no tiene fecha, lo incluimos

      if (fromDate && saleDate.getTime() < fromDate.getTime()) return false;
      if (toDate && saleDate.getTime() > toDate.getTime()) return false;
      return true;
    });
  }

  // 2. Transformar a filas de exportación
  const exportRows: AccountingExportRow[] = [];
  let sumBbva = 0;
  let sumBcp = 0;
  let sumEfectivo = 0;
  let sumTotal = 0;

  for (const sale of filteredSales) {
    if (disaggregateFractional && sale.transactions.length > 0) {
      // Ordenar transacciones por secuencia para mantener consistencia
      const sortedTxns = [...sale.transactions].sort((a, b) => a.sequence - b.sequence);
      
      for (const txn of sortedTxns) {
        const row = buildExportRow(sale, txn);
        exportRows.push(row);
        
        sumBbva += row.bbva;
        sumBcp += row.bcp;
        sumEfectivo += row.efectivo;
        sumTotal += row.total;
      }
    } else {
      // Agregar como una sola fila consolidada
      const row = buildAggregatedExportRow(sale);
      exportRows.push(row);
      
      sumBbva += row.bbva;
      sumBcp += row.bcp;
      sumEfectivo += row.efectivo;
      sumTotal += row.total;
    }
  }

  // 3. Crear hoja de SheetJS
  // Mapear a objetos planos con las keys en el orden exacto del header
  const rawData = exportRows.map((row) => ({
    'FECHA': row.fecha,
    'DOCUMENTO': row.documento,
    'NOMBRE Y/O RAZON SOCIAL': row.nombreRazonSocial,
    'DETALLE': row.detalle,
    'BBVA': row.bbva > 0 ? row.bbva : null, // null para celdas vacías en vez de 0
    'BCP': row.bcp > 0 ? row.bcp : null,
    'EFECTIVO': row.efectivo > 0 ? row.efectivo : null,
    'TOTAL': row.total,
  }));

  if (includeTotals && exportRows.length > 0) {
    rawData.push({
      'FECHA': null as any,
      'DOCUMENTO': '',
      'NOMBRE Y/O RAZON SOCIAL': 'TOTALES',
      'DETALLE': '',
      'BBVA': sumBbva,
      'BCP': sumBcp,
      'EFECTIVO': sumEfectivo,
      'TOTAL': sumTotal,
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rawData, {
    header: [...EXPORT_HEADERS],
    dateNF: EXPORT_DATE_FORMAT,
  });

  // 4. Aplicar anchos de columna
  worksheet['!cols'] = [...EXPORT_COLUMN_WIDTHS];

  // 5. Aplicar formato numérico a las columnas de montos (E, F, G, H en 0-indexed: 4, 5, 6, 7)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:H1');
  
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    for (let C = 4; C <= 7; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
      const cell = worksheet[cellAddress];
      if (cell && typeof cell.v === 'number') {
        cell.z = EXPORT_NUMBER_FORMAT;
      }
    }
  }

  // 6. Crear workbook y empaquetar
  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, worksheet, sheetName);

  return newWorkbook;
}
