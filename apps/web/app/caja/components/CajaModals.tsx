import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@goltex/ui";
import { User, FileText, CheckCircle2, RefreshCw, XCircle, Layers } from "lucide-react";

export function CajaModals(props: any) {
  const {
    selectedTicket,
    closeModal,
    formatTicketHash,
    parseInternalTicketNum,
    totalServices,
    focusedMethod,
    setPaymentAmounts,
    PAYMENT_METHODS,
    paymentAmounts,
    setFullAmount,
    izipayVariant,
    setIzipayVariant,
    settings,
    handleInputKeyDown,
    setFocusedMethod,
    finalTotal,
    izipayFee,
    ticketTotal,
    izipayRate,
    VOUCHER_TYPES,
    voucherType,
    setVoucherType,
    setSelectedCustomerId,
    docNumber,
    setDocNumber,
    docName,
    setDocName,
    needsDocInfo,
    setCustomerQuery,
    docNumberValid,
    docNameValid,
    showDropdown,
    customerResults,
    selectCustomer,
    canConfirm,
    openReview,
    isReviewing,
    setIsReviewing,
    isSubmitting,
    handleFinalSubmit,
    showSuccessModal,
    successSaleData,
    setShowSuccessModal
  } = props;

  return (
    <>
{/* ════════════════════════════════════════
          PAYMENT MODAL (OPTIMIZADO PARA PC / TECLADO FÍSICO)
          ════════════════════════════════════════ */}
      <Dialog open={!!selectedTicket} onOpenChange={(open: any) => { if (!open) closeModal(); }}>
        <DialogContent
          
          className="w-[92vw] max-w-4xl max-h-[90vh] bg-card border-border text-foreground p-0 overflow-hidden flex flex-col"
        >
          {/* Header — identificación del ticket */}
          <div className="px-8 py-5 border-b border-border bg-background/50 shrink-0 flex items-center justify-between">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-3 flex-wrap">
                <span>Cobrar Ticket {selectedTicket && selectedTicket.source_type !== 'CONSOLIDATED' ? formatTicketHash(parseInternalTicketNum(selectedTicket)) : ""}</span>
                {selectedTicket?.source_type === 'CONSOLIDATED' ? (
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full text-sm font-bold uppercase tracking-wider">
                    Cobro Unificado: S/ {selectedTicket.total.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-sm font-mono text-muted-foreground font-normal">{selectedTicket?.proforma_number || selectedTicket?.invoice_number}</span>
                )}
              </DialogTitle>
              <DialogDescription className="hidden">Modal de cobro para PC</DialogDescription>
            </DialogHeader>
            <button
              onClick={closeModal}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-rose-100 hover:text-rose-600 text-muted-foreground transition-colors shrink-0"
              title="Cerrar (Esc)"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Cuerpo */}
          <div className="px-8 pt-6 pb-14 space-y-6 flex-1 overflow-y-auto">
            {selectedTicket?.source_type === 'CONSOLIDATED' && Array.isArray(selectedTicket._consolidated_tickets) && (
              <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" /> Proformas a unificar ({selectedTicket._consolidated_tickets.length}):
                  </span>
                  <span className="text-xs font-extrabold text-indigo-700 font-mono">
                    Suma total: S/ {selectedTicket.total.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-1">
                  {selectedTicket._consolidated_tickets.map((t: any) => {
                    const ticketNo = parseInternalTicketNum ? parseInternalTicketNum(t) : (t.internal_ticket_number || 0);
                    const formattedHash = formatTicketHash ? formatTicketHash(ticketNo) : `#${ticketNo}`;
                    return (
                      <div key={t.id} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-indigo-100 text-xs shadow-xs">
                        <span className="font-mono font-bold text-slate-800">
                          {formattedHash || t.proforma_number}
                        </span>
                        <span className="font-mono font-black text-indigo-700">
                          S/ {(t.total || 0).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Columna Izquierda: Métodos de Pago */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Métodos de Pago</span>
                  {totalServices > 0 && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!focusedMethod) return;
                        setPaymentAmounts((prev: any) => ({
                          ...prev,
                          [focusedMethod]: totalServices.toFixed(2)
                        }));
                      }}
                      className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold px-4 py-1.5 rounded-full transition-colors border border-purple-200"
                    >
                      Atajo Servicios
                    </button>
                  )}
                </div>
                {PAYMENT_METHODS.map(({ id, label, Icon }: any) => {
                  const amount = paymentAmounts[id];
                  const hasValue = parseFloat(amount) > 0;

                  return (
                    <div
                      key={id}
                      className="flex flex-col gap-3 p-4 rounded-2xl border border-border bg-background/30 transition-all duration-300"
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${hasValue ? "bg-orange-500/20 text-orange-500" : "bg-secondary text-muted-foreground"
                          }`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground text-base leading-tight">{label}</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {id !== 'IZIPAY' && (
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={(e) => {
                                e.preventDefault();
                                setFullAmount(id);
                                setTimeout(() => {
                                  document.getElementById(`payment-input-${id}`)?.focus();
                                }, 0);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                }
                              }}
                              className="text-xs font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Exacto
                            </button>
                          )}
                          
                          {id === 'IZIPAY' && (
                            <div className="flex gap-1.5 animate-in slide-in-from-right-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIzipayVariant('DEBIT');
                                  setFullAmount(id, settings.izipay_debit_fee);
                                  setTimeout(() => document.getElementById(`payment-input-${id}`)?.focus(), 0);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${izipayVariant === 'DEBIT' ? 'bg-orange-100 text-orange-700 shadow-sm border border-orange-200' : 'bg-transparent text-muted-foreground border border-border hover:bg-secondary'}`}
                              >
                                {settings.izipay_debit_fee}%
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIzipayVariant('CREDIT');
                                  setFullAmount(id, settings.izipay_credit_fee);
                                  setTimeout(() => document.getElementById(`payment-input-${id}`)?.focus(), 0);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${izipayVariant === 'CREDIT' ? 'bg-orange-100 text-orange-700 shadow-sm border border-orange-200' : 'bg-transparent text-muted-foreground border border-border hover:bg-secondary'}`}
                              >
                                {settings.izipay_credit_fee}%
                              </button>
                            </div>
                          )}

                          <input
                            type="number"
                            id={`payment-input-${id}`}
                            value={amount}
                            min={0}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (parseFloat(val) < 0) {
                                setPaymentAmounts((prev: any) => ({ ...prev, [id]: "0" }));
                              } else {
                                setPaymentAmounts((prev: any) => ({ ...prev, [id]: val }));
                              }
                            }}
                            onFocus={() => setFocusedMethod(id)}
                            onKeyDown={(e) => handleInputKeyDown(e, id)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="0.00"
                            step="1"
                            className="w-28 bg-background border border-border rounded-lg py-1.5 px-3 text-right font-mono font-bold text-base transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/25 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Columna Derecha: Resumen & Cliente */}
              <div className="space-y-6">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider block mb-1">Total a Pagar</span>
                  <span className="text-4xl font-black text-emerald-500 font-mono leading-none block">
                    S/ {finalTotal.toFixed(2)}
                  </span>
                  {izipayFee > 0 && (
                    <span className="text-sm font-medium text-emerald-800/80 dark:text-emerald-200/80 mt-2 block">
                      Ticket: S/ {ticketTotal.toFixed(2)} + <span className="text-rose-600 dark:text-rose-400 font-bold">Recargo ({izipayRate}%): S/ {izipayFee.toFixed(2)}</span>
                    </span>
                  )}
                  {totalServices > 0 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-500/20">
                      <span className="text-xs text-emerald-700/80 font-medium">
                        (Incluye S/ {totalServices.toFixed(2)} en servicios)
                      </span>
                    </div>
                  )}
                </div>

                {/* Tipo de comprobante + inputs cliente */}
                <div className="space-y-4">
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider block">Comprobante</span>
                  <div className="flex gap-2">
                    {VOUCHER_TYPES.map(({ id, label }: any) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setVoucherType(id);
                          setSelectedCustomerId(null);
                          if (id === "TICKET") {
                            setDocNumber("");
                            setDocName("CLIENTE VARIOS");
                          } else {
                            if (docName === "CLIENTE VARIOS") setDocName("");
                            setDocNumber("");
                          }
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${voucherType === id
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground/40"
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {needsDocInfo && (
                    <div className="space-y-3 relative">
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          placeholder={voucherType === "BOLETA" ? "DNI (8 dígitos)" : "RUC (11 dígitos)"}
                          value={docNumber}
                          maxLength={voucherType === "BOLETA" ? 8 : 11}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, "");
                            if (voucherType === "BOLETA" && val.length > 8) val = val.slice(0, 8);
                            if (voucherType === "FACTURA" && val.length > 11) val = val.slice(0, 11);
                            setDocNumber(val);
                            setCustomerQuery(val);
                          }}
                          className={`w-full pl-9 pr-12 py-2 rounded-lg border bg-background text-foreground font-mono text-sm outline-none transition-colors ${docNumber && !docNumberValid
                            ? "border-red-500"
                            : docNumberValid && docNumber
                              ? "border-emerald-500"
                              : "border-border"
                            }`}
                        />
                      </div>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          placeholder={voucherType === "BOLETA" ? "Nombre completo" : "Razón Social"}
                          value={docName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDocName(val);
                            setCustomerQuery(val);
                          }}
                          className={`w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-foreground text-sm outline-none transition-colors ${docName && !docNameValid
                            ? "border-red-500"
                            : docNameValid && docName
                              ? "border-emerald-500"
                              : "border-border"
                            }`}
                        />
                      </div>

                      {showDropdown && (
                        <div className="absolute top-[100%] mt-1 left-0 right-0 bg-card border border-border shadow-xl rounded-lg z-50 overflow-hidden flex flex-col">
                          {customerResults.map((c: any) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCustomer(c)}
                              className="w-full text-left px-3 py-2.5 hover:bg-secondary transition-colors border-b border-border/50 last:border-0 flex flex-col"
                            >
                              <span className="font-bold text-foreground text-xs truncate">{c.business_name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{c.doc_number || "Sin doc."}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer fijo — acciones */}
          <div className="shrink-0 border-t border-border px-8 pt-6 pb-8 bg-card flex gap-4">
            <button
              onClick={closeModal}
              className="h-12 flex-1 rounded-xl border border-border text-muted-foreground hover:bg-secondary font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" /> VOLVER
            </button>
            <button
              id="btn-confirmar-cobro"
              onClick={openReview}
              disabled={!canConfirm}
              className={`h-12 flex-[2] rounded-xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${!canConfirm
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/30"
                }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Confirmar Cobro
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════
          REVIEW MODAL — confirm before DB write
          ════════════════════════════════════════ */}
      {isReviewing && selectedTicket && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border-2 border-border rounded-2xl shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border bg-background/50">
              <div className="text-lg font-black text-foreground">Revisar y Confirmar</div>
              <div className="text-xs text-muted-foreground mt-0.5">Verifica los datos antes de guardar</div>
            </div>

            {/* Summary Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Bloque 1: Comprobante y Cliente */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1">
                <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  COMPROBANTE
                </span>
                <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {voucherType === "TICKET" ? (
                    "Ticket / Simple"
                  ) : voucherType === "BOLETA" ? (
                    `Boleta ${docNumber ? `— ${docNumber}` : ""}`
                  ) : (
                    `Factura ${docNumber ? `— ${docNumber}` : ""}`
                  )}
                </div>
                {docName && (
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    {docName}
                  </div>
                )}
              </div>

              {/* Bloque 2: Desglose de Pago */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  Desglose de Pago
                </span>
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {PAYMENT_METHODS.filter((m: any) => parseFloat(paymentAmounts[m.id]) > 0).map((m: any) => (
                    <div key={m.id} className="flex justify-between items-center py-1.5 text-sm">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        {m.label}
                        {m.id === "IZIPAY" && izipayFee > 0 && (
                          <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-extrabold border border-amber-200">
                            +S/ {izipayFee.toFixed(2)} ({izipayRate}%)
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        S/ {parseFloat(paymentAmounts[m.id]).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloque 3: Total Cobrado */}
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Total Cobrado
                </span>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  S/ {finalTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setIsReviewing(false)}
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-xl border border-border text-muted-foreground hover:bg-secondary font-bold text-sm transition-colors"
              >
                ← Volver
              </button>
              <button
                id="btn-review-confirm"
                autoFocus
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className={`flex-[2] h-11 rounded-xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${isSubmitting
                  ? "bg-emerald-800 text-emerald-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                  }`}
              >
                {isSubmitting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> CONFIRMAR</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Print Modal ── */}
      {showSuccessModal && successSaleData && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">¡Venta Exitosa!</h2>
            <p className="text-gray-500 text-center mb-6">El cobro ha sido procesado correctamente.</p>



            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full font-bold py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              CERRAR
            </button>
            <p className="text-xs text-gray-400 mt-2">Presiona Enter para continuar</p>
          </div>
        </div>
      )}

      

    </>
  );
}
