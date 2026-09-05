"use client";
import React from "react";
import { Button, Card, CardContent } from "@goltex/ui";
import { ShoppingCart, Scissors, Trash2, XCircle, Printer, RefreshCw } from "lucide-react";
import { usePos } from "../context/PosContext";

export default function PosCart() {
  const {
    cart, removeFromCart, openNumpad, quickAccessServices, total, deleteDraftTicket, handleEmitTicket, isEmitting, isCajaOpen
  } = usePos();

  return (
    <>
      <div className="flex-1 overflow-auto p-2 space-y-1 bg-secondary/5 pb-20 lg:pb-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-40">
            <ShoppingCart className="w-20 h-20" />
            <p className="text-xl font-bold">Proforma Vacía</p>
            <p className="text-sm text-center">Selecciona telas del catálogo para agregar</p>
          </div>
        ) : (
          <>
            <div className="text-center font-mono text-muted-foreground/40 text-xs tracking-widest select-none">
              ───────────────────────────────
            </div>
            {cart.map((item, idx) => {
              const isService = item.is_service;
              const handleCardClick = () => {
                openNumpad(item, item);
              };
              return (
                <div key={item.cartItemId}>
                  <Card className="bg-background border-border shadow-sm rounded-2xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
                    onClick={handleCardClick}>
                    <CardContent className="px-2 py-1.5">
                      <div className="flex items-start justify-between mb-0.5">
                        <div className="text-xs font-bold text-foreground leading-tight flex items-start gap-1.5 flex-1 pr-2">
                          {isService && (
                            <Scissors className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                          )}
                          <span className="font-mono text-primary shrink-0 mt-px">{item.code}</span>
                          <span className="whitespace-normal text-left flex-1">{item.name} {!isService && <span className="text-[10px] text-muted-foreground ml-1 inline-block">(S/ {item.price.toFixed(2)})</span>}</span>
                        </div>
                        <button className="w-7 h-7 flex items-center justify-center text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors shrink-0"
                          onClick={(e) => removeFromCart(item.cartItemId, e)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex justify-between items-end">
                        {isService ? (
                          <div className="text-muted-foreground font-mono text-[10px] font-bold">
                            Precio: S/ {item.editedPrice.toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-muted-foreground font-mono text-[10px] font-bold flex items-center gap-1.5 flex-wrap">
                            <span>{item.quantity} MTS × S/ {item.editedPrice.toFixed(2)}</span>
                            {item.cuts && item.cuts.length > 0 && (
                              <span className="text-[9px] font-sans font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                                {item.cuts.length} {item.cuts.length === 1 ? 'corte' : 'cortes'}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="text-base font-black text-foreground leading-none">
                          S/ {(item.editedPrice * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {idx < cart.length - 1 && (
                    <div className="text-center font-mono text-muted-foreground/25 text-[10px] tracking-widest select-none py-0.5">
                      · · · · · · · · · · · · · · · ·
                    </div>
                  )}
                </div>
              )
            })}
            <div className="text-center font-mono text-muted-foreground/40 text-xs tracking-widest select-none">
              ───────────────────────────────
            </div>
          </>
        )}
      </div>

      {/* Footer Cart */}
      <div className="p-3 border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.06)] shrink-0 pb-20 lg:pb-3">
        {quickAccessServices.length > 0 && (
          <div className="mb-2 flex gap-2">
            {quickAccessServices.map((svc, idx) => {
              const existing = cart.find(i => i.id === svc.id);
              return (
                <Button
                  key={svc.id}
                  onClick={() => openNumpad({ id: svc.id, familyId: 'SERVICE', name: svc.name, code: 'SVC', price: 0, is_service: true }, existing)}
                  variant="outline"
                  className={`flex-1 h-8 border-dashed border-2 font-bold text-[10px] flex items-center justify-center gap-2 transition-colors uppercase ${existing
                    ? (idx === 1 ? "border-orange-400 text-orange-600 bg-orange-50 hover:bg-orange-100" : "border-purple-400 text-purple-600 bg-purple-50 hover:bg-purple-100")
                    : "hover:bg-primary/5 hover:text-primary"
                    }`}
                >
                  <Scissors className="w-3 h-3" />
                  {existing ? `EDITAR ${svc.name}` : `+ ${svc.name}`}
                </Button>
              );
            })}
          </div>
        )}
        {cart.length > 0 && (
          <div className="mb-3">
            <div className="flex justify-between items-center text-xl font-black font-mono">
              <span>TOTAL</span>
              <span className="text-emerald-500">S/ {total.toFixed(2)}</span>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          {cart.length > 0 && (
            <Button variant="ghost" className="h-12 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
              onClick={deleteDraftTicket}>
              <XCircle className="w-5 h-5" />
            </Button>
          )}
          <button
            onClick={handleEmitTicket}
            disabled={cart.length === 0 || isEmitting || !isCajaOpen}
            className={`flex-1 h-12 rounded-xl text-sm font-black tracking-wide transition-all flex items-center justify-center gap-2 shadow-md ${cart.length === 0 || isEmitting || !isCajaOpen
              ? "bg-secondary text-muted-foreground cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.01] active:scale-[0.99]"
              }`}
          >
            {isEmitting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Emitiendo...</>
            ) : (
              <><Printer className="w-4 h-4" /> EMITIR TICKET DE CORTE</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
