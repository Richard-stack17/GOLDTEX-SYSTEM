import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@goltex/ui";
import { Users, Medal, Eye, X, Search, DollarSign, Award, Ticket } from 'lucide-react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@goltex/ui";

interface SellerItem {
  id: string;
  name: string;
  total: number;
  count: number;
  pct: number;
}

interface RankingTableProps {
  sellerRanking?: SellerItem[];
}

export function RankingTable({ sellerRanking = [] }: RankingTableProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const hasData = Array.isArray(sellerRanking) && sellerRanking.length > 0;
  const maxTotal = hasData ? Math.max(...sellerRanking.map(s => s.total || 0), 1) : 1;

  const totalAmount = useMemo(() => {
    return sellerRanking.reduce((sum, s) => sum + (s.total || 0), 0);
  }, [sellerRanking]);

  const totalTickets = useMemo(() => {
    return sellerRanking.reduce((sum, s) => sum + (s.count || 0), 0);
  }, [sellerRanking]);

  const filteredSellers = useMemo(() => {
    if (!searchTerm.trim()) return sellerRanking;
    const term = searchTerm.toLowerCase();
    return sellerRanking.filter(s => s.name && s.name.toLowerCase().includes(term));
  }, [sellerRanking, searchTerm]);

  return (
    <>
      <Card className="bg-card border border-border shadow-sm flex flex-col lg:col-span-1 h-full">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-muted-foreground font-medium text-xs sm:text-sm uppercase tracking-wider font-bold">
            Ranking Atención
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {hasData && (
              <button
                type="button"
                onClick={() => setShowDetailModal(true)}
                className="p-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-md transition-colors cursor-pointer"
                title="Ver ranking completo de vendedores"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 max-h-[300px] lg:max-h-full overflow-y-auto custom-scrollbar">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[30px] text-center font-bold text-[10px] uppercase text-muted-foreground py-2">#</TableHead>
                <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2">Atendió</TableHead>
                <TableHead className="text-right font-bold text-[10px] uppercase text-muted-foreground py-2">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!hasData ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground font-medium text-xs border-none">
                    Sin datos de atención
                  </TableCell>
                </TableRow>
              ) : (
                sellerRanking.slice(0, 5).map((seller, i) => (
                  <TableRow key={seller.id || i} className="hover:bg-secondary/30 border-border/50 last:border-0 transition-colors">
                    <TableCell className="text-center px-1 py-2">
                      <div className={`w-5 h-5 mx-auto rounded-full flex items-center justify-center text-[10px] font-black shrink-0
                        ${i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' :
                          i === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' :
                            i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400' : 'bg-secondary text-muted-foreground'}`}>
                        {i === 0 ? <Medal className="w-3 h-3" /> : i + 1}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                          {seller.name.substring(0, 2)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-[11px] whitespace-normal break-words capitalize truncate max-w-[80px]" title={seller.name}>
                            {seller.name.toLowerCase()}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {seller.count} {seller.count === 1 ? 'venta' : 'ventas'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-2 py-2 font-black tabular-nums text-emerald-600 dark:text-emerald-400 text-[11px]">
                      S/ {Math.round(seller.total).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── MODAL RANKING COMPLETO DE ATENCIÓN ── */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-secondary/20 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                    Ranking de Atención a Clientes
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    Desglose de proformas y ventas atendidas por cada vendedor
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
                  <DollarSign className="w-3 h-3 text-emerald-500" /> Total Atendido
                </span>
                <span className="text-sm sm:text-base font-black text-foreground tabular-nums mt-0.5">
                  S/ {Math.round(totalAmount).toLocaleString()}
                </span>
              </div>
              <div className="bg-card p-2.5 rounded-xl border border-border/60 flex flex-col shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Ticket className="w-3 h-3 text-indigo-500" /> Total Ventas
                </span>
                <span className="text-sm sm:text-base font-black text-foreground tabular-nums mt-0.5">
                  {totalTickets.toLocaleString()}
                </span>
              </div>
              <div className="bg-card p-2.5 rounded-xl border border-border/60 flex flex-col shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3 text-blue-500" /> Vendedores Activos
                </span>
                <span className="text-sm sm:text-base font-black text-foreground tabular-nums mt-0.5">
                  {sellerRanking.length}
                </span>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 sm:px-4 border-b border-border bg-card flex items-center gap-2 shrink-0">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar vendedor por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-secondary/50 border border-border rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
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
                {filteredSellers.length} {filteredSellers.length === 1 ? 'vendedor' : 'vendedores'}
              </span>
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 custom-scrollbar">
              {filteredSellers.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-center">
                  <Users className="w-10 h-10 mb-2 opacity-40 text-indigo-500" />
                  <p className="text-sm font-bold text-foreground">No se encontraron vendedores</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Prueba con otro término de búsqueda</p>
                </div>
              ) : (
                <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase font-extrabold text-[10px] tracking-wider border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">#</th>
                        <th className="py-2.5 px-3">Vendedor / Personal</th>
                        <th className="py-2.5 px-3 text-center">Ventas</th>
                        <th className="py-2.5 px-3 text-right">Venta Prom.</th>
                        <th className="py-2.5 px-3 text-right">Total Atendido</th>
                        <th className="py-2.5 px-3 text-right w-24">% Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredSellers.map((seller, idx) => {
                        const rank = idx + 1;
                        const rankBadge = rank === 1
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          : rank === 2
                            ? 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
                            : rank === 3
                              ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30'
                              : 'bg-secondary text-muted-foreground border-border/60';

                        const barWidth = Math.min(100, Math.max(4, Math.round((seller.total / maxTotal) * 100)));
                        const avgTicket = seller.count > 0 ? seller.total / seller.count : 0;

                        return (
                          <tr key={seller.id || idx} className="hover:bg-secondary/30 transition-colors">
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md font-black text-[10px] border ${rankBadge}`}>
                                {rank}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                                  {seller.name.substring(0, 2)}
                                </div>
                                <span className="font-bold text-foreground capitalize truncate max-w-xs" title={seller.name}>
                                  {seller.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-foreground tabular-nums">
                              {seller.count}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-muted-foreground tabular-nums">
                              S/ {Math.round(avgTicket).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-foreground tabular-nums whitespace-nowrap">
                              S/ {Math.round(seller.total).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-mono font-bold text-muted-foreground text-[10px] tabular-nums">
                                  {Math.round(seller.pct)}%
                                </span>
                                <div className="w-14 h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500 rounded-full"
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
                Mostrando {filteredSellers.length} de {sellerRanking.length} vendedores
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
