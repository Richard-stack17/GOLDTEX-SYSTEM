import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@goltex/ui";
import { Scissors, Eye, X, Search, DollarSign, Sparkles } from 'lucide-react';

export interface ServiceItem {
  name: string;
  amount: number;
  pct: number;
}

interface ServicesStats {
  totalServicesAmount: number;
  servicesList: ServiceItem[];
}

interface ServicesBreakdownProps {
  servicesStats?: ServicesStats;
}

const SERVICE_COLORS = ['#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#06b6d4'];

export function ServicesBreakdown({ servicesStats }: ServicesBreakdownProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const servicesList = servicesStats?.servicesList || [];
  const totalAmount = servicesStats?.totalServicesAmount || 0;
  const hasData = servicesList.length > 0 && totalAmount > 0;
  const maxAmount = hasData ? Math.max(...servicesList.map(s => s.amount || 0), 1) : 1;

  const filteredServices = useMemo(() => {
    if (!searchTerm.trim()) return servicesList;
    const term = searchTerm.toLowerCase();
    return servicesList.filter(s => s.name && s.name.toLowerCase().includes(term));
  }, [servicesList, searchTerm]);

  return (
    <>
      <Card className="bg-card border border-border shadow-sm flex flex-col">
        <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Scissors className="w-4 h-4 text-amber-500" />
            Ingresos por Servicios
          </CardTitle>
          {hasData && (
            <button
              type="button"
              onClick={() => setShowDetailModal(true)}
              className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1.5 hover:underline cursor-pointer bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-lg transition-all active:scale-95 shadow-xs"
              title="Ver detalle completo de los servicios realizados"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver detalle</span>
            </button>
          )}
        </CardHeader>
        <CardContent className="pt-4 flex-1 flex flex-col justify-center">
          {!hasData ? (
            <div className="h-48 w-full flex flex-col items-center justify-center text-muted-foreground opacity-60 text-center">
              <Scissors className="w-8 h-8 mb-2 opacity-50 text-amber-500" />
              <p className="text-sm font-bold text-foreground">Sin servicios</p>
              <p className="text-xs text-muted-foreground mt-0.5">No hay servicios cobrados en el periodo</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 py-1">
              {/* Total indicator */}
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300">Total Servicios</span>
                </div>
                <span className="text-sm font-black tabular-nums text-amber-700 dark:text-amber-400">
                  S/ {Math.round(totalAmount).toLocaleString()}
                </span>
              </div>

              {/* Service list items */}
              {servicesList.slice(0, 3).map((serv, index) => {
                const barWidthPct = Math.min(100, Math.max(8, Math.round((serv.amount / maxAmount) * 100)));
                const color = SERVICE_COLORS[index % SERVICE_COLORS.length];

                return (
                  <div key={serv.name || index} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                        <span className="font-bold text-foreground uppercase truncate" title={serv.name}>
                          {serv.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black tabular-nums text-foreground">S/ {Math.round(serv.amount).toLocaleString()}</span>
                        <span className="font-bold text-muted-foreground text-[11px] bg-secondary px-1.5 py-0.5 rounded w-9 text-right tabular-nums">
                          {Math.round(serv.pct)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidthPct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── MODAL DETALLE COMPLETO DE SERVICIOS ── */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-secondary/20 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Scissors className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                    Ingresos por Servicios (Detalle Completo)
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    Desglose de servicios adicionales cobrados en el periodo
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
            <div className="p-3 sm:p-4 bg-secondary/10 border-b border-border text-xs shrink-0">
              <div className="bg-card p-3 rounded-xl border border-border/60 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Total Recaudado en Servicios
                    </span>
                    <span className="text-base font-black text-foreground tabular-nums">
                      S/ {Math.round(totalAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-lg">
                  {servicesList.length} {servicesList.length === 1 ? 'tipo de servicio' : 'tipos de servicio'}
                </span>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 sm:px-4 border-b border-border bg-card flex items-center gap-2 shrink-0">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar servicio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-secondary/50 border border-border rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
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
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 custom-scrollbar">
              {filteredServices.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-center">
                  <Scissors className="w-10 h-10 mb-2 opacity-40 text-amber-500" />
                  <p className="text-sm font-bold text-foreground">No se encontraron servicios</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Prueba buscando con otro término</p>
                </div>
              ) : (
                <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase font-extrabold text-[10px] tracking-wider border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">#</th>
                        <th className="py-2.5 px-3">Servicio</th>
                        <th className="py-2.5 px-3 text-right">Total (S/)</th>
                        <th className="py-2.5 px-3 text-right w-28">% Servicios</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredServices.map((serv, idx) => {
                        const rank = idx + 1;
                        const rankBadge = rank === 1
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          : rank === 2
                            ? 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
                            : rank === 3
                              ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30'
                              : 'bg-secondary text-muted-foreground border-border/60';

                        const barWidth = Math.min(100, Math.max(4, Math.round((serv.amount / maxAmount) * 100)));
                        const color = SERVICE_COLORS[idx % SERVICE_COLORS.length];

                        return (
                          <tr key={serv.name || idx} className="hover:bg-secondary/30 transition-colors">
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md font-black text-[10px] border ${rankBadge}`}>
                                {rank}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                                <span className="font-bold text-foreground uppercase truncate" title={serv.name}>
                                  {serv.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-foreground tabular-nums whitespace-nowrap">
                              S/ {Math.round(serv.amount).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-mono font-bold text-muted-foreground text-[10px] tabular-nums">
                                  {Math.round(serv.pct)}%
                                </span>
                                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${barWidth}%`, backgroundColor: color }}
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
                Mostrando {filteredServices.length} de {servicesList.length} servicios
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
