/**
 * ═══════════════════════════════════════════════════════════════════
 * GOLTEX S.A.C. — Excel Constants & Configuration
 * ═══════════════════════════════════════════════════════════════════
 *
 * Constantes compartidas: mapeo de hojas, headers esperados,
 * patrones regex y configuración de columnas.
 *
 * @module excel-constants
 */

import type { SheetClassification } from './excel-types';

// ─────────────────────────────────────────────────────────────────
// 1. MAPEO DE HOJAS → CLASIFICACIÓN
// ─────────────────────────────────────────────────────────────────

/**
 * Mapeo exacto del nombre de hoja del Excel legado a su clasificación.
 * Las claves son los nombres tal cual aparecen en el workbook.
 */
export const SHEET_CLASSIFICATION_MAP: Readonly<Record<string, SheetClassification>> = {
  'VENTA YURIKO':     'DRAFT',
  'VENTA YURIKO 2':   'DRAFT',
  'VNTA DIA ANTERIOR': 'DRAFT',
  'BANCO JUNIO':      'CONSOLIDATED',
  'Hoja6':            'CONSOLIDATED',
  'Hoja 19':          'CONSOLIDATED',
  'Hoja11':           'CONSOLIDATED',
  'Hoja13':           'CONSOLIDATED',
  'Hoja14':           'CONSOLIDATED',
  'Hoja17':           'CONSOLIDATED',
  'RUC DE CLIENTES':  'CUSTOMER_CATALOG',
  'CAJA':             'CASH_REGISTER',
} as const;

/**
 * Hojas que NO tienen la columna DOCUMENTO en el historial consolidado.
 * En estas hojas, el parser omite la columna y establece documento = null.
 */
export const SHEETS_WITHOUT_DOCUMENT_COLUMN: ReadonlySet<string> = new Set([
  'Hoja6',
]);

// ─────────────────────────────────────────────────────────────────
// 2. HEADERS ESPERADOS POR TIPO DE HOJA
// ─────────────────────────────────────────────────────────────────

/** Headers de las hojas de borradores de ventas rápidas */
export const DRAFT_HEADERS = [
  'TICKET', 'MONTO', 'SERVICIO', 'BANCO', 'TOTAL',
] as const;

/** Headers de las hojas de historial consolidado (con DOCUMENTO) */
export const CONSOLIDATED_HEADERS_FULL = [
  'FECHA', 'DOCUMENTO', 'NOMBRE Y/O RAZON SOCIAL', 'DETALLE',
  'BBVA', 'BCP', 'EFECTIVO', 'TOTAL',
] as const;

/** Headers de las hojas de historial consolidado (sin DOCUMENTO, ej: Hoja6) */
export const CONSOLIDATED_HEADERS_NO_DOC = [
  'FECHA', 'NOMBRE Y/O RAZON SOCIAL', 'DETALLE',
  'BBVA', 'BCP', 'EFECTIVO', 'TOTAL',
] as const;

/** Headers de la hoja de catálogo de clientes (variable, 2 columnas) */
export const CUSTOMER_CATALOG_HEADERS = [
  'NOMBRE', 'RUC',
] as const;

/** Headers de la hoja de caja */
export const CASH_REGISTER_HEADERS = [
  'SALDO INICIAL', 'IMPORTE', 'TOTAL VENTA DEL DIA', 'GASTOS',
] as const;

// ─────────────────────────────────────────────────────────────────
// 3. REGEX PARA PARSEO DE DOCUMENTOS
// ─────────────────────────────────────────────────────────────────

/**
 * Regex para extraer tipo y fecha de un número de documento.
 *
 * Formatos soportados:
 * - FT.DD.MM.YYYY → Factura con fecha completa (4 dígitos año)
 * - FT.DD.MM.YY   → Factura con fecha abreviada (2 dígitos año)
 * - BV.DD.MM.YYYY → Boleta con fecha completa
 * - BV.DD.MM.YY   → Boleta con fecha abreviada
 *
 * Grupos de captura:
 * 1. Prefijo del tipo (FT o BV)
 * 2. Día (DD)
 * 3. Mes (MM)
 * 4. Año (YY o YYYY)
 */
export const DOCUMENT_DATE_REGEX = /^(FT|BV)\.(\d{2})\.(\d{2})\.(\d{2,4})$/i;

/**
 * Regex alternativa para documentos con formato sin puntos separadores.
 * Ej: FT020626, BV220626
 */
export const DOCUMENT_DATE_COMPACT_REGEX = /^(FT|BV)(\d{2})(\d{2})(\d{2,4})$/i;

// ─────────────────────────────────────────────────────────────────
// 4. CONSTANTES DE NEGOCIO
// ─────────────────────────────────────────────────────────────────

/** Nombre asignado a ventas sin cliente identificado */
export const DEFAULT_CUSTOMER_NAME = 'CLIENTE VARIOS' as const;

/** Palabra clave que indica pago por IZIPAY */
export const IZIPAY_KEYWORD = 'IZIPAY' as const;

/** Porcentaje de recargo de IZIPAY (4%) */
export const IZIPAY_SURCHARGE_PCT = 4.0 as const;

/** Prefijo de documento tipo Factura */
export const FACTURA_PREFIX = 'FT' as const;

/** Prefijo de documento tipo Boleta */
export const BOLETA_PREFIX = 'BV' as const;

/** Mapeo de prefijo de documento a tipo */
export const DOCUMENT_TYPE_MAP: Readonly<Record<string, 'FACTURA' | 'BOLETA'>> = {
  'FT': 'FACTURA',
  'BV': 'BOLETA',
} as const;

// ─────────────────────────────────────────────────────────────────
// 5. CONFIGURACIÓN DE EXPORTACIÓN
// ─────────────────────────────────────────────────────────────────

/** Headers de la hoja de exportación contable (formato BANCO JUNIO) */
export const EXPORT_HEADERS = [
  'FECHA',
  'DOCUMENTO',
  'NOMBRE Y/O RAZON SOCIAL',
  'DETALLE',
  'BBVA',
  'BCP',
  'EFECTIVO',
  'TOTAL',
] as const;

/** Anchos de columna por defecto para la exportación (en caracteres) */
export const EXPORT_COLUMN_WIDTHS: readonly { readonly wch: number }[] = [
  { wch: 12 },  // FECHA
  { wch: 18 },  // DOCUMENTO
  { wch: 35 },  // NOMBRE Y/O RAZON SOCIAL
  { wch: 20 },  // DETALLE
  { wch: 12 },  // BBVA
  { wch: 12 },  // BCP
  { wch: 12 },  // EFECTIVO
  { wch: 12 },  // TOTAL
] as const;

/**
 * Formato numérico para montos en la exportación.
 * Dos decimales, separador de miles con coma.
 */
export const EXPORT_NUMBER_FORMAT = '#,##0.00' as const;

/** Formato de fecha para la exportación */
export const EXPORT_DATE_FORMAT = 'DD/MM/YYYY' as const;
