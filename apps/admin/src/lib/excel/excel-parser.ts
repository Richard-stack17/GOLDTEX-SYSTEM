/**
 * ═══════════════════════════════════════════════════════════════════
 * GOLTEX S.A.C. — Excel Parser
 * ═══════════════════════════════════════════════════════════════════
 *
 * Función robusta que recibe un Workbook de XLSX, clasifica las 12 hojas,
 * aplica limpieza de datos y agrupa pagos fraccionados según las reglas
 * de negocio de GOLTEX.
 *
 * Reglas implementadas:
 * - Clasificación automática de hojas por nombre
 * - Extracción de fecha asíncrona del campo DOCUMENTO (FT.DD.MM.YYYY / BV.DD.MM.YY)
 * - Agrupación de pagos fraccionados (mismo DOCUMENTO en filas consecutivas)
 * - Detección de pagos IZIPAY con recargo del 4%
 * - Fallback a "CLIENTE VARIOS" para nombres vacíos
 * - Soporte para Hoja6 (sin columna DOCUMENTO)
 *
 * @module excel-parser
 */

import * as XLSX from 'xlsx';
import type {
  ClassifiedSheet,
  SheetClassification,
  DraftSaleRow,
  ConsolidatedRow,
  CustomerCatalogRow,
  CashRegisterRow,
  DocumentInfo,
  ParsedCustomer,
  ParsedTransaction,
  ParsedSale,
  ParsedCashRegister,
  ParseResult,
  ParsedWorkbook,
  ParseMessage,
  ParseSeverity,
  PaymentMethod,
  WorkbookSummary,
} from './excel-types';
import {
  SHEET_CLASSIFICATION_MAP,
  SHEETS_WITHOUT_DOCUMENT_COLUMN,
  DOCUMENT_DATE_REGEX,
  DOCUMENT_DATE_COMPACT_REGEX,
  DOCUMENT_TYPE_MAP,
  DEFAULT_CUSTOMER_NAME,
  IZIPAY_KEYWORD,
  IZIPAY_SURCHARGE_PCT,
} from './excel-constants';

// ─────────────────────────────────────────────────────────────────
// UTILIDADES INTERNAS
// ─────────────────────────────────────────────────────────────────

/**
 * Crea un mensaje de parseo inmutable.
 */
function createMessage(
  severity: ParseSeverity,
  sheet: string,
  row: number | null,
  column: string | null,
  message: string,
): ParseMessage {
  return Object.freeze({ severity, sheet, row, column, message });
}

/**
 * Convierte un valor de celda a número. Retorna 0 si no es numérico.
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Convierte un valor de celda a string, limpio y trimmed.
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Normaliza un nombre de razón social.
 * - Trim de espacios
 * - Conversión a mayúsculas
 * - Si vacío, retorna el nombre de cliente por defecto
 */
function sanitizeCustomerName(value: unknown): string {
  const name = toString(value).toUpperCase();
  return name.length > 0 ? name : DEFAULT_CUSTOMER_NAME;
}

/**
 * Intenta parsear una fecha de Excel.
 * XLSX puede representar fechas como números seriales o como strings.
 */
function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;

  // Si es un Date nativo
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // Si es un número serial de Excel
  if (typeof value === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return new Date(parsed.y, parsed.m - 1, parsed.d);
      }
    } catch {
      // fall through
    }
  }

  // Si es un string de fecha
  if (typeof value === 'string') {
    // Formato DD/MM/YYYY
    const ddmmyyyy = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1]!, 10);
      const month = parseInt(ddmmyyyy[2]!, 10);
      let year = parseInt(ddmmyyyy[3]!, 10);
      if (year < 100) year += 2000;
      return new Date(year, month - 1, day);
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// 1. CLASIFICACIÓN DE HOJAS
// ─────────────────────────────────────────────────────────────────

/**
 * Clasifica una hoja del workbook por su nombre.
 */
