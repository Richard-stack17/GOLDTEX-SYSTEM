import React from 'react';

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

  const [rowBuffer, setRowBuffer] = React.useState(initialBuffer);
  const [isFocusedRow, setIsFocusedRow] = React.useState(false);
  const isIzipay = row.DETALLE?.includes('IZIPAY');

  React.useEffect(() => {
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

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const targetInput = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const bcp = Number(rowBuffer.bcp) || 0;
      const bbva = Number(rowBuffer.bbva) || 0;
      const efectivo = Number(rowBuffer.efectivo) || 0;
      
      const sumaPagos = bcp + bbva + efectivo;
      
      if (sumaPagos.toFixed(2) !== Number(row.TOTAL).toFixed(2)) {
        showToast("La suma de los pagos debe ser exactamente igual al total del ticket", "error");
        setRowBuffer(initialBuffer);
        targetInput?.blur();
        return;
      }

      const success = await onSaveRow(row.id, rowBuffer, isIzipay);
      if (!success) {
        setRowBuffer(initialBuffer);
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

  return (
    <tr id={`contabilidad-row-${row.id}`} className="hover:bg-indigo-50/30 transition-colors font-bold text-gray-800" onFocus={handleFocus} onBlur={handleBlur}>
      <td className="px-4 py-1.5 whitespace-nowrap font-mono text-gray-600">{displayDate(row.FECHA)}</td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[140px]">
        <input type="text" value={rowBuffer.documento} onChange={e => handleChange('documento', e.target.value)} onKeyDown={handleKeyDown} className={`${inlineCellCls} font-mono`} />
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[180px]">
        <input type="text" list="clientes-list" value={rowBuffer.nombre} onChange={e => handleChange('nombre', e.target.value)} onKeyDown={handleKeyDown} className={inlineCellCls} />
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
          type="number" step="0.01" placeholder="0.00" 
          value={rowBuffer.bbva} 
          onChange={e => {
            if (isIzipay) return;
            handleChange('bbva', e.target.value);
          }} 
          onKeyDown={handleKeyDown} 
          disabled={isIzipay}
          className={`${inlineCellCls} text-right text-blue-700 [&::-webkit-inner-spin-button]:appearance-none ${isIzipay ? 'bg-gray-100 cursor-not-allowed opacity-50' : ''}`}
        />
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
        <input type="number" step="0.01" placeholder="0.00" value={rowBuffer.bcp} onChange={e => handleChange('bcp', e.target.value)} onKeyDown={handleKeyDown} className={`${inlineCellCls} text-right text-orange-700 [&::-webkit-inner-spin-button]:appearance-none`}/>
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[100px]">
        <input type="number" step="0.01" placeholder="0.00" value={rowBuffer.efectivo} onChange={e => handleChange('efectivo', e.target.value)} onKeyDown={handleKeyDown} className={`${inlineCellCls} text-right text-green-700 [&::-webkit-inner-spin-button]:appearance-none`}/>
      </td>
      <td className="px-4 py-1.5 whitespace-nowrap font-black text-right text-indigo-700 font-mono min-w-[100px]">
        {row.TOTAL === 0 ? "—" : `S/ ${row.TOTAL.toFixed(2)}`}
      </td>
      <td className="px-2 py-1 whitespace-nowrap min-w-[160px]">
        <input type="text" value={rowBuffer.comentario} onChange={e => handleChange('comentario', e.target.value)} onKeyDown={handleKeyDown} className={inlineCellCls} placeholder="Opcional..." />
      </td>
    </tr>
  );
}
