import React from 'react';
import { generateTicketLines, TicketLine } from '../configuracion/utils/printerEngine';

interface ReceiptPreviewProps {
  maxChars: number;
  saleData: any;
}

export default function ReceiptPreview({ maxChars, saleData }: ReceiptPreviewProps) {
  const lines: TicketLine[] = generateTicketLines(saleData, maxChars);

  // Función auxiliar para centrar texto manualmente en la UI
  const padCenter = (text: string) => {
    if (text.length >= maxChars) return text.substring(0, maxChars);
    const leftPadding = Math.floor((maxChars - text.length) / 2);
    const rightPadding = maxChars - text.length - leftPadding;
    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
  };
  
  const padRight = (text: string) => {
    if (text.length >= maxChars) return text.substring(0, maxChars);
    return text.padStart(maxChars, ' ');
  };

  const renderLines = () => {
    return lines.map((line) => {
      if (line.align === 'center') return padCenter(line.text);
      if (line.align === 'right') return padRight(line.text);
      return line.text; // left is just text as it is already maxChars long with padding
    }).join('\n');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1">
        <span className="text-slate-400 font-medium text-xs tracking-wider">VISTA PREVIA DEL TICKET</span>
        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
          Ancho: {maxChars} cols
        </span>
      </div>
      <div className="bg-slate-50 p-4 rounded-lg w-full flex justify-center border border-slate-100">
        <div className="bg-white text-black font-mono text-[11px] leading-[1.2] py-4 px-2 rounded-sm shadow-xl border border-gray-300 max-w-[320px] mx-auto w-full flex justify-center overflow-hidden relative">
          {/* Borde dentado superior simulado (opcional, visual) */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjQiPjxwb2x5Z29uIGZpbGw9IiNmZmZmZmYiIHBvaW50cz0iMCwwIDQsNCA4LDAiLz48L3N2Zz4=')] opacity-50"></div>
          <pre className="whitespace-pre text-left bg-white text-black font-mono">
            {renderLines()}
          </pre>
        </div>
      </div>
    </div>
  );
}