function classifySheet(sheetName: string, index: number): ClassifiedSheet {
  const upperName = sheetName.toUpperCase();
  
  if (upperName.includes('CAJA') || upperName.includes('YURIKO') || upperName.includes('VNTA DIA ANTERIOR')) {
    return Object.freeze({
      sheetName,
      classification: 'UNKNOWN' as SheetClassification,
      sheetIndex: index,
      hasDocumentColumn: false,
    });
  }

  const classification: SheetClassification =
    SHEET_CLASSIFICATION_MAP[sheetName] ?? 'UNKNOWN';

  const hasDocumentColumn =
    classification === 'CONSOLIDATED'
      ? !SHEETS_WITHOUT_DOCUMENT_COLUMN.has(sheetName)
      : false;

  return Object.freeze({
    sheetName,
    classification,
    sheetIndex: index,
    hasDocumentColumn,
  });
}

/**
 * Clasifica todas las hojas del workbook.
 */
function classifyAllSheets(workbook: XLSX.WorkBook): readonly ClassifiedSheet[] {
  return Object.freeze(
    workbook.SheetNames.map((name, idx) => classifySheet(name, idx)),
  );
}

// ─────────────────────────────────────────────────────────────────
// 2. PARSER DE DOCUMENTO (FECHA ASÍNCRONA)
// ─────────────────────────────────────────────────────────────────

/**
 * Extrae tipo de documento y fecha del campo DOCUMENTO.
 *
 * @example
 * parseDocumentInfo("FT.02.06.2026")
 * // → { type: 'FACTURA', issueDate: Date(2026-06-02), raw: 'FT.02.06.2026' }
 *
 * parseDocumentInfo("BV.22.06.26")
 * // → { type: 'BOLETA', issueDate: Date(2026-06-22), raw: 'BV.22.06.26' }
 *
 * parseDocumentInfo("12345")
 * // → { type: 'TICKET', issueDate: null, raw: '12345' }
 */
export function parseDocumentInfo(documento: string | null): DocumentInfo {
  if (!documento || documento.trim() === '') {
    return Object.freeze({ type: 'TICKET' as const, issueDate: null, raw: '' });
  }

  const raw = documento.trim();

  // Intentar formato con puntos: FT.DD.MM.YYYY o BV.DD.MM.YY
  const matchDot = raw.match(DOCUMENT_DATE_REGEX);
  if (matchDot) {
    const prefix = matchDot[1]!.toUpperCase();
    const day = parseInt(matchDot[2]!, 10);
    const month = parseInt(matchDot[3]!, 10);
    let year = parseInt(matchDot[4]!, 10);
    if (year < 100) year += 2000;

    const docType = DOCUMENT_TYPE_MAP[prefix] ?? 'TICKET' as const;
    const issueDate = new Date(year, month - 1, day);

    return Object.freeze({ type: docType, issueDate, raw });
  }

  // Intentar formato compacto: FT020626 o BV220626
  const matchCompact = raw.match(DOCUMENT_DATE_COMPACT_REGEX);
  if (matchCompact) {
    const prefix = matchCompact[1]!.toUpperCase();
    const day = parseInt(matchCompact[2]!, 10);
    const month = parseInt(matchCompact[3]!, 10);
    let year = parseInt(matchCompact[4]!, 10);
    if (year < 100) year += 2000;

    const docType = DOCUMENT_TYPE_MAP[prefix] ?? 'TICKET' as const;
    const issueDate = new Date(year, month - 1, day);

    return Object.freeze({ type: docType, issueDate, raw });
  }

  // Solo prefijo sin fecha (ej: "FT-001234")
  const prefixOnly = raw.match(/^(FT|BV)/i);
  if (prefixOnly) {
    const prefix = prefixOnly[1]!.toUpperCase();
    const docType = DOCUMENT_TYPE_MAP[prefix] ?? 'TICKET' as const;
    return Object.freeze({ type: docType, issueDate: null, raw });
  }

  return Object.freeze({ type: 'TICKET' as const, issueDate: null, raw });
}

// ─────────────────────────────────────────────────────────────────
// 3. DETECTOR IZIPAY
// ─────────────────────────────────────────────────────────────────

/**
 * Detecta si una fila tiene pago por IZIPAY.
 * Se considera IZIPAY si el campo DETALLE o BANCO contiene la palabra "IZIPAY".
 */
function isIzipayPayment(detalle: string, banco?: string): boolean {
  const upperDetalle = detalle.toUpperCase();
  const upperBanco = (banco ?? '').toUpperCase();
  return upperDetalle.includes(IZIPAY_KEYWORD) || upperBanco.includes(IZIPAY_KEYWORD);
}

