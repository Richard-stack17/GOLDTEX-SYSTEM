# Lógica de Contabilidad — Vista previa y Excel

Reglas transparentes alineadas con el Excel de GOLTEX. Sin inferencias ni doble conteo.

## Columna DETALLE

- La etiqueta de DETALLE se decide con esta prioridad estricta:
  1. Si el origen de la venta trae `IZIPAY` (`source_type` o `payment_method`), DETALLE = `IZIPAY`.
  2. Si no es IZIPAY y hay saldo en BCP, DETALLE = `BCP`.
  3. Si no es IZIPAY y no hay BCP, pero hay saldo en BBVA, DETALLE = `BBVA`.
  4. Únicamente si no hay banco y sí hay EFECTIVO, DETALLE = `EFECTIVO`.
- El banco manda sobre el efectivo: si una fila tiene banco + efectivo, la etiqueta será banco.
- **No** se usan concatenaciones ni etiquetas mixtas (`BBVA / BCP`).

## Columnas numéricas (BBVA, BCP, EFECTIVO)

| Columna   | Origen en BD                                              |
|-----------|-----------------------------------------------------------|
| BBVA      | Suma de `transactions.amount` donde `payment_method = 'BBVA'` |
| BCP       | Suma de `payment_method = 'BCP'` **más** suma de `payment_method = 'IZIPAY'` (regla Excel: el monto IZIPAY se muestra en columna BCP) |
| EFECTIVO  | Suma de `transactions.amount` donde `payment_method = 'EFECTIVO'` |

Los montos vienen de la BD; no se alteran según la etiqueta DETALLE.

## Columna TOTAL

Fórmula única y estricta por fila:

```
TOTAL = BBVA + BCP + EFECTIVO
```

- Usar **exactamente** los valores mostrados en esas tres columnas.
- **Nunca** sumar IZIPAY por separado si ya está incluido en BCP.
- **Nunca** usar `sale.total` de la cabecera como sustituto del total de fila.

## Exportación Excel

- Columnas: FECHA, DOCUMENTO, NOMBRE Y (O) RAZON, DETALLE, BBVA, BCP, TOTAL.
- DETALLE = mismo valor que la vista previa (`payment_method` desde BD).
- TOTAL de fila = `BBVA + BCP + EFECTIVO` (igual que en pantalla).
- Fila TOTALES = suma de cada columna numérica y suma de totales de fila.

## Ejemplo IZIPAY

| BD (`payment_method`) | DETALLE | BBVA | BCP  | EFECTIVO | TOTAL |
|-----------------------|---------|------|------|----------|-------|
| IZIPAY, amount 8.90   | IZIPAY  | 0    | 8.90 | 0        | 8.90  |

El monto IZIPAY aparece en columna BCP (regla Excel), pero DETALLE dice `IZIPAY` porque así está en la BD.
