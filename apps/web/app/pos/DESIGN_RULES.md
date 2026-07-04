# GOLTEX POS — Reglas de Diseño y Negocio (NO MODIFICAR SIN APROBACIÓN)

## 1. Estructura de Datos (mock-data.ts)
- Las tarjetas de productos muestran: **[Código] [Nombre]** → Ej: `1.1 ENTRETELA DUECOTEX`
- Los códigos siguen el formato numérico: `1.1`, `1.2`, `7.1`, etc.
- Las familias tienen código simple: `1`, `2`, `7`, `8`, `9`, etc.
- **NUNCA** mostrar el campo `stock` en el catálogo (confidencial)
- **NUNCA** mostrar badges de "Disponible" / "Agotado"

## 2. Catálogo — Vista de Familias (Paso 1)
- Grid de tarjetas grandes en el área central
- Cada tarjeta muestra: número grande (Ej: `1`) + nombre (Ej: `Entretelas`)
- Paginación inferior con botones anchos: `[1-12]`, `[13-24]`, `[25-36]`, `[...]`
- NO usar chips horizontales arriba para filtrar familias
- **Teclado QWERTY Integrado**: Al tocar la barra de búsqueda, se abre un teclado alfanumérico táctil. Tiene una 'X' grande de color ROJO en la esquina superior derecha para cerrarlo sin borrar el texto. Abajo a la derecha incluye un botón 'BUSCAR' (Intro) para cerrar manteniendo los resultados.
- **Búsqueda Global (Omnisearch) y Paginación**: El buscador filtra simultáneamente Familias y Telas por Código y por Nombre. Muestra primero las Familias coincidentes y luego las Telas. Los resultados están paginados en grupos de 12 (ej. 1-12, 13-24) usando el mismo componente de paginación táctil. Al borrar o cerrar la búsqueda, regresa al Paso 1 (Familias).

## 3. Catálogo — Vista de Productos (Paso 2)
- Botón "← Volver a Familias" en la barra superior
- Tarjeta muestra: **[Código] [Nombre]** + precio base (S/ X.XX)
- **CERO** información de stock en esta vista

## 4. Modal (Centro de Control Táctil)
### Cabecera
- Mostrar: **[Código]** + Nombre de la tela → Ej: `7.1 | RASO COLOR`

### Celdas de Control
- **PRECIO FIJO** (izquierda, solo lectura): precio original de la base
- **PRECIO VARIABLE** (derecha, editable): cargado con el precio fijo inicial, permite regateo
- **METROS** (fila ancha inferior): solo números enteros, SIN decimales

### Colores de foco interactivos
- Campo activo "METROS": brilla en **esmeralda (green)**
- Campo activo "PRECIO VARIABLE": brilla en **índigo/azul (primary)**

### Teclado Numérico
- Tamaño reducido (botones h-16 en lugar de h-20)
- El punto `.` solo aplica cuando el foco está en PRECIO VARIABLE
- Solo acepta hasta 4 dígitos en METROS, 7 en PRECIO

### Vista Previa (debajo del teclado)
- Contenedor destacado con fondo, borde visible
- **IZQUIERDA**: `[Cantidad] MTS x S/ [Precio Variable]`
- **DERECHA**: `S/ [Subtotal]` — fuente grande, color verde/esmeralda

## 5. Carrito / Proforma (Panel Derecho)

### Fila de cada ítem (3 líneas):
- **Fila 1**: `[Código] [Nombre] - S/ [Precio Fijo]` — alineado a la IZQUIERDA
- **Fila 2**: `[Cantidad entera] MTS x S/ [Precio Variable Negociado]` — alineado a la IZQUIERDA
- **Fila 3**: `S/ [Subtotal]` — alineado a la DERECHA, fuente grande

### Controles
- Icono papelera al final de Fila 1 (alineado a la derecha de la línea)
- Al tocar cualquier parte de la fila → re-abre el Modal con datos precargados
- Flecha `>` en el borde derecho para indicar que la fila es táctil

### Separadores
- Línea punteada (`---...---`) al inicio de la lista y entre ítems o al final

## 6. Resumen Inferior del Carrito
- Mostrar SOLO: **SUBTOTAL** y **TOTAL** (mismo monto, sin IGV)
- **NO mostrar IGV** en ningún lado del módulo POS
- Los precios ya incluyen IGV (lo gestiona Starsoft externamente)

## 7. Cantidades
- Formato estrictamente **entero**: `1`, `2`, `5`, `12`
- **NUNCA** usar decimales: ~~`1.000`~~, ~~`1.00`~~
