import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@goltex/ui";
import { FolderTree, Eye, X, Search, TrendingUp, DollarSign, Layers } from 'lucide-react';

export interface FamilyItem {
  id?: string;
  name: string;
  quantity?: number;
  amount: number;
  pct: number;
}

interface TopFamiliesProps {
  topFamilies?: FamilyItem[];
}

export function TopFamilies({ topFamilies = [] }: TopFamiliesProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const hasData = Array.isArray(topFamilies) && topFamilies.length > 0;
  const maxAmount = hasData ? Math.max(...topFamilies.map(f => f.amount || 0), 1) : 1;

  // Filtered list for the modal
  const filteredFamilies = useMemo(() => {
    if (!searchTerm.trim()) return topFamilies;
    const term = searchTerm.toLowerCase();
    return topFamilies.filter(f => f.name && f.name.toLowerCase().includes(term));
  }, [topFamilies, searchTerm]);

  const totalAmount = useMemo(() => {
    return topFamilies.reduce((sum, f) => sum + (f.amount || 0), 0);
  }, [topFamilies]);

  const totalQuantity = useMemo(() => {
    return topFamilies.reduce((sum, f) => sum + (f.quantity || 0), 0);
  }, [topFamilies]);

  return (
    <>
      <Card className="bg-card border border-border shadow-sm flex flex-col">
        <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <FolderTree className="w-4 h-4 text-purple-500" />
            Top 3 Familias
          </CardTitle>
          {hasData && (
            <button
              type="button"
              onClick={() => setShowDetailModal(true)}
              className="text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1.5 hover:underline cursor-pointer bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 px-2.5 py-1 rounded-lg transition-all active:scale-95 shadow-xs"
              title="Ver reporte completo de todas las familias vendidas"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver detalle</span>
            </button>
          )}
        </CardHeader>
        <CardContent className="pt-4 flex-1 flex flex-col justify-center">
          {!hasData ? (
            <div className="h-48 w-full flex flex-col items-center justify-center text-muted-foreground opacity-60 text-center">
              <FolderTree className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm font-bold text-foreground">Sin familias</p>
              <p className="text-xs text-muted-foreground mt-0.5">No hay ventas registradas en el periodo</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-1">
              {topFamilies.slice(0, 3).map((fam, index) => {
                const barWidthPct = Math.min(100, Math.max(8, Math.round((fam.amount / maxAmount) * 100)));
                const rankColor = index === 0
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : index === 1
                    ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                    : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';

                return (
                  <div key={fam.id || index} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 border ${rankColor}`}>
                          {index + 1}
                        </span>
                        <span className="font-bold text-foreground uppercase truncate" title={fam.name}>
                          {fam.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black tabular-nums text-foreground">S/ {Math.round(fam.amount).toLocaleString()}</span>
                        <span className="font-bold text-muted-foreground text-[11px] bg-secondary px-1.5 py-0.5 rounded w-9 text-right tabular-nums">
                          {Math.round(fam.pct)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${barWidthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── MODAL DETALLE COMPLETO DE FAMILIAS ── */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-secondary/20 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <FolderTree className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                    Ventas por Familia (Detalle Completo)
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    Ordenados de mayor a menor recaudación en el periodo seleccionado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KPI Summary Strip */}
            <div className="grid grid-cols-3 gap-2 p-3 sm:p-4 bg-secondary/10 border-b border-border text-xs shrink-0">
              <div className="bg-card p-2.5 rounded-xl border border-border/60 flex flex-col shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-500" /> Total Ventas
                </span>
                <span className="text-sm sm:text-base font-black text-foreground tabular-nums mt-0.5">
                  S/ {Math.round(totalAmount).toLocaleString()}
                </span>
              </div>
              <div className="bg-card p-2.5 rounded-xl border border-border/60 flex flex-col shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Layers className="w-3 h-3 text-purple-500" /> Cantidad / Metros
                </span>
                <span className="text-sm sm:text-base font-black text-foreground tabular-nums mt-0.5">
                  {totalQuantity.toLocaleString()}
                </span>
              </div>
              <div className="bg-card p-2.5 rounded-xl border border-border/60 flex flex-col shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-indigo-500" /> Familias con Venta
                </span>
                <span className="text-sm sm:text-base font-black text-foreground tabular-nums mt-0.5">
                  {topFamilies.length}
                </span>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 sm:px-4 border-b border-border bg-card flex items-center gap-2 shrink-0">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar familia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-secondary/50 border border-border rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                {filteredFamilies.length} {filteredFamilies.length === 1 ? 'familia' : 'familias'}
              </span>
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 custom-scrollbar">
              {filteredFamilies.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-center">
                  <FolderTree className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm font-bold text-foreground">No se encontraron familias</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Prueba buscando con otro término</p>
                </div>
              ) : (
                <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase font-extrabold text-[10px] tracking-wider border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">#</th>
                        <th className="py-2.5 px-3">Familia</th>
                        <th className="py-2.5 px-3 text-right">Cant. / Metros</th>
                        <th className="py-2.5 px-3 text-right">Total (S/)</th>
                        <th className="py-2.5 px-3 text-right w-28">% Ventas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredFamilies.map((fam, idx) => {
                        const rank = idx + 1;
                        const rankBadge = rank === 1
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          : rank === 2
                            ? 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
                            : rank === 3
                              ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30'
                              : 'bg-secondary text-muted-foreground border-border/60';

                        const barWidth = Math.min(100, Math.max(4, Math.round((fam.amount / maxAmount) * 100)));

                        return (
                          <tr key={fam.id || idx} className="hover:bg-secondary/30 transition-colors">
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md font-black text-[10px] border ${rankBadge}`}>
                                {rank}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-foreground uppercase truncate max-w-xs sm:max-w-md block" title={fam.name}>
                                {fam.name}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground tabular-nums">
                              {fam.quantity ? fam.quantity.toLocaleString() : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-foreground tabular-nums whitespace-nowrap">
                              S/ {Math.round(fam.amount).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-mono font-bold text-muted-foreground text-[10px] tabular-nums">
                                  {Math.round(fam.pct)}%
                                </span>
                                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-purple-500 rounded-full"
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-border bg-secondary/20 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground font-medium">
                Mostrando {filteredFamilies.length} de {topFamilies.length} familias
              </span>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs transition-colors cursor-pointer border border-border"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
