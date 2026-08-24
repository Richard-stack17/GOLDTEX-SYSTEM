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
  const lines: TicketLine[] = generateTicketLines(saleData, safeCols);

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Encabezado con información del rollo */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider truncate">
          Vista Previa del Ticket
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-border">
            Rollo: {is58mm ? '58mm' : '80mm'}
          </span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            {safeCols} columnas
          </span>
        </div>
      </div>

      {/* Contenedor del área de papel térmico (overflow-x-auto sin data-loss en la izquierda) */}
      <div className="bg-secondary/30 p-2 sm:p-4 rounded-2xl w-full border border-border overflow-x-auto">
        {/* Bobina de papel físico con ancho fijo y centrado seguro mx-auto */}
        <div 
          className={`bg-white text-black font-mono text-[11px] leading-[1.3] py-5 px-3.5 rounded-xl shadow-md border border-gray-300 relative transition-all select-none mx-auto ${
            is58mm ? 'w-[260px] min-w-[260px]' : 'w-[350px] min-w-[350px]'
          }`}
        >
          {/* Simulación del corte superior del papel */}
          <div className="border-b-2 border-dashed border-gray-300 mb-3 pb-1 text-center text-[9px] font-sans font-semibold text-gray-400 uppercase tracking-widest">
            --- CORTE DE PAPEL ({is58mm ? '58 MM' : '80 MM'}) ---
          </div>

          {/* Bloque de impresión exacto acotado por los caracteres configurados */}
          <div 
            style={{ width: `${safeCols}ch`, maxWidth: '100%' }}
            className="flex flex-col font-mono text-[11px] leading-[1.3] text-black"
          >
            {lines.map((line, index) => {
              const isProformaHeader = line.text === 'PROFORMA';
              const isTotalFinal = line.text.startsWith('TOTAL');

              if (isProformaHeader) {
                return (
                  <div key={index} className="text-center font-black text-sm tracking-widest uppercase my-1 text-black">
                    PROFORMA
                  </div>
                );
              }

              if (isTotalFinal) {
                const parts = line.text.split('S/');
                const label = parts[0]?.trim() || 'TOTAL';
                const amount = parts[1] ? `S/ ${parts[1].trim()}` : '';

                return (
                  <div 
                    key={index} 
                    className="w-full my-2 py-1.5 border-y border-dashed border-gray-400 font-black text-xs sm:text-sm tracking-tight text-black flex justify-between items-center whitespace-nowrap select-none"
                  >
                    <span>{label}</span>
                    <span>{amount}</span>
                  </div>
                );
              }

              return (
                <div 
                  key={index} 
                  className={`whitespace-pre ${
                    line.align === 'center' 
                      ? 'text-center' 
                      : line.align === 'right' 
                        ? 'text-right' 
                        : 'text-left'
                  } ${line.text.startsWith('TKT-') ? 'font-bold mt-1 text-center' : ''}`}
                >
                  {line.text}
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
