import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import ContabilidadTableRow from './ContabilidadTableRow';
import { ExcelRow } from '../types';

export default function ContabilidadTable({
  filteredRows,
  handleSaveRow,
  isEditingRef,
  displayDate,
  inlineCellCls,
  showToast,
  showFullEfectivo,
  setShowFullEfectivo,
  toggleFullscreen,
  isFullscreen,
  tableWrapperRef
}: any) {
  const totales = filteredRows.reduce((acc: any, r: ExcelRow) => ({
    bbva: acc.bbva + (Number(r.BBVA) || 0),
    bcp: acc.bcp + (Number(r.BCP) || 0),
    efectivo: acc.efectivo + (Number(r.EFECTIVO) || 0),
    total: acc.total + (Number(r.TOTAL) || 0)
  }), { bbva: 0, bcp: 0, efectivo: 0, total: 0 });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Vista previa de ventas</h2>
          <p className="text-xs text-gray-400 mt-0.5">Clic en cualquier celda para editar · Enter o Tab para guardar</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showFullEfectivo}
              onChange={(e) => setShowFullEfectivo(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="text-xs font-bold text-gray-700">Mostrar 100% Efectivo</span>
          </label>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
          </button>
        </div>
      </div>

      <div ref={tableWrapperRef} className={`overflow-x-auto ${isFullscreen ? 'bg-white p-4 overflow-y-auto' : ''}`}>
        <table className="min-w-max w-full text-xs">
          <thead className="bg-[#FACC15] border-b border-gray-300 text-gray-800">
            <tr>
              {['FECHA', 'DOCUMENTO', 'NOMBRE Y (O) RAZON', 'DETALLE', 'BBVA', 'BCP', 'EFECTIVO', 'TOTAL', 'COMENTARIO'].map(col => {
                const isNum = ['BBVA', 'BCP', 'EFECTIVO', 'TOTAL'].includes(col);
                return (
                  <th key={col} className={`px-4 py-2.5 font-extrabold whitespace-nowrap uppercase tracking-wider ${isNum ? 'text-right' : 'text-left'}`}>{col}</th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((row: ExcelRow) => (
              <ContabilidadTableRow 
                key={row.id}
                row={row}
                onSaveRow={handleSaveRow}
                isEditingRef={isEditingRef}
                displayDate={displayDate}
                inlineCellCls={inlineCellCls}
                showToast={showToast}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50/60 dark:bg-blue-950/40 border-t-2 border-b-2 border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 font-bold tracking-wide">
              <td className="px-4 py-2.5"></td>
              <td className="px-2 py-2.5"></td>
              <td className="px-2 py-2.5"></td>
              <td className="px-4 py-2.5 text-right font-extrabold uppercase">TOTALES</td>
              <td className="px-2 py-2.5 text-right">{totales.bbva.toFixed(2)}</td>
              <td className="px-2 py-2.5 text-right">{totales.bcp.toFixed(2)}</td>
              <td className="px-2 py-2.5 text-right">{totales.efectivo.toFixed(2)}</td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap">S/ {totales.total.toFixed(2)}</td>
              <td className="px-2 py-2.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