// ─────────────────────────────────────────────────────────────────
// 4. PARSERS POR TIPO DE HOJA
// ─────────────────────────────────────────────────────────────────

/**
 * Convierte un worksheet de XLSX a un array de objetos JS,
 * omitiendo filas completamente vacías.
 */
function sheetToRawRows(
  workbook: XLSX.WorkBook,
  sheetName: string,
): Record<string, unknown>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  // 1. Búsqueda dinámica de la fila de encabezados
  const rangeRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
  });

  let headerRowIndex = 0;
  let found = false;

  for (let idx = 0; idx < Math.min(rangeRows.length, 25); idx++) {
    const row = rangeRows[idx];
    if (Array.isArray(row)) {
      const rowStrings = row.map(cell => String(cell || '').trim().toUpperCase());
      const hasTotalOrMonto = rowStrings.some(val => val === 'TOTAL' || val === 'MONTO');
      const hasRucOrCliente = rowStrings.some(val => val.includes('RUC') || val.includes('CLIENTE') || val.includes('NOMBRE') || val.includes('RAZON'));
      
      if (hasTotalOrMonto || hasRucOrCliente) {
        headerRowIndex = idx;
        found = true;
        break;
      }
    }
  }

  // 2. Lectura con rango
  const options: XLSX.Sheet2JSONOpts = {
    defval: null,
    raw: false,
    dateNF: 'DD/MM/YYYY',
  };
  if (found) {
    options.range = headerRowIndex;
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, options);

  // 3. Mapeo flexible y normalización de columnas
  const normalizedRows = rows.map(row => {
    const newRow: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      const upperKey = key.trim().toUpperCase();
      let mappedKey = upperKey;

      if (upperKey.includes('FECHA')) {
        mappedKey = 'FECHA';
      } else if (upperKey.includes('RUC')) {
        mappedKey = 'RUC';
      } else if (upperKey.includes('RAZON') || upperKey.includes('CLIENTE') || (upperKey.includes('NOMBRE') && !upperKey.includes('CONTACTO'))) {
        mappedKey = 'NOMBRE Y/O RAZON SOCIAL';
      } else if (upperKey.includes('DOCUMENTO') || upperKey.includes('TICKET')) {
        mappedKey = 'DOCUMENTO';
      } else if (upperKey.includes('DETALLE') || upperKey.includes('CONCEPTO') || upperKey.includes('GLOSA')) {
        mappedKey = 'DETALLE';
      } else if (upperKey === 'TOTAL' || upperKey === 'MONTO') {
        mappedKey = 'TOTAL';
      } else if (upperKey.includes('BBVA')) {
        mappedKey = 'BBVA';
      } else if (upperKey.includes('BCP') && !upperKey.includes('YAPE')) {
        mappedKey = 'BCP';
      } else if (upperKey.includes('EFECTIVO')) {
        mappedKey = 'EFECTIVO';
      } else if (upperKey.includes('YAPE') || upperKey.includes('BCP YAPE')) {
        mappedKey = 'BCP YAPE';
      }

      newRow[mappedKey] = row[key];
    }
    return newRow;
  });

  // Filtrar filas completamente vacías
  return normalizedRows.filter((row) =>
    Object.values(row).some((v) => v !== null && v !== undefined && v !== ''),
  );
}

/**
 * Parsea hojas de tipo BORRADOR (VENTA YURIKO, VENTA YURIKO 2, VNTA DIA ANTERIOR).
 */
function parseDraftSheet(
  workbook: XLSX.WorkBook,
  sheet: ClassifiedSheet,
): ParseResult<readonly DraftSaleRow[]> {
  const messages: ParseMessage[] = [];
  const rawRows = sheetToRawRows(workbook, sheet.sheetName);
  const data: DraftSaleRow[] = [];
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]!;
    const rowNum = i + 2; // +2 porque fila 1 es header, y es 1-indexed

    const ticket = toString(row['TICKET']);
    if (!ticket) {
      messages.push(createMessage('warning', sheet.sheetName, rowNum, 'TICKET', 'Ticket vacío, fila omitida'));
      skipped++;
      continue;
    }

    data.push(Object.freeze({
      ticket,
      monto: toNumber(row['MONTO']),
      servicio: toNumber(row['SERVICIO']),
      banco: toNumber(row['BANCO']),
      total: toNumber(row['TOTAL']),
    }));
  }

  return Object.freeze({
    data: Object.freeze(data),
    messages: Object.freeze(messages),
    totalRows: rawRows.length,
    parsedRows: data.length,
    skippedRows: skipped,
  });
}

