# Especificación de Negocio — GOLTEX S.A.C.

> **Fuente de Verdad** — Este documento define el contrato de diseño del sistema POS y Contabilidad para Goltex S.A.C. Todo desarrollo futuro debe respetar estas reglas.

---

## 1. Estrategia General: Corte Limpio

- La base de datos Supabase parte **limpia y vacía**.
- No hay migración de datos históricos del Excel legado.
- Toda la data se genera en tiempo real desde el POS.
- Los reportes contables se exportan desde el panel de administración.

---

## 2. Punto de Venta (POS)

### 2.1 Ticket Diario
- El correlativo de despacho (ej. `#1`, `#2`, `#3`) se **reinicia a 1 cada mañana**.
- Se calcula dinámicamente consultando `SELECT COUNT(*) FROM sales WHERE record_date = TODAY`.
- Es de uso **interno logístico** (control de corte y despacho de tela). No es un número fiscal.

### 2.2 Cliente por Defecto
- Al registrar un pedido, **NO se solicitan datos del cliente** (DNI, Nombre).
- Se registra automáticamente como **"CLIENTE VARIOS"** en la tabla `customers`.
- Aplica a ventas menores a **S/. 700** (venta rápida en mostrador).

### 2.3 Métodos de Pago
| Método | Código BD | Recargo |
|---|---|---|
| Efectivo | `EFECTIVO` | 0% |
| BCP / Yape / Transferencia BCP | `BCP` | 0% |
| BBVA / Plin / Transferencia BBVA | `BBVA` | 0% |
| Izipay (POS físico) | `IZIPAY` | +4.00% sobre el total |

- El recargo de Izipay se muestra visualmente antes de confirmar y se guarda en `transactions.surcharge_pct` y `transactions.surcharge_amount`.

### 2.4 Impresión de Ticket
- Tras confirmar el cobro, el sistema dispara `window.print()` automáticamente.
- El ticket impreso es un formato térmico de **80mm**.
- **Leyenda obligatoria:** `PROFORMA - NO VÁLIDO COMO COMPROBANTE DE PAGO`
- El ticket muestra: Número de Ticket (grande), lista de ítems, total, método de pago.

### 2.5 Anulación de Borrador
- Mientras un pedido NO ha sido cobrado, el operador puede presionar **"Descartar"** para eliminarlo.
- El descarte es **solo en memoria** — no deja ningún registro en la base de datos.

---

## 3. Contabilidad / Exportación

### 3.1 Flujo
- El administrador selecciona un **rango de fechas** (Fecha Inicio / Fecha Fin).
- Presiona **"Exportar Historial Consolidado (Excel)"**.
- El sistema consulta Supabase uniendo `sales` + `transactions` + `customers`.
- Se descarga un archivo `.xlsx` con el historial.

### 3.2 Formato de Exportación
El Excel generado debe tener exactamente estas columnas:

| FECHA | DOCUMENTO | NOMBRE Y (O) RAZON | DETALLE | BBVA | BCP | EFECTIVO | IZIPAY | TOTAL |
|---|---|---|---|---|---|---|---|---|

- **FECHA:** `sales.issue_date`
- **DOCUMENTO:** `sales.document_number`
- **NOMBRE Y (O) RAZON:** `customers.business_name`
- **DETALLE:** `sales.detail`
- **BBVA/BCP/EFECTIVO/IZIPAY:** monto de la transacción del método correspondiente (0 si no aplica)
- **TOTAL:** suma matemática exacta de las columnas de bancos de esa fila

---

## 4. Tablas Supabase Relevantes

```sql
-- Clientes
customers (id, ruc, business_name, document_type, is_frequent)

-- Ventas (cabecera)
sales (id, customer_id, document_number, document_type, issue_date, record_date, detail, total, source_sheet, source_type, is_fractional)

-- Transacciones (desglose de pago)
transactions (id, sale_id, payment_method, amount, surcharge_pct, surcharge_amount, sequence, original_detail)
```
