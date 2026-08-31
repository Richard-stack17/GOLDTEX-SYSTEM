"use client";
import React from "react";
import { Card, CardContent } from "@goltex/ui";
import { RefreshCw, Printer, Eye } from "lucide-react";
import { formatTicketHash, parseInternalTicketNum, starsoftDocNumFromTicket } from "../../lib/ticket-sequence";
import { usePos } from "../context/PosContext";
import { useRole } from "../../context/RoleContext";

export default function PosHistory() {
  const { historyTickets, fetchHistory, setPreviewTicketData, handleReprint, products } = usePos();
  const { permissions } = useRole();

  const starsoftDocNum = (ticket: any) => starsoftDocNumFromTicket(ticket);

  return (
    <div className="flex-1 overflow-auto p-4 space-y-3 bg-secondary/5 pb-20 lg:pb-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-muted-foreground uppercase">Proformas de Hoy</span>
        <button onClick={fetchHistory} className="p-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {historyTickets.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2 opacity-60">
          <p className="text-sm">No has emitido proformas hoy.</p>
        </div>
      ) : (
        historyTickets.map((ticket) => {
          const ticketNo = parseInternalTicketNum(ticket);
          const sunatDoc = starsoftDocNum(ticket);
          const statusBorderColor = ticket.status === 'PENDING'
            ? 'border-orange-500/30 hover:border-orange-500/60'
            : ticket.status === 'COMPLETED'
              ? 'border-emerald-500/30 hover:border-emerald-500/60'
              : 'border-red-500/30 hover:border-red-500/60';

          const statusNumberColor = ticket.status === 'PENDING'
            ? 'text-orange-600'
            : ticket.status === 'COMPLETED'
              ? 'text-emerald-600'
              : 'text-red-500';

          return (
            <Card key={ticket.id} className={`bg-background shadow-sm rounded-xl overflow-hidden transition-all border-2 ${statusBorderColor}`}>
              <CardContent className="p-2.5 flex flex-col gap-1">
                {/* Fila 1: Ticket # + Monto Destacado + Badge Estado */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-xs sm:text-sm font-black shrink-0 ${statusNumberColor}`}>
                      {formatTicketHash(ticketNo)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                      ({ticket.proforma_number || ticket.invoice_number})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-black text-xs sm:text-sm font-mono ${ticket.status === 'PENDING' ? 'text-amber-600' : ticket.status === 'COMPLETED' ? 'text-emerald-600' : 'text-muted-foreground line-through'}`}>
                      S/ {ticket.total.toFixed(2)}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${ticket.status === 'PENDING' ? 'bg-orange-500/15 text-orange-600 border border-orange-500/30' : ticket.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-red-500/15 text-red-600 border border-red-500/30'}`}>
                      {ticket.status === 'PENDING' ? 'PENDIENTE' : ticket.status === 'COMPLETED' ? 'ATENDIDA' : 'ANULADA'}
                    </span>
                  </div>
                </div>

                {/* Fila 2: Información en una sola línea (Hora • Usuario • Estado cobro) */}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap leading-none py-0.5">
                  <span className="font-mono">
                    {new Date(ticket.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {permissions?.view_cashier_name && (
                    <>
                      <span>•</span>
                      <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                        ATENDIDO POR: {(ticket as any).seller?.username || 'ADMIN'}
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span className={ticket.status === 'PENDING' ? 'text-orange-500 font-medium' : ticket.status === 'COMPLETED' ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                    {ticket.status === 'PENDING' ? 'Sin cobrar' : ticket.status === 'COMPLETED' ? 'Cobrado' : ''}
                  </span>
                </div>

                {/* Fila 3: Botones Compactos */}
                <div className="flex items-center justify-end gap-1.5 pt-0.5">
                  <button
                    onClick={() => handleReprint(ticket)}
                    className="h-7 px-2.5 bg-secondary/60 hover:bg-secondary border border-border rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Printer className="w-3 h-3 text-muted-foreground" /> Reimprimir
                  </button>
                  <button
                    onClick={() => {
                      const lines = typeof ticket.detail === 'string' ? ticket.detail.split('\n').filter(l => l.trim()) : [];
                      const reconstructedItems = lines.map((l: string, idx: number) => {
                        let code = "";
                        let name = l;
                        let quantity = 1;
                        let editedPrice = 0;
                        let basePrice = 0;

                        try {
                          const sepIdx = l.indexOf(' — ');
                          if (sepIdx !== -1) {
                            const firstPart = l.substring(0, sepIdx);
                            const secondPart = l.substring(sepIdx + 3);

                            if (firstPart.includes(': ')) {
                              const colonIdx = firstPart.indexOf(': ');
                              code = firstPart.substring(0, colonIdx);
                              name = firstPart.substring(colonIdx + 2);
                              const priceMatch = secondPart.match(/S\/\s*([\d.]+)/);
                              editedPrice = priceMatch ? (parseFloat(priceMatch[1] ?? '0') || 0) : 0;
                            } else {
                              const spaceIdx = firstPart.indexOf(' ');
                              code = spaceIdx > -1 ? firstPart.substring(0, spaceIdx) : '';
                              name = spaceIdx > -1 ? firstPart.substring(spaceIdx + 1) : firstPart;
                              const matchedProd = products.find(p => p.code === code);
                              if (matchedProd) basePrice = matchedProd.price;
                              const mxIdx = secondPart.indexOf('m × S/ ');
                              if (mxIdx !== -1) {
                                quantity = parseFloat(secondPart.substring(0, mxIdx)) || 0;
                                editedPrice = parseFloat(secondPart.substring(mxIdx + 7)) || 0;
                              }
                            }
                          }
                        } catch (e) { }
                        return { code, name, price: basePrice, editedPrice, quantity };
                      });

                      const atendidoName = permissions?.view_cashier_name ? ((ticket as any).seller?.username || 'ADMIN') : null;

                      const saleDataForPrint = {
                        proforma_number: ticket.proforma_number || ticket.invoice_number || '',
                        cajero: atendidoName,
                        customer_name: "Cliente General",
                        items: reconstructedItems,
                        total: ticket.total
                      };
                      setPreviewTicketData(saleDataForPrint);
                    }}
                    className="h-7 px-2.5 bg-secondary/30 hover:bg-secondary/60 text-foreground border border-border rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3 h-3 text-muted-foreground" /> Vista previa
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