/**
 * Parsea hojas de tipo HISTORIAL CONSOLIDADO (BANCO JUNIO, Hoja6, Hoja 19, etc.).
 * Maneja el caso especial de Hoja6 que no tiene columna DOCUMENTO.
 */
function parseConsolidatedSheet(
  workbook: XLSX.WorkBook,
  sheet: ClassifiedSheet,
): ParseResult<readonly ConsolidatedRow[]> {
  const messages: ParseMessage[] = [];
  const rawRows = sheetToRawRows(workbook, sheet.sheetName);
  const data: ConsolidatedRow[] = [];
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]!;
    const rowNum = i + 2;

    const total = toNumber(row['TOTAL'] ?? row['MONTO']);
    const bbva = toNumber(row['BBVA']);
    const bcp = toNumber(row['BCP'] ?? row['BCP YAPE'] ?? row['YAPE']);
    const efectivo = toNumber(row['EFECTIVO']);

    if (total === 0) {
      skipped++;
      continue;
    }

    const fechaRaw = row['FECHA'];
    const fecha = parseExcelDate(fechaRaw);

    if (!fecha && fechaRaw) {
      messages.push(createMessage('warning', sheet.sheetName, rowNum, 'FECHA',
        `Fecha no parseada: "${fechaRaw}"`));
    }

    const documento = sheet.hasDocumentColumn
      ? toString(row['DOCUMENTO']) || null
      : null;

    data.push(Object.freeze({
      fecha,
      documento,
      nombreRazonSocial: sanitizeCustomerName(row['NOMBRE Y/O RAZON SOCIAL']),
      detalle: toString(row['DETALLE']),
      bbva,
      bcp,
      efectivo,
      total,
    }));
  }

  return Object.freeze({
    data: Object.freeze(data),
    messages: Object.freeze(messages),
    totalRows: rawRows.length,
    parsedRows: data.length,
    skippedRows: skipped,
  });
}

/**
 * Parsea la hoja CATÁLOGO DE CLIENTES (RUC DE CLIENTES).
 *
 * Esta hoja tiene un formato variable — puede tener diferentes nombres de columna.
 * Asumimos 2 columnas: la primera es el nombre, la segunda es el RUC.
 */
function parseCustomerCatalogSheet(
  workbook: XLSX.WorkBook,
  sheet: ClassifiedSheet,
): ParseResult<readonly CustomerCatalogRow[]> {
  const messages: ParseMessage[] = [];
  const rawRows = sheetToRawRows(workbook, sheet.sheetName);

  const data: CustomerCatalogRow[] = [];
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]!;
    const rowNum = i + 2;

    const businessName = sanitizeCustomerName(row['NOMBRE Y/O RAZON SOCIAL']);
    const ruc = toString(row['RUC'] ?? row['DOCUMENTO']);

    if (businessName === DEFAULT_CUSTOMER_NAME && !ruc) {
      skipped++;
      continue;
    }

    // Validar RUC peruano (11 dígitos)
    if (ruc && !/^\d{11}$/.test(ruc)) {
      messages.push(createMessage('warning', sheet.sheetName, rowNum, 'RUC',
        `RUC con formato inválido: "${ruc}"`));
    }

    data.push(Object.freeze({
      businessName,
      ruc: ruc || '',
    }));
  }

  return Object.freeze({
    data: Object.freeze(data),
    messages: Object.freeze(messages),
    totalRows: rawRows.length,
    parsedRows: data.length,
    skippedRows: skipped,
  });
}

/**
 * Parsea la hoja CAJA.
 */
