"use client";
import React from "react";
import { Button } from "@goltex/ui";
import { ArrowLeft, X, Delete } from "lucide-react";
import { usePos } from "../context/PosContext";

export default function PosNumpadModal() {
  const {
    numpadProduct, setNumpadProduct, numpadField, setNumpadField, numpadQty, numpadPrice,
    handleNumpadKey, previewPrice, previewQty, previewSubtotal, handleNumpadOk, cart
  } = usePos();

  if (!numpadProduct) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm sm:max-w-md bg-card rounded-3xl p-3 sm:p-5 flex flex-col gap-2 shadow-2xl justify-start h-auto max-h-[92vh] overflow-y-auto border border-border/60">
        {/* Header */}
        <div className="pb-2 border-b border-border bg-surface/50 rounded-2xl text-center shrink-0 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-full sm:hidden"
            onClick={() => setNumpadProduct(null)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <span className="font-mono text-xs sm:text-sm font-black text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg shrink-0">{numpadProduct.code}</span>
            <h3 className="text-sm sm:text-base font-black uppercase text-primary truncate max-w-[180px] sm:max-w-none">{numpadProduct.name}</h3>
          </div>
          <button
            onClick={() => setNumpadProduct(null)}
            className="w-8 h-8 rounded-full bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quantity and Price Inputs */}
        <div className="p-2.5 bg-secondary/10 border border-border/60 rounded-2xl flex flex-col gap-2 shrink-0">
          {!numpadProduct.is_service && (
            <div className="flex gap-2 sm:gap-3">
              <div className="flex-1 bg-background rounded-xl border-2 border-border p-2 text-center opacity-60">
                <div className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Precio Fijo</div>
                <div className="text-xs sm:text-lg font-bold">S/ {numpadProduct.price.toFixed(2)}</div>
              </div>
              <div className={`flex-1 rounded-xl border-2 p-2 text-center cursor-pointer transition-all ${numpadField === "price" ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                onClick={() => setNumpadField("price")}>
                <div className={`text-[9px] sm:text-[10px] font-bold uppercase mb-0.5 ${numpadField === "price" ? "text-primary" : "text-muted-foreground"}`}>Precio Variable</div>
                <div className={`text-xs sm:text-lg font-bold ${numpadField === "price" ? "text-primary" : "text-foreground"}`}>S/ {numpadPrice || "0.00"}</div>
              </div>
            </div>
          )}
          {numpadProduct.is_service && (
            <div className="flex gap-2 sm:gap-3">
              <div className={`flex-1 rounded-xl border-2 p-2 text-center cursor-pointer transition-all border-purple-500 bg-purple-500/10`}
                onClick={() => setNumpadField("price")}>
                <div className={`text-[9px] sm:text-[10px] font-bold uppercase mb-0.5 text-purple-600`}>Precio del Servicio</div>
                <div className={`text-xs sm:text-lg font-bold text-foreground`}>S/ {numpadPrice || "0.00"}</div>
              </div>
            </div>
          )}
          {!numpadProduct.is_service && (
            <div className={`w-full rounded-xl border-2 p-2 text-center cursor-pointer transition-all flex items-center justify-center gap-2 ${numpadField === "qty" ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-background"}`}
              onClick={() => setNumpadField("qty")}>
              <div className={`text-xs font-bold uppercase ${numpadField === "qty" ? "text-emerald-600" : "text-muted-foreground"}`}>Cantidad:</div>
              <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tighter ${numpadField === "qty" ? "text-emerald-500" : "text-foreground"}`}>{numpadQty || "0"}</div>
              <div className={`text-xs sm:text-sm font-bold uppercase ${numpadField === "qty" ? "text-emerald-600" : "text-muted-foreground"}`}>
                mts
              </div>
            </div>
          )}
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-3 gap-1.5 shrink-0 pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button key={num} onClick={() => handleNumpadKey(num)}
              className="h-10 sm:h-11 text-lg sm:text-xl font-black rounded-xl bg-secondary/60 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation cursor-pointer">
              {num}
            </button>
          ))}
          <button onClick={() => handleNumpadKey(".")}
            className="h-10 sm:h-11 text-lg sm:text-xl font-black rounded-xl bg-secondary/60 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation cursor-pointer">
            .
          </button>
          <button onClick={() => handleNumpadKey("0")} className="h-10 sm:h-11 text-lg sm:text-xl font-black rounded-xl bg-secondary/60 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation cursor-pointer">0</button>
          <button onClick={() => handleNumpadKey("DEL")} className="h-10 sm:h-11 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border-2 border-transparent active:bg-red-500 active:text-white transition-colors touch-manipulation cursor-pointer">
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Subtotal */}
        <div className="bg-background border-2 border-border rounded-xl p-2 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-mono font-bold text-muted-foreground">
            {numpadProduct.is_service ? `S/ ${previewPrice.toFixed(2)}` : `${previewQty} MTS × S/ ${previewPrice.toFixed(2)}`}
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-500 font-mono">S/ {previewSubtotal.toFixed(2)}</div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 sm:gap-3 shrink-0 pt-1 pb-1">
          <Button variant="outline" className="h-11 flex-1 text-xs sm:text-sm font-bold uppercase rounded-xl border-2" onClick={() => setNumpadProduct(null)}>Cancelar</Button>
          <Button className="h-11 flex-[2] text-sm sm:text-base font-black uppercase rounded-xl shadow-xl bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleNumpadOk}
            disabled={(!numpadProduct.is_service && (!numpadQty || parseFloat(numpadQty) <= 0)) || !numpadPrice}>
            {cart.find((c) => c.id === numpadProduct.id) ? "Actualizar" : "Agregar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
