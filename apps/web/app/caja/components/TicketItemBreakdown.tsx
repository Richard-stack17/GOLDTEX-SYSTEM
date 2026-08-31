"use client";

import React from "react";
import {
  ShoppingBag,
  User,
  UserCheck,
  CreditCard,
  XCircle,
  Layers,
} from "lucide-react";

export interface TicketItemBreakdownProps {
  ticket: any;
  compact?: boolean;
}

const formatPeruDateTimeFull = (isoString?: string | null) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

function getProfileDisplayName(profileObj?: any): string {
  if (!profileObj) return "ADMIN";
  const emp = profileObj.employees;
  const fullName = Array.isArray(emp) ? emp[0]?.full_name : emp?.full_name;
  if (fullName && String(fullName).trim().length > 0) return String(fullName).trim();
  return profileObj.username || "ADMIN";
}

const parseInternalTicketNum = (ticket: any): number => {
  if (ticket?.internal_ticket_number != null && !isNaN(Number(ticket.internal_ticket_number)) && Number(ticket.internal_ticket_number) > 0) {
    return Number(ticket.internal_ticket_number);
  }
  const match = (ticket?.proforma_number || '').match(/TKT-\d{8}-(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 0;
};

export function TicketItemBreakdown({ ticket, compact = false }: TicketItemBreakdownProps) {
  if (!ticket) return null;

  const rawSellerName = getProfileDisplayName(ticket.seller);
  const childrenList = Array.isArray(ticket.children) && ticket.children.length > 0
    ? ticket.children
    : (Array.isArray(ticket._consolidated_tickets) ? ticket._consolidated_tickets : []);

  let sellerNameDisplay = rawSellerName;
  let isMultipleSeller = false;

  if (childrenList.length > 0) {
    const uniqueSellers = Array.from(
      new Set(childrenList.map((c: any) => getProfileDisplayName(c.seller)).filter(Boolean))
    );
    if (uniqueSellers.length > 1) {
      sellerNameDisplay = uniqueSellers.join(" + ");
      isMultipleSeller = true;
    } else if (uniqueSellers.length === 1) {
      sellerNameDisplay = uniqueSellers[0] as string;
    }
  }

  const cashierName = ticket.cashier ? getProfileDisplayName(ticket.cashier) : null;
  const createdTime = formatPeruDateTimeFull(ticket.created_at);

  const txList = Array.isArray(ticket.transactions) ? ticket.transactions : [];
  const rawTxTime = txList.find((t: any) => t?.created_at)?.created_at || (txList[0] as any)?.created_at;
  const cobradoTime = formatPeruDateTimeFull(
    rawTxTime || (ticket.updated_at !== ticket.created_at ? ticket.updated_at : null) || ticket.created_at
  );
  const anuladoTime = formatPeruDateTimeFull(ticket.updated_at || ticket.created_at);

  const isPaid = ticket.status === "COMPLETED" || !!cashierName || txList.length > 0;
  const isCancelled = ticket.status === "CANCELLED";

  const cust = ticket.customers;
  const rawName = (ticket.voucher_doc_name || cust?.business_name || "CLIENTE VARIOS").trim();
  const isVarios = rawName.toUpperCase() === "CLIENTE VARIOS";
  const clientName = isVarios ? "CLIENTE VARIOS" : rawName;
  const clientDoc = ticket.voucher_doc_number || cust?.doc_number || "";
  const docTypeLabel =
    ticket.voucher_type === "BOLETA"
      ? "DNI"
      : ticket.voucher_type === "FACTURA"
      ? "RUC"
      : cust?.document_type || (clientDoc.length === 11 ? "RUC" : clientDoc ? "DNI" : "");
  const showDoc = !isVarios && Boolean(clientDoc) && clientDoc !== "00000000000";
  const docInfo = showDoc ? ` (${docTypeLabel}: ${clientDoc})` : "";

  // Items consolidation: if consolidated ticket without direct items, gather items from children
  let itemsArray: any[] = Array.isArray(ticket.items) && ticket.items.length > 0 ? ticket.items : [];
  if (itemsArray.length === 0 && childrenList.length > 0) {
    itemsArray = childrenList.flatMap((c: any) => (Array.isArray(c.items) ? c.items : []));
  }

  const itemsSubtotal = itemsArray.reduce((acc: number, item: any) => {
    const q = parseFloat(item.quantity) || 1;
    const ep = item.editedPrice !== undefined ? parseFloat(item.editedPrice) : parseFloat(item.price) || 0;
    return acc + q * ep;
  }, 0);

  const ticketTotal = Number(ticket.total || 0);
  const rawSurcharge = ticketTotal > itemsSubtotal ? ticketTotal - itemsSubtotal : 0;
  const surcharge = Math.round(rawSurcharge * 100) / 100;
  const hasSurcharge = surcharge >= 0.01;

  const izipayTx = txList.find((t: any) => t.payment_method === "IZIPAY" || (t.surcharge_pct && t.surcharge_pct > 0));
  const dbSurchargePct =
    izipayTx?.surcharge_pct != null && Number(izipayTx.surcharge_pct) > 0
      ? Number(izipayTx.surcharge_pct).toFixed(1)
      : null;
  const surchargePct = dbSurchargePct ?? (itemsSubtotal > 0 ? ((surcharge / itemsSubtotal) * 100).toFixed(1) : "0.0");

  return (
    <div className={`bg-card text-card-foreground border border-border rounded-xl shadow-xs ${compact ? "p-3 space-y-3" : "p-4 space-y-4"}`}>
      {/* Header Info: Badges */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-border">
        <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-indigo-500" /> Desglose de Ítems
        </h4>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Cliente (Solo si ya se cobró o tiene cliente con nombre específico) */}
          {(isPaid || !isVarios) && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary text-secondary-foreground border border-border rounded-full text-xs font-bold">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>
                CLIENTE: <strong className="uppercase">{clientName}</strong>
                <span className="text-[10px] text-muted-foreground font-mono">{docInfo}</span>
              </span>
            </div>
          )}

          {/* 2. Atendido */}
          {isMultipleSeller ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 rounded-full text-xs font-bold shadow-xs">
              <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>
                ATENCIÓN COMPARTIDA: <strong className="uppercase text-purple-700 dark:text-purple-300">{sellerNameDisplay}</strong>
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-full text-xs font-bold">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                ATENDIDO POR: <strong className="uppercase">{sellerNameDisplay}</strong>
              </span>
              {createdTime && <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-medium">({createdTime})</span>}
            </div>
          )}

          {/* 3. Cobrado */}
          {isPaid && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-full text-xs font-bold">
              <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                COBRADO POR: <strong className="uppercase">{cashierName || "ADMIN"}</strong>
              </span>
              {cobradoTime && <span className="text-[10px] text-blue-700 dark:text-blue-300 font-mono font-medium">({cobradoTime})</span>}
            </div>
          )}

          {/* 4. Anulado */}
          {isCancelled && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-full text-xs font-bold">
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                ANULADO POR: <strong className="uppercase">{getProfileDisplayName(ticket.cancelled_by)}</strong>
              </span>
              {anuladoTime && <span className="text-[10px] text-rose-700 dark:text-rose-300 font-mono font-medium">({anuladoTime})</span>}
            </div>
          )}
        </div>
      </div>

      {/* Proformas Unificadas Si Aplica */}
      {childrenList.length > 0 && (
        <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl space-y-2">
          <h5 className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Proformas Unificadas en esta Venta ({childrenList.length})
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[...childrenList]
              .sort((a: any, b: any) => {
                const numA = Number(a.internal_ticket_number || parseInternalTicketNum(a) || 0);
                const numB = Number(b.internal_ticket_number || parseInternalTicketNum(b) || 0);
                return numA - numB;
              })
              .map((child: any) => {
                const childTime = formatPeruDateTimeFull(child.created_at);
                const childNum = child.internal_ticket_number || parseInternalTicketNum(child);
                return (
                  <div
                    key={child.id}
                    className="flex items-center justify-between bg-card px-3.5 py-2 rounded-lg border border-indigo-100 dark:border-indigo-900/60 text-xs shadow-2xs"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-mono font-bold text-foreground truncate">
                        {child.proforma_number || (childNum ? `Ticket #${childNum}` : "Ticket")}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 flex-wrap mt-0.5">
                        <span>
                          Atendido: <strong className="text-foreground uppercase">{getProfileDisplayName(child.seller)}</strong>
                        </span>
                        {childTime && (
                          <span className="text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-200/80 dark:border-emerald-800/80">
                            ({childTime})
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs shrink-0">
                      S/ {Number(child.total || 0).toFixed(2)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tabla de Productos / Servicios */}
      {itemsArray.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left pb-2 font-bold uppercase">Producto/Servicio</th>
                <th className="text-center pb-2 font-bold uppercase">Cant.</th>
                <th className="text-right pb-2 font-bold uppercase">P.Unit</th>
                <th className="text-right pb-2 font-bold uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {itemsArray.map((item, i) => {
                const qty = parseFloat(item.quantity) || 1;
                const pUnit = item.editedPrice !== undefined ? parseFloat(item.editedPrice) : parseFloat(item.price) || 0;
                const sub = qty * pUnit;
                return (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 font-bold text-foreground">{item.name}</td>
                    <td className="py-2 text-center font-medium text-muted-foreground">{item.quantity}</td>
                    <td className="py-2 text-right font-medium text-muted-foreground font-mono">S/ {pUnit.toFixed(2)}</td>
                    <td className="py-2 text-right font-extrabold text-foreground font-mono">S/ {sub.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border">
              {hasSurcharge && (
                <>
                  <tr>
                    <td colSpan={3} className="pt-2 text-right font-medium text-muted-foreground">
                      Subtotal Ítems:
                    </td>
                    <td className="pt-2 text-right font-bold text-foreground font-mono">
                      S/ {itemsSubtotal.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1 text-right font-bold text-amber-600 dark:text-amber-400">
                      Recargo Izipay / Tarjeta ({surchargePct}%):
                    </td>
                    <td className="py-1 text-right font-black text-amber-600 dark:text-amber-400 font-mono">
                      + S/ {surcharge.toFixed(2)}
                    </td>
                  </tr>
                </>
              )}
              <tr>
                <td colSpan={3} className="py-2 text-right font-black text-foreground uppercase">
                  Total:
                </td>
                <td className="py-2 text-right font-black text-teal-600 dark:text-teal-400 text-sm font-mono">
                  S/ {ticketTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic py-2">
          {ticket.detail || "No hay información detallada en JSON para este ticket."}
        </p>
      )}
    </div>
  );
}
