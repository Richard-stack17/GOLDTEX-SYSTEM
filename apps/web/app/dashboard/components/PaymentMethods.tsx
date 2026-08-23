import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@goltex/ui";
import { CreditCard, Wallet, Eye, X, DollarSign, PieChart as PieIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';

interface PaymentMethodItem {
  method: string;
  amount: number;
}

interface PaymentMethodsProps {
  paymentMethods?: PaymentMethodItem[];
  totalSalesAmount?: number;
}

const METHOD_COLORS: Record<string, string> = {
  EFECTIVO: '#10b981', // Verde esmeralda
  BCP: '#3b82f6',      // Azul BCP / Yape
  BBVA: '#8b5cf6',     // Violeta BBVA / Plin
  IZIPAY: '#f43f5e',   // Rosa/Rojo Izipay
};

const DEFAULT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#f59e0b', '#06b6d4'];

export function PaymentMethods({ paymentMethods = [], totalSalesAmount = 0 }: PaymentMethodsProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);

  const methodsTotal = useMemo(() => {
    return Array.isArray(paymentMethods) ? paymentMethods.reduce((sum, pm) => sum + (pm.amount || 0), 0) : 0;
  }, [paymentMethods]);

  const effectiveTotal = methodsTotal > 0 ? methodsTotal : (totalSalesAmount || 0);
  const hasData = Array.isArray(paymentMethods) && paymentMethods.length > 0 && effectiveTotal > 0;
  const maxAmount = hasData ? Math.max(...paymentMethods.map(p => p.amount || 0), 1) : 1;

  return (
    <>
      <Card className="bg-card border border-border shadow-sm flex flex-col h-full">
        <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            Cuadre de Pagos
          </CardTitle>
          {hasData && (
            <button
              type="button"
              onClick={() => setShowDetailModal(true)}
              className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-md transition-colors cursor-pointer"
              title="Ver detalle del cuadre de pagos"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
        </CardHeader>
        <CardContent className="p-3 sm:p-4 flex-1 flex flex-col justify-center">
          {!hasData ? (
            <div className="h-36 w-full flex flex-col items-center justify-center text-muted-foreground opacity-60 text-center">
              <Wallet className="w-6 h-6 text-muted-foreground mb-1 opacity-50" />
              <p className="text-xs font-bold text-foreground">Sin cobros</p>
              <p className="text-[10px] text-muted-foreground">No hay pagos registrados</p>
            </div>
          ) : (
            <div className="flex flex-row items-center justify-between gap-2.5">
              {/* Donut Chart Compact */}
              <div className="w-24 sm:w-28 h-24 sm:h-28 flex items-center justify-center relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={46}
                      paddingAngle={3}
                      dataKey="amount"
                      nameKey="method"
                      stroke="none"
                    >
                      {paymentMethods.map((entry, index) => {
                        const methodKey = (entry.method || '').toUpperCase();
                        const color = METHOD_COLORS[methodKey] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [`S/ ${Number(val).toFixed(2)}`, 'Monto']}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '10px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)' }}
                      itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Total</span>
                  <span className="text-[10px] sm:text-[11px] font-black tabular-nums text-foreground">S/ {Math.round(effectiveTotal).toLocaleString()}</span>
                </div>
              </div>

              {/* List breakdown */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                {paymentMethods.map((pm, i) => {
                  const methodKey = (pm.method || '').toUpperCase();
                  const color = METHOD_COLORS[methodKey] || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
                  const pct = effectiveTotal > 0 ? Math.round((pm.amount / effectiveTotal) * 100) : 0;

                  return (
                    <div key={i} className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded-md hover:bg-secondary/40 transition-colors">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: color }} />
                        <span className="font-bold uppercase text-foreground truncate text-[10px] sm:text-[11px]" title={pm.method}>
                          {pm.method}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 shrink-0 ml-1">
                        <span className="tabular-nums font-black text-foreground whitespace-nowrap text-[10px] sm:text-[11px]">
                          S/ {Math.round(pm.amount).toLocaleString()}
                        </span>
                        <span className="tabular-nums font-bold text-muted-foreground min-w-[26px] text-right bg-secondary px-1 py-0.2 rounded text-[9px] sm:text-[10px]">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── MODAL DETALLE COMPLETO DE CUADRE DE PAGOS ── */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-secondary/20 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                    Cuadre de Pagos (Detalle Completo)
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    Desglose por método de pago recibido en el periodo
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
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Total Recaudado en Caja
                    </span>
                    <span className="text-base font-black text-foreground tabular-nums">
                      S/ {Math.round(effectiveTotal).toLocaleString()}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-lg">
                  {paymentMethods.length} {paymentMethods.length === 1 ? 'método' : 'métodos'}
                </span>
              </div>
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
              <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-secondary/40 text-muted-foreground uppercase font-extrabold text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3">Método de Pago</th>
                      <th className="py-2.5 px-3 text-right">Total (S/)</th>
                      <th className="py-2.5 px-3 text-right w-28">% Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {paymentMethods.map((pm, idx) => {
                      const methodKey = (pm.method || '').toUpperCase();
                      const color = METHOD_COLORS[methodKey] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                      const pct = effectiveTotal > 0 ? Math.round((pm.amount / effectiveTotal) * 100) : 0;
                      const barWidth = Math.min(100, Math.max(4, Math.round((pm.amount / maxAmount) * 100)));

                      return (
                        <tr key={pm.method || idx} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md font-black text-[10px] bg-secondary text-muted-foreground border border-border/60">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                              <span className="font-bold text-foreground uppercase truncate" title={pm.method}>
                                {pm.method}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-foreground tabular-nums whitespace-nowrap">
                            S/ {Math.round(pm.amount).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-mono font-bold text-muted-foreground text-[10px] tabular-nums">
                                {pct}%
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
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-border bg-secondary/20 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground font-medium">
                {paymentMethods.length} métodos registrados
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