function parseCashRegisterSheet(
  workbook: XLSX.WorkBook,
  sheet: ClassifiedSheet,
): ParseResult<readonly CashRegisterRow[]> {
  const messages: ParseMessage[] = [];
  const rawRows = sheetToRawRows(workbook, sheet.sheetName);
  const data: CashRegisterRow[] = [];
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]!;

    const saldoInicial = toNumber(row['SALDO INICIAL']);
    const importe = toNumber(row['IMPORTE']);
    const totalVentaDelDia = toNumber(row['TOTAL VENTA DEL DIA']);
    const gastos = toNumber(row['GASTOS']);

    // Omitir filas completamente en cero
    if (saldoInicial === 0 && importe === 0 && totalVentaDelDia === 0 && gastos === 0) {
      skipped++;
      continue;
    }

    data.push(Object.freeze({
      saldoInicial,
      importe,
      totalVentaDelDia,
      gastos,
    }));
  }

  return Object.freeze({
    data: Object.freeze(data),
    messages: Object.freeze(messages),
    totalRows: rawRows.length,
    parsedRows: data.length,
    skippedRows: skipped,
  });
}

// ─────────────────────────────────────────────────────────────────
// 5. TRANSFORMACIÓN A VENTAS NORMALIZADAS
// ─────────────────────────────────────────────────────────────────

/**
 * Determina el método de pago de una fila consolidada.
 * Prioridad: IZIPAY → BBVA → BCP → EFECTIVO
 */
function determinePaymentTransactions(
  row: ConsolidatedRow,
  sequence: number,
): readonly ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const isIzipay = isIzipayPayment(row.detalle);

  if (isIzipay) {
    // IZIPAY: todo el monto va como IZIPAY, con recargo del 4%
    // El monto se registra en columna BCP al exportar
    const amount = row.bcp || row.total;
    transactions.push(Object.freeze({
      paymentMethod: 'IZIPAY' as PaymentMethod,
      amount,
      surchargePct: IZIPAY_SURCHARGE_PCT,
      surchargeAmount: Math.round((amount * IZIPAY_SURCHARGE_PCT / 100) * 100) / 100,
      sequence,
      originalDetail: row.detalle || null,
    }));
  } else {
    // Pagos normales: registrar cada método con monto > 0
    if (row.bbva > 0) {
      transactions.push(Object.freeze({
        paymentMethod: 'BBVA' as PaymentMethod,
        amount: row.bbva,
        surchargePct: 0,
        surchargeAmount: 0,
        sequence,
        originalDetail: row.detalle || null,
      }));
    }
    if (row.bcp > 0) {
      transactions.push(Object.freeze({
        paymentMethod: 'BCP' as PaymentMethod,
        amount: row.bcp,
        surchargePct: 0,
        surchargeAmount: 0,
        sequence,
        originalDetail: row.detalle || null,
      }));
    }
    if (row.efectivo > 0) {
      transactions.push(Object.freeze({
        paymentMethod: 'EFECTIVO' as PaymentMethod,
        amount: row.efectivo,
        surchargePct: 0,
        surchargeAmount: 0,
        sequence,
        originalDetail: row.detalle || null,
      }));
    }

    // Si no hay ningún monto específico pero sí hay total, registrar como efectivo
    if (transactions.length === 0 && row.total > 0) {
      transactions.push(Object.freeze({
        paymentMethod: 'EFECTIVO' as PaymentMethod,
        amount: row.total,
        surchargePct: 0,
        surchargeAmount: 0,
        sequence,
        originalDetail: row.detalle || null,
      }));
    }
  }

  return Object.freeze(transactions);
}

/**
 * Convierte filas de borrador a ventas normalizadas.
 */
function draftRowsToSales(
  rows: readonly DraftSaleRow[],
  sheetName: string,
): readonly ParsedSale[] {
  return Object.freeze(
    rows.map((row) => {
      const transactions: ParsedTransaction[] = [];

      if (row.banco > 0) {
        transactions.push(Object.freeze({
          paymentMethod: 'BCP' as PaymentMethod,
          amount: row.banco,
          surchargePct: 0,
          surchargeAmount: 0,
          sequence: 1,
          originalDetail: null,
        }));
      }
      if (row.servicio > 0) {
        transactions.push(Object.freeze({
          paymentMethod: 'EFECTIVO' as PaymentMethod,
          amount: row.servicio,
          surchargePct: 0,
          surchargeAmount: 0,
          sequence: transactions.length + 1,
          originalDetail: null,
        }));
      }
      if (transactions.length === 0 && row.total > 0) {
        transactions.push(Object.freeze({
          paymentMethod: 'EFECTIVO' as PaymentMethod,
          amount: row.total,
          surchargePct: 0,
          surchargeAmount: 0,
          sequence: 1,
          originalDetail: null,
        }));
      }

      return Object.freeze({
        customerName: DEFAULT_CUSTOMER_NAME,
        documentNumber: row.ticket || null,
        documentType: 'TICKET' as const,
        issueDate: null,
        recordDate: null,
        detail: null,
        total: row.total,
        sourceSheet: sheetName,
        sourceType: 'DRAFT' as const,
        isFractional: false,
        transactions: Object.freeze(transactions),
      });
    }),
  );
}

