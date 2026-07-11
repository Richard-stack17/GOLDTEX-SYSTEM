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
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vista Previa del Ticket</span>
        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
          Ancho: {maxChars} cols
        </span>
      </div>
      <div className="bg-white text-black font-mono text-[11px] leading-[1.2] p-4 rounded-sm overflow-x-auto shadow-md border border-gray-200">
        <pre className="whitespace-pre">
          {renderLines()}
        </pre>
      </div>
    </div>
  );
}
