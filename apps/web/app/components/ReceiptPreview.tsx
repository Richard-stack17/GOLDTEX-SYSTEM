import React from 'react';
import { generateTicketLines, TicketLine, DEFAULT_TEST_SALE_DATA } from '../configuracion/utils/printerEngine';

interface ReceiptPreviewProps {
  maxChars: number;
  paperWidth?: number;
  saleData?: any;
}

export default function ReceiptPreview({
  maxChars,
  paperWidth = 80,
  saleData = DEFAULT_TEST_SALE_DATA
}: ReceiptPreviewProps) {
  const safeCols = Math.min(90, Math.max(20, Number(maxChars) || (paperWidth <= 58 ? 32 : 48)));
  const is58mm = paperWidth <= 58;
  const isCondensed = safeCols >= 60;
  const lines: TicketLine[] = generateTicketLines(saleData, safeCols);

  // Calibración exacta del tamaño de fuente monoespaciada para emular los puntos (dots) térmicos:
  // Font A (hardware 12×24 dots): En 80mm estándar es de 11px (48 cols). Si se eligen 32 o 42 cols con Font A, la letra conserva su tamaño grande (11px) ocupando el bloque izquierdo de la bobina.
  // Font B (hardware 9×17 dots, >= 60 cols): La letra se condensa a 8.2px.
  const computedFontSize = isCondensed
    ? 8.2
    : is58mm
      ? 11
      : safeCols > 48
        ? Math.max(7.2, Math.min(11, Math.round((318 / (safeCols * 0.6)) * 10) / 10))
        : 11;

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Encabezado con información del rollo y tipografía */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider truncate">
          Vista Previa del Ticket (Fiel a Impresión)
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-border">
            Rollo: {is58mm ? '58mm' : '80mm'}
          </span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            {safeCols} columnas
          </span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
            isCondensed
              ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800'
              : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
          }`}>
            {isCondensed ? 'Font B (Condensada)' : 'Font A (Grande)'}
          </span>
        </div>
      </div>

      {/* Contenedor del área de papel térmico */}
      <div className="bg-secondary/30 p-2 sm:p-4 rounded-2xl w-full border border-border overflow-x-auto">
        {/* Bobina de papel físico con ancho fijo y centrado seguro mx-auto */}
        <div
          className={`bg-white text-black font-mono py-5 px-3.5 rounded-xl shadow-md border border-gray-300 relative transition-all select-none mx-auto overflow-hidden ${
            is58mm ? 'w-[260px] min-w-[260px]' : 'w-[350px] min-w-[350px]'
          }`}
        >
          {/* Simulación del corte superior del papel */}
          <div className="border-b-2 border-dashed border-gray-300 mb-3 pb-1 text-center text-[9px] font-sans font-semibold text-gray-400 uppercase tracking-widest">
            --- CORTE DE PAPEL ({is58mm ? '58 MM' : '80 MM'}) ---
          </div>

          {/* Bloque de impresión exacto acotado por los caracteres configurados */}
          <div
            style={{ fontSize: `${computedFontSize}px`, lineHeight: 1.25 }}
            className="flex flex-col font-mono text-black font-semibold w-full"
          >
            {lines.map((line, index) => {
              const isProformaHeader = line.text === 'PROFORMA';
              const isTotalFinal = line.text.startsWith('TOTAL');
              const isCentered = line.align === 'center';

              if (isProformaHeader) {
                return (
                  <div key={index} className="w-full text-center font-black text-sm tracking-widest uppercase my-1 text-black">
                    PROFORMA
                  </div>
                );
              }

              if (isTotalFinal) {
                const parts = line.text.split('S/');
                const label = parts[0]?.trim() || 'TOTAL';
                const amount = parts[1] ? `S/ ${parts[1].trim()}` : '';
                const totalTextSize = Math.round(computedFontSize * 1.25);

                return (
                  <div
                    key={index}
                    style={{ width: `${safeCols}ch`, maxWidth: '100%' }}
                    className="self-start my-1.5"
                  >
                    <div
                      style={{ fontSize: `${totalTextSize}px` }}
                      className="w-full py-1 border-y border-dashed border-gray-400 font-black text-black flex justify-between items-baseline whitespace-nowrap select-none"
                    >
                      <span className="tracking-tight">{label}</span>
                      <span className="tracking-tight">{amount}</span>
                    </div>
                  </div>
                );
              }

              if (isCentered) {
                return (
                  <div
                    key={index}
                    className="w-full text-center whitespace-pre text-black min-h-[1.25em]"
                  >
                    {line.text || '\u00A0'}
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  style={{ width: `${safeCols}ch`, maxWidth: '100%' }}
                  className={`self-start whitespace-pre text-left min-h-[1.25em] ${line.align === 'right' ? 'text-right' : ''}`}
                >
                  {line.text || '\u00A0'}
                </div>
              );
            })}
          </div>

          {/* Simulación del corte inferior del papel */}
          <div className="border-t-2 border-dashed border-gray-300 mt-4 pt-2 text-center text-[9px] font-sans font-semibold text-gray-400 uppercase tracking-widest">
            --- FIN DEL TICKET ---
          </div>
        </div>
      </div>
    </div>
  );
}