/**
 * Agrupa pagos fraccionados: filas consecutivas con el mismo DOCUMENTO
 * se fusionan en una sola venta con múltiples transacciones.
 */
function groupFractionalPayments(
  rows: readonly ConsolidatedRow[],
  sheetName: string,
  messages: ParseMessage[],
): readonly ParsedSale[] {
  const sales: ParsedSale[] = [];
  let i = 0;

  while (i < rows.length) {
    const currentRow = rows[i]!;
    const docInfo = parseDocumentInfo(currentRow.documento);

    // Detectar grupo fraccionado: mismo documento en filas consecutivas
    const group: ConsolidatedRow[] = [currentRow];

    if (currentRow.documento && currentRow.documento.trim() !== '') {
      let j = i + 1;
      while (j < rows.length) {
        const nextRow = rows[j]!;
        if (
          nextRow.documento &&
          nextRow.documento.trim() === currentRow.documento.trim()
        ) {
          group.push(nextRow);
          j++;
        } else {
          break;
        }
      }
    }

    const isFractional = group.length > 1;

    if (isFractional) {
      messages.push(createMessage('info', sheetName, i + 2, 'DOCUMENTO',
        `Pago fraccionado detectado: ${group.length} filas para "${currentRow.documento}"`));
    }

    // Construir transacciones del grupo
    const allTransactions: ParsedTransaction[] = [];
    let groupTotal = 0;

    for (let seqIdx = 0; seqIdx < group.length; seqIdx++) {
      const groupRow = group[seqIdx]!;
      const txns = determinePaymentTransactions(groupRow, seqIdx + 1);
      allTransactions.push(...txns);
      groupTotal += groupRow.total;
    }

    // Usar la fecha de la primera fila del grupo como fecha de registro
    const recordDate = currentRow.fecha;

    sales.push(Object.freeze({
      customerName: currentRow.nombreRazonSocial,
      documentNumber: currentRow.documento || null,
      documentType: docInfo.type,
      issueDate: docInfo.issueDate,
      recordDate,
      detail: currentRow.detalle || null,
      total: groupTotal,
      sourceSheet: sheetName,
      sourceType: 'CONSOLIDATED' as const,
      isFractional,
      transactions: Object.freeze(allTransactions),
    }));

    // Avanzar al siguiente grupo
    i += group.length;
  }

  return Object.freeze(sales);
}

/**
 * Convierte filas de caja a registros normalizados.
 */
function cashRowsToRegisters(
  rows: readonly CashRegisterRow[],
): readonly ParsedCashRegister[] {
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        registerDate: null, // La hoja CAJA no tiene fecha explícita por fila
        openingBalance: row.saldoInicial,
        totalIncome: row.importe,
        totalSales: row.totalVentaDelDia,
        totalExpenses: row.gastos,
      }),
    ),
  );
}

/**
 * Convierte filas de catálogo a clientes normalizados.
 */
function catalogRowsToCustomers(
  rows: readonly CustomerCatalogRow[],
): readonly ParsedCustomer[] {
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        ruc: row.ruc || null,
        businessName: row.businessName,
        documentType: row.ruc ? ('RUC' as const) : ('SIN_DOC' as const),
        isFrequent: true,
      }),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────
// 6. FUNCIÓN PRINCIPAL — PARSER DEL WORKBOOK
// ─────────────────────────────────────────────────────────────────

