Especificación del Formato de Voucher (ESC/POS)

Reglas Generales
- Fuente: Forzar Fuente A (Estándar 80mm) con comando [0x1B, 0x4D, 0x00].
- Ancho: Definido por la variable dinámica maxChars (42 o 48).
- Alineación: Calcular espacios intermedios matemáticamente: maxChars - textoIzq.length - textoDer.length.

Layout Estricto
[CENTRO] PROFORMA
[IZQ] Empleado: {nombre_empleado}
========================================== (Ancho maxChars)
[IZQ] {codigo} {nombre_producto} x S/. {precio_fijo}
[IZQ] {cantidad} {unidad} x S/{precio_variable}   [DER] S/ {total_item}
------------------------------------------ (Opcional entre items)
[IZQ] TOTAL FINAL                     [DER] S/ {total_venta}
[CENTRO] PROFORMA
[IZQ] {DD/MM/YYYY HH:mm}
[IZQ] TKT-{Nro_Doc} - Caja 1
