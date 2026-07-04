/**
 * ═══════════════════════════════════════════════════════════════════
 * GOLTEX S.A.C. — Excel Migration Types
 * ═══════════════════════════════════════════════════════════════════
 *
 * Interfaces que representan los 4 tipos de hojas del Excel legado,
 * los tipos de dominio para el sistema normalizado, y los tipos
 * auxiliares para el proceso de parseo/exportación.
 *
 * @module excel-types
 */

// ─────────────────────────────────────────────────────────────────
// 1. CLASIFICACIÓN DE HOJAS
// ─────────────────────────────────────────────────────────────────

/**
 * Tipo de hoja detectada en el workbook.
 *
 * - `DRAFT`            → Borradores de ventas rápidas (tickets internos)
 * - `CONSOLIDATED`     → Historial consolidado de ventas bancarias
 * - `CUSTOMER_CATALOG` → Maestro de clientes frecuentes (RUC)
 * - `CASH_REGISTER`    → Resumen financiero diario (caja)
 * - `UNKNOWN`          → Hoja no reconocida
 */
export type SheetClassification =
  | 'DRAFT'
  | 'CONSOLIDATED'
  | 'CUSTOMER_CATALOG'
  | 'CASH_REGISTER'
  | 'UNKNOWN';

/**
 * Información de una hoja clasificada del workbook.
 */
export interface ClassifiedSheet {
  readonly sheetName: string;
  readonly classification: SheetClassification;
  readonly sheetIndex: number;
  /** true si la hoja tiene columna DOCUMENTO (Hoja6 no la tiene) */
  readonly hasDocumentColumn: boolean;
}

// ─────────────────────────────────────────────────────────────────
// 2. FILAS CRUDAS DEL EXCEL (ORIGEN)
// ─────────────────────────────────────────────────────────────────

/**
 * Fila cruda de una hoja tipo BORRADOR (VENTA YURIKO, VENTA YURIKO 2, VNTA DIA ANTERIOR).
 * Columnas: TICKET, MONTO, SERVICIO, BANCO, TOTAL
 */
export interface DraftSaleRow {
  readonly ticket: string;
  readonly monto: number;
  readonly servicio: number;
  readonly banco: number;
  readonly total: number;
}

/**
 * Fila cruda de una hoja tipo HISTORIAL CONSOLIDADO.
 * Columnas: FECHA, DOCUMENTO, NOMBRE Y/O RAZON SOCIAL, DETALLE, BBVA, BCP, EFECTIVO, TOTAL
 *
 * Nota: Hoja6 NO tiene columna DOCUMENTO, en ese caso `documento` será null.
 */
export interface ConsolidatedRow {
  readonly fecha: Date | null;
  readonly documento: string | null;
  readonly nombreRazonSocial: string;
  readonly detalle: string;
  readonly bbva: number;
  readonly bcp: number;
  readonly efectivo: number;
  readonly total: number;
}

/**
 * Fila cruda de la hoja CATÁLOGO DE CLIENTES (RUC DE CLIENTES).
 * Columnas: Nombre de empresa, RUC
 */
export interface CustomerCatalogRow {
  readonly businessName: string;
  readonly ruc: string;
}

/**
 * Fila cruda de la hoja CAJA.
 * Columnas: SALDO INICIAL, IMPORTE, TOTAL VENTA DEL DIA, GASTOS
 */
export interface CashRegisterRow {
  readonly saldoInicial: number;
  readonly importe: number;
  readonly totalVentaDelDia: number;
  readonly gastos: number;
}

// ─────────────────────────────────────────────────────────────────
// 3. TIPOS DE DOMINIO NORMALIZADOS
// ─────────────────────────────────────────────────────────────────

/** Tipo de documento de venta */
export type DocumentType = 'FACTURA' | 'BOLETA' | 'TICKET';

/** Tipo de documento de identidad del cliente */
export type CustomerDocumentType = 'RUC' | 'DNI' | 'CE' | 'SIN_DOC';

/** Método de pago */
export type PaymentMethod = 'BBVA' | 'BCP' | 'EFECTIVO' | 'IZIPAY';

/** Tipo de origen de la venta */
export type SourceType = 'DRAFT' | 'CONSOLIDATED' | 'CASH';

/**
 * Información extraída del campo DOCUMENTO.
 *
 * Ejemplos:
 * - "FT.02.06.2026" → { type: 'FACTURA', issueDate: 2026-06-02, raw: 'FT.02.06.2026' }
 * - "BV.22.06.26"   → { type: 'BOLETA',  issueDate: 2026-06-22, raw: 'BV.22.06.26' }
 * - "12345"         → { type: 'TICKET',  issueDate: null,       raw: '12345' }
 */