/**
 * Parsea un workbook completo de Excel de GOLTEX S.A.C.
 *
 * Recibe un workbook de la librería XLSX, clasifica automáticamente las 12 hojas,
 * aplica limpieza de datos, agrupa pagos fraccionados y genera un resultado
 * normalizado con errores y warnings.
 *
 * @param workbook - Workbook de XLSX ya cargado
 * @returns Resultado completo del parseo con las 4 categorías de datos
 *
 * @example
 * ```typescript
 * import * as XLSX from 'xlsx';
 * import { parseGoltexWorkbook } from './excel-parser';
 *
 * const workbook = XLSX.readFile('goltex-historico.xlsx');
 * const result = parseGoltexWorkbook(workbook);
 *
 * console.log(`Ventas consolidadas: ${result.consolidatedSales.data.length}`);
 * console.log(`Clientes: ${result.customers.data.length}`);
 * console.log(`Errores: ${result.summary.errors}`);
 * ```
 */
export function parseGoltexWorkbook(workbook: XLSX.WorkBook): ParsedWorkbook {
  // 1. Clasificar todas las hojas
  const sheets = classifyAllSheets(workbook);

  // 2. Parsear cada tipo de hoja
  const draftSheets = sheets.filter((s) => s.classification === 'DRAFT');
  const consolidatedSheets = sheets.filter((s) => s.classification === 'CONSOLIDATED');
  const catalogSheets = sheets.filter((s) => s.classification === 'CUSTOMER_CATALOG');
  const cashSheets = sheets.filter((s) => s.classification === 'CASH_REGISTER');

  // ─── BORRADORES ────────────────────────────────────────────────
  const allDraftMessages: ParseMessage[] = [];
  const allDraftSales: ParsedSale[] = [];
  let draftTotalRows = 0;
  let draftParsedRows = 0;
  let draftSkippedRows = 0;

  for (const draftSheet of draftSheets) {
    const result = parseDraftSheet(workbook, draftSheet);
    allDraftMessages.push(...result.messages);
    allDraftSales.push(...draftRowsToSales(result.data, draftSheet.sheetName));
    draftTotalRows += result.totalRows;
    draftParsedRows += result.parsedRows;
    draftSkippedRows += result.skippedRows;
  }

  const draftSalesResult: ParseResult<readonly ParsedSale[]> = Object.freeze({
    data: Object.freeze(allDraftSales),
    messages: Object.freeze(allDraftMessages),
    totalRows: draftTotalRows,
    parsedRows: draftParsedRows,
    skippedRows: draftSkippedRows,
  });

  // ─── HISTORIAL CONSOLIDADO ─────────────────────────────────────
  const allConsolidatedMessages: ParseMessage[] = [];
  const allConsolidatedSales: ParsedSale[] = [];
  let consolidatedTotalRows = 0;
  let consolidatedParsedRows = 0;
  let consolidatedSkippedRows = 0;

  for (const consolSheet of consolidatedSheets) {
    const result = parseConsolidatedSheet(workbook, consolSheet);
    allConsolidatedMessages.push(...result.messages);
    const sales = groupFractionalPayments(
      result.data,
      consolSheet.sheetName,
      allConsolidatedMessages,
    );
    allConsolidatedSales.push(...sales);
    consolidatedTotalRows += result.totalRows;
    consolidatedParsedRows += result.parsedRows;
    consolidatedSkippedRows += result.skippedRows;
  }

  // Deduplicación en memoria por DOCUMENTO para inserción segura (UPSERT)
  const uniqueSalesMap = new Map<string, ParsedSale>();
  for (const sale of allConsolidatedSales) {
    if (sale.documentNumber && sale.documentNumber.trim() !== '') {
      uniqueSalesMap.set(sale.documentNumber.trim().toUpperCase(), sale);
    } else {
      // Si no tiene documento (por ejemplo tickets de caja sin doc), lo mantenemos (se insertará normal o se ignora en page.tsx)
      uniqueSalesMap.set(Math.random().toString(), sale); 
    }
  }
  const deduplicatedConsolidatedSales = Array.from(uniqueSalesMap.values());

  const consolidatedSalesResult: ParseResult<readonly ParsedSale[]> = Object.freeze({
    data: Object.freeze(deduplicatedConsolidatedSales),
    messages: Object.freeze(allConsolidatedMessages),
    totalRows: consolidatedTotalRows,
    parsedRows: deduplicatedConsolidatedSales.length,
    skippedRows: consolidatedSkippedRows,
  });

  // ─── CATÁLOGO DE CLIENTES ──────────────────────────────────────
  const allCustomerMessages: ParseMessage[] = [];
  const allCustomers: ParsedCustomer[] = [];
  let customerTotalRows = 0;
  let customerParsedRows = 0;
  let customerSkippedRows = 0;

  for (const catSheet of catalogSheets) {
    const result = parseCustomerCatalogSheet(workbook, catSheet);
    allCustomerMessages.push(...result.messages);
    allCustomers.push(...catalogRowsToCustomers(result.data));
    customerTotalRows += result.totalRows;
    customerParsedRows += result.parsedRows;
    customerSkippedRows += result.skippedRows;
  }

  // Deduplicación en memoria por RUC para inserción segura (UPSERT)
  const uniqueCustomersMap = new Map<string, ParsedCustomer>();
  for (const customer of allCustomers) {
    if (customer.ruc && customer.ruc.trim() !== '') {
      uniqueCustomersMap.set(customer.ruc.trim(), customer);
    } else {
      uniqueCustomersMap.set(Math.random().toString(), customer);
    }
  }
  const deduplicatedCustomers = Array.from(uniqueCustomersMap.values());

  const customersResult: ParseResult<readonly ParsedCustomer[]> = Object.freeze({
    data: Object.freeze(deduplicatedCustomers),
    messages: Object.freeze(allCustomerMessages),
    totalRows: customerTotalRows,
    parsedRows: deduplicatedCustomers.length,
    skippedRows: customerSkippedRows,
  });

  // ─── CAJA ──────────────────────────────────────────────────────
  const allCashMessages: ParseMessage[] = [];
  const allCashRegisters: ParsedCashRegister[] = [];
  let cashTotalRows = 0;
  let cashParsedRows = 0;
  let cashSkippedRows = 0;

  for (const cashSheet of cashSheets) {
    const result = parseCashRegisterSheet(workbook, cashSheet);
    allCashMessages.push(...result.messages);
    allCashRegisters.push(...cashRowsToRegisters(result.data));
    cashTotalRows += result.totalRows;
    cashParsedRows += result.parsedRows;
    cashSkippedRows += result.skippedRows;
  }

  const cashRegistersResult: ParseResult<readonly ParsedCashRegister[]> = Object.freeze({
    data: Object.freeze(allCashRegisters),
    messages: Object.freeze(allCashMessages),
    totalRows: cashTotalRows,
    parsedRows: cashParsedRows,
    skippedRows: cashSkippedRows,
  });

  // ─── RESUMEN ───────────────────────────────────────────────────
  const allMessages = [
    ...allDraftMessages,
    ...allConsolidatedMessages,
    ...allCustomerMessages,
    ...allCashMessages,
  ];

  const summary: WorkbookSummary = Object.freeze({
    totalSheets: sheets.length,
    classifiedSheets: Object.freeze({
      DRAFT: draftSheets.length,
      CONSOLIDATED: consolidatedSheets.length,
      CUSTOMER_CATALOG: catalogSheets.length,
      CASH_REGISTER: cashSheets.length,
      UNKNOWN: sheets.filter((s) => s.classification === 'UNKNOWN').length,
    }),
    totalSales: allDraftSales.length + deduplicatedConsolidatedSales.length,
    totalCustomers: deduplicatedCustomers.length,
    totalCashRegisters: allCashRegisters.length,
    fractionalPayments: allConsolidatedSales.filter((s) => s.isFractional).length,
    izipayTransactions: [
      ...allDraftSales,
      ...allConsolidatedSales,
    ].reduce(
      (count, sale) =>
        count + sale.transactions.filter((t) => t.paymentMethod === 'IZIPAY').length,
      0,
    ),
    asyncDates: allConsolidatedSales.filter(
      (s) => s.issueDate !== null && s.recordDate !== null &&
             s.issueDate.getTime() !== s.recordDate.getTime(),
    ).length,
    emptyCustomers: allConsolidatedSales.filter(
      (s) => s.customerName === DEFAULT_CUSTOMER_NAME,
    ).length,
    errors: allMessages.filter((m) => m.severity === 'error').length,
    warnings: allMessages.filter((m) => m.severity === 'warning').length,
  });

  return Object.freeze({
    sheets,
    draftSales: draftSalesResult,
    consolidatedSales: consolidatedSalesResult,
    customers: customersResult,
    cashRegisters: cashRegistersResult,
    salesPreview: Object.freeze(deduplicatedConsolidatedSales.slice(0, 10)),
    summary,
  });
}
