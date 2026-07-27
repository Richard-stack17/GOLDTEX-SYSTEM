import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function ContabilidadTableRow({
  row,
  onSaveRow,
  isEditingRef,
  displayDate,
  inlineCellCls,
  showToast
}: any) {
  const initialBuffer = {
    documento: row.DOCUMENTO || '',
    nombre: row['NOMBRE Y (O) RAZON'] || '',
    bbva: (!row.BBVA || isNaN(row.BBVA)) ? '' : String(row.BBVA),
    bcp: (!row.BCP || isNaN(row.BCP)) ? '' : String(row.BCP),
    efectivo: (!row.EFECTIVO || isNaN(row.EFECTIVO)) ? '' : String(row.EFECTIVO),
    comentario: row.COMENTARIO || ''
  };

  const [rowBuffer, setRowBuffer] = useState(initialBuffer);
  const [isFocusedRow, setIsFocusedRow] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isIzipay = row.DETALLE?.includes('IZIPAY');

  useEffect(() => {
    if (!isFocusedRow) {
      setRowBuffer(initialBuffer);
    }
  }, [row, isFocusedRow]);

  const handleFocus = () => {
    setIsFocusedRow(true);
    isEditingRef.current = true;
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!document.activeElement?.closest(`#contabilidad-row-${row.id}`)) {
        setIsFocusedRow(false);
        isEditingRef.current = false;
      }
    }, 0);
  };

  // Instant real-time sum checking
  const bcpVal = Number(rowBuffer.bcp) || 0;
  const bbvaVal = Number(rowBuffer.bbva) || 0;
  const efecVal = Number(rowBuffer.efectivo) || 0;
  const currentSum = Math.round((bcpVal + bbvaVal + efecVal) * 100) / 100;
  const totalVal = Math.round((Number(row.TOTAL) || 0) * 100) / 100;
  const isMismatch = isFocusedRow && (Math.abs(currentSum - totalVal) >= 0.01);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const targetInput = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (isMismatch) {
        showToast("La suma de los pagos debe ser exactamente igual al total del ticket", "error");
        setRowBuffer(initialBuffer);
        targetInput?.blur();
        return;
      }

      setIsSaving(true);
      try {
        const success = await onSaveRow(row.id, rowBuffer, isIzipay);
        if (!success) {
          setRowBuffer(initialBuffer);
        }
      } finally {
        setIsSaving(false);
      }
      targetInput?.blur();
    }
    if (e.key === 'Escape') {
      setRowBuffer(initialBuffer);
      targetInput?.blur();
    }
  };

  const handleChange = (field: string, val: string) => {
    if (['bcp', 'bbva', 'efectivo'].includes(field) && val.includes('-')) return;
    setRowBuffer(prev => ({ ...prev, [field]: val }));
  };

  const mismatchInputCls = isMismatch
    ? 'border-rose-400 focus:border-rose-500 bg-rose-50/60 text-rose-900'
    : '';

  return (
    <tr id={`contabilidad-row-${row.id}`} className={`transition-colors font-bold text-gray-800 ${isSaving ? 'bg-amber-50/50 opacity-70' : 'hover:bg-indigo-50/30'}`} onFocus={handleFocus} onBlur={handleBlur}>
      <td className="px-4 py-1.5 whitespace-nowrap font-mono text-gray-600 flex items-center gap-1.5">
        {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />}
        <span>{displayDate(row.FECHA)}</span>
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[140px]">
        <input disabled={isSaving} type="text" placeholder="Asignar doc..." value={rowBuffer.documento} onChange={e => handleChange('documento', e.target.value)} onKeyDown={handleKeyDown} className={`${inlineCellCls} font-mono`} />
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[180px]">
        <input disabled={isSaving} type="text" list="clientes-list" value={rowBuffer.nombre} onChange={e => handleChange('nombre', e.target.value)} onKeyDown={handleKeyDown} className={inlineCellCls} />
      </td>
      <td className="px-4 py-1.5 whitespace-nowrap">
        <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
          row.DETALLE === 'BBVA' ? 'bg-blue-100 text-blue-700'
          : row.DETALLE === 'BCP' ? 'bg-orange-100 text-orange-700'
          : row.DETALLE === 'IZIPAY' ? 'bg-cyan-100 text-cyan-700'
          : row.DETALLE?.includes(' / ') ? 'bg-purple-100 text-purple-700'
          : 'text-gray-400'
        }`}>{row.DETALLE}</span>
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
        <input 
          disabled={isSaving}
          type="number" step="0.01" placeholder="0.00" 
          value={rowBuffer.bbva} 
          onChange={e => handleChange('bbva', e.target.value)} 
          onKeyDown={handleKeyDown} 
          className={`${inlineCellCls} text-right text-blue-700 [&::-webkit-inner-spin-button]:appearance-none ${mismatchInputCls}`}
        />
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
        <input 
          disabled={isSaving || isIzipay} 
          readOnly={isIzipay}
          type="number" step="0.01" placeholder="0.00" 
          value={rowBuffer.bcp} 
          onChange={e => {
            if (isIzipay) return;
            handleChange('bcp', e.target.value);
          }} 
          onKeyDown={handleKeyDown} 
          className={`${inlineCellCls} text-right text-orange-700 [&::-webkit-inner-spin-button]:appearance-none ${isIzipay ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 opacity-75 font-semibold' : ''} ${mismatchInputCls}`}
        />
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
        <input disabled={isSaving} type="number" step="0.01" placeholder="0.00" value={rowBuffer.efectivo} onChange={e => handleChange('efectivo', e.target.value)} onKeyDown={handleKeyDown} className={`${inlineCellCls} text-right text-green-700 [&::-webkit-inner-spin-button]:appearance-none ${mismatchInputCls}`}/>
      </td>
      <td className="px-4 py-1.5 whitespace-nowrap font-black text-right font-mono min-w-[100px]">
        {isMismatch ? (
          <span className="text-rose-600 text-xs animate-pulse">S/ {currentSum.toFixed(2)}</span>
        ) : (
          <span className="text-indigo-700">{row.TOTAL === 0 ? "—" : `S/ ${row.TOTAL.toFixed(2)}`}</span>
        )}
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[160px]">
        <input disabled={isSaving} type="text" value={rowBuffer.comentario} onChange={e => handleChange('comentario', e.target.value)} onKeyDown={handleKeyDown} className={inlineCellCls} placeholder="Opcional..." />
      </td>
    </tr>
  );
}