export interface DocumentInfo {
  readonly type: DocumentType;
  readonly issueDate: Date | null;
  readonly raw: string;
}

/**
 * Cliente normalizado del sistema.
 */
export interface ParsedCustomer {
  readonly ruc: string | null;
  readonly businessName: string;
  readonly documentType: CustomerDocumentType;
  readonly isFrequent: boolean;
}

/**
 * Transacción de pago individual.
 * Puede ser parte de un pago fraccionado (múltiples transacciones por venta).
 */
export interface ParsedTransaction {
  readonly paymentMethod: PaymentMethod;
  readonly amount: number;
  readonly surchargePct: number;
  readonly surchargeAmount: number;
  readonly sequence: number;
  readonly originalDetail: string | null;
}

/**
 * Venta normalizada con sus transacciones agrupadas.
 */
export interface ParsedSale {
  readonly customerName: string;
  readonly documentNumber: string | null;
  readonly documentType: DocumentType;
  readonly issueDate: Date | null;
  readonly recordDate: Date | null;
  readonly detail: string | null;
  readonly total: number;
  readonly sourceSheet: string;
  readonly sourceType: SourceType;
  readonly isFractional: boolean;
  readonly transactions: readonly ParsedTransaction[];
}

/**
 * Registro de caja diaria normalizado.
 */
export interface ParsedCashRegister {
  readonly registerDate: Date | null;
  readonly openingBalance: number;
  readonly totalIncome: number;
  readonly totalSales: number;
  readonly totalExpenses: number;
}

// ─────────────────────────────────────────────────────────────────
// 4. RESULTADO DEL PARSEO
// ─────────────────────────────────────────────────────────────────

/** Nivel de severidad de un mensaje de parseo */
export type ParseSeverity = 'error' | 'warning' | 'info';

/**
 * Mensaje individual del proceso de parseo.
 */
export interface ParseMessage {
  readonly severity: ParseSeverity;
  readonly sheet: string;
  readonly row: number | null;
  readonly column: string | null;
  readonly message: string;
}

/**
 * Resultado genérico del parseo con datos, errores y warnings.
 */
export interface ParseResult<T> {
  readonly data: T;
  readonly messages: readonly ParseMessage[];
  readonly totalRows: number;
  readonly parsedRows: number;
  readonly skippedRows: number;
}

/**
 * Resultado completo del parseo de todo el workbook de GOLTEX.
 * Contiene los 4 conjuntos de datos normalizados + metadatos.
 */
export interface ParsedWorkbook {
  readonly sheets: readonly ClassifiedSheet[];
  readonly draftSales: ParseResult<readonly ParsedSale[]>;
  readonly consolidatedSales: ParseResult<readonly ParsedSale[]>;
  readonly customers: ParseResult<readonly ParsedCustomer[]>;
  readonly cashRegisters: ParseResult<readonly ParsedCashRegister[]>;
  readonly salesPreview: readonly ParsedSale[];
  readonly summary: WorkbookSummary;
}

/**
 * Resumen estadístico del workbook procesado.
 */
export interface WorkbookSummary {
  readonly totalSheets: number;
  readonly classifiedSheets: Record<SheetClassification, number>;
  readonly totalSales: number;
  readonly totalCustomers: number;
  readonly totalCashRegisters: number;
  readonly fractionalPayments: number;
  readonly izipayTransactions: number;
  readonly asyncDates: number;
  readonly emptyCustomers: number;
  readonly errors: number;
  readonly warnings: number;
}

// ─────────────────────────────────────────────────────────────────
// 5. OPCIONES DE EXPORTACIÓN
// ─────────────────────────────────────────────────────────────────

/**
 * Opciones para la exportación a Excel contable.
 */
export interface ExportOptions {
  /** Nombre de la hoja en el Excel exportado. Default: 'REPORTE CONTABLE' */
  readonly sheetName?: string;
  /** Si true, desagrega pagos fraccionados en filas separadas. Default: true */
  readonly disaggregateFractional?: boolean;
  /** Formato de fecha en la exportación. Default: 'DD/MM/YYYY' */
  readonly dateFormat?: string;
  /** Si true, incluye fila de totales al final. Default: true */
  readonly includeTotals?: boolean;
  /** Filtro de fecha inicial (inclusive) */
  readonly fromDate?: Date;
  /** Filtro de fecha final (inclusive) */
  readonly toDate?: Date;
}

/**
 * Fila de exportación en formato contable (BANCO JUNIO).
 */
export interface AccountingExportRow {
  readonly fecha: Date;
  readonly documento: string;
  readonly nombreRazonSocial: string;
  readonly detalle: string;
  readonly bbva: number;
  readonly bcp: number;
  readonly efectivo: number;
  readonly total: number;
}
