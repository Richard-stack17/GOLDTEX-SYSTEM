# Módulo de Contabilidad - G-SYSTEM ERP

Este documento detalla la lógica de negocio, arquitectura y algoritmos de estado implementados en el módulo de Contabilidad (`app/contabilidad`).

## 1. Arquitectura Modular

El módulo está dividido en los siguientes componentes para evitar cuellos de botella de renderizado y facilitar el mantenimiento:

- **`page.tsx`**: Componente principal que actúa como contenedor de estado (State Provider). Maneja la carga de datos (Supabase), los filtros (fechas, vista de efectivo completo), las suscripciones en tiempo real y la exportación a Excel.
- **`components/ContabilidadTable.tsx`**: Componente visual puro que renderiza la estructura de la tabla (encabezados, sumatorias) e itera sobre las filas.
- **`components/ContabilidadTableRow.tsx`**: Componente altamente interactivo y encapsulado para cada venta. Contiene el `Row Buffer` que permite editar localmente los montos y validarlos antes de impactar la base de datos.
- **`types.ts`**: Contiene la definición global de `ExcelRow`, que es la abstracción unificada de una fila en la UI.

## 2. Abstracción y Carga de Datos (`mapSale`)

Los datos vienen de dos tablas en Supabase: `sales` y su relación uno a muchos `transactions`.
La función `mapSale` consolida esto en una sola fila `ExcelRow`:

- Extrae y suma todas las transacciones de `BBVA`, `BCP`, `EFECTIVO` y `IZIPAY`.
- **Regla del BCP Combinado**: Para facilitar la vista del cajero, la columna visual de "BCP" en realidad muestra `(BCP + IZIPAY)`.
- El campo `DETALLE` indica qué bancos se usaron (ej. `BCP`, `IZIPAY`, `BCP / BBVA` o `EFECTIVO` por defecto).
- Si hay un comprobante (Factura o Boleta), se reemplaza el número de documento interno por el formato SUNAT (ej. `FT-00123`).

## 3. Buffer de Fila (Edición Libre sin Interrupciones)

Se implementó el patrón arquitectónico de **Row Buffer** en `ContabilidadTableRow`:

- Cuando la fila recibe foco, copia los montos exactos en un estado local temporal `rowBuffer`.
- El usuario tiene **libertad absoluta** de escribir y borrar números en los campos de pago sin que se disparen alertas tempranas. El `onChange` de los inputs solo actualiza el estado temporal.
- Las columnas numéricas tienen bloqueado el signo menos (`-`), garantizando importes positivos. La columna `COMENTARIO` sí permite guiones libremente.

## 4. Candado Matemático (Validación estricta al guardar)

La única forma de persistir los datos a Supabase es presionar la tecla `Enter`. En ese momento se activa la validación:

- Suma exacta: `Number(bcp) + Number(bbva) + Number(efectivo)`.
- Igualdad: `sumaPagos.toFixed(2) === Number(row.TOTAL).toFixed(2)`.
- Si el importe **NO** cuadra, la acción se aborta, se levanta un *Toast de error* al usuario, el input pierde el foco (`blur`) y **los campos se revierten** a los valores previos limpios obtenidos de la DB.
- Tecla `Escape`: Invalida cualquier escritura actual y restaura el buffer.

## 5. Reglas de Negocio Específicas para IZIPAY

Si una fila tiene la etiqueta `IZIPAY` en su detalle, se aplican reglas estrictas de consistencia:

- **Restricción UI**: La columna `BBVA` queda inhabilitada (fondo gris) para impedir transferencias combinadas.
- **Respeto Histórico**: Pese al bloqueo, si la fila en la BD tenía un monto residual/histórico en `BBVA`, *no se fuerza a cero*, evitando alterar sumatorias previas.
- **Enrutamiento del Guardado**: Aunque el usuario digita el importe de tarjeta IZIPAY sobre el campo (visual) de "BCP", el guardado de la fila (en `page.tsx`) detecta inteligentemente la etiqueta IZIPAY.
  - Guarda el número en el método `IZIPAY` real.
  - Envía el método `BCP` clásico a valor 0 (borrándolo de la DB para evitar transacciones duplicadas fantasma).

## 6. Sincronización Inmediata (Opción A)

Para brindar sensación de instantaneidad al usuario:
Cuando la actualización a Supabase tiene éxito, el método `handleSaveRow` en el padre (`page.tsx`) **modifica el estado local (`previewRows`) directamente** y reemplaza los datos de la fila editada (incluyendo el recálculo al instante de los tags del `DETALLE`). 
Se evita así tener que ejecutar un `fetch` pesado o un spinner de recarga. Supabase Realtime funciona en el fondo como respaldo de seguridad.

## 7. Exportación a Excel y Cálculos de Sumatoria

La generación del Excel se alimenta puramente del estado visible `previewRows`.

- Se usan los totales calculados al vuelo (`totals` y `visibleTotals`) dependiendo de si el checkbox *"Mostrar 100% Efectivo"* está marcado.
- Se hace uso intensivo de `xlsx-js-style` para pintar las celdas resultantes:
  - Las cabeceras llevan fondo amarillo (`#FACC15`).
  - La columna `BBVA` va en Azul Puro.
  - La columna `BCP` (y montos combinados) va en Rojo.
  - La gran sumatoria total al pie queda marcada en color Verde Oscuro.
- La fecha mostrada se formatea a `DD/MM/YY` para que el archivo de Excel la parsee numéricamente de forma correcta.
