"use client";
import React from "react";
import { Button } from "@goltex/ui";
import { ArrowLeft, X, Delete, Scissors, Plus, Trash2, Ruler } from "lucide-react";
import { usePos } from "../context/PosContext";

export default function PosNumpadModal() {
  const {
    numpadProduct,
    numpadCartItemId,
    numpadField,
    setNumpadField,
    numpadQty,
    setNumpadQty,
    numpadPrice,
    numpadMode,
    setNumpadMode,
    numpadCuts,
    setNumpadCuts,
    activeCutId,
    setActiveCutId,
    activeCutField,
    setActiveCutField,
    addNumpadCut,
    removeNumpadCut,
    selectCutField,
    isFieldFresh,
    setIsFieldFresh,
    handleNumpadKey,
    previewPrice,
    previewQty,
    previewSubtotal,
    handleNumpadOk,
    closeNumpad,
  } = usePos();

  if (!numpadProduct) return null;

  const isService = !!numpadProduct.is_service;

  const handleSwitchToDirect = () => {
    setNumpadMode("direct");
    setNumpadField("qty");
    setIsFieldFresh(true);
    if (previewQty > 0) {
      setNumpadQty(previewQty.toString());
    }
  };

  const handleSwitchToCuts = () => {
    setNumpadMode("cuts");
    setNumpadField("cut");
    setIsFieldFresh(true);
    if (numpadCuts.length === 0) {
      const initMeters = parseFloat(numpadQty) || 1;
      const initId = crypto.randomUUID();
      setNumpadCuts([
        {
          id: initId,
          count: 1,
          meters: initMeters,
          countStr: "1",
          metersStr: initMeters.toString(),
        },
      ]);
      setActiveCutId(initId);
      setActiveCutField("meters");
    } else if (!activeCutId && numpadCuts.length > 0) {
      setActiveCutId(numpadCuts[0]?.id ?? null);
      setActiveCutField("meters");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm sm:max-w-md bg-card rounded-3xl p-3 sm:p-5 flex flex-col gap-2 shadow-2xl justify-start h-auto max-h-[94vh] overflow-y-auto border border-border/60">
        {/* Header */}
        <div className="pb-2 border-b border-border bg-surface/50 rounded-2xl text-center shrink-0 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-full sm:hidden"
            onClick={closeNumpad}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <span className="font-mono text-xs sm:text-sm font-black text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg shrink-0">
              {numpadProduct.code}
            </span>
            <h3 className="text-sm sm:text-base font-black uppercase text-primary truncate max-w-[180px] sm:max-w-none">
              {numpadProduct.name}
            </h3>
          </div>
          <button
            onClick={closeNumpad}
            className="w-8 h-8 rounded-full bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs de Precio (Fijo y Variable) */}
        <div className="p-2.5 bg-secondary/10 border border-border/60 rounded-2xl flex flex-col gap-2 shrink-0">
          {!isService ? (
            <div className="flex gap-2 sm:gap-3">
              <div className="flex-1 bg-background rounded-xl border-2 border-border p-2 text-center opacity-60">
                <div className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-0.5">
                  Precio Fijo
                </div>
                <div className="text-xs sm:text-base font-bold">
                  S/ {numpadProduct.price.toFixed(2)}
                </div>
              </div>
              <div
                className={`flex-1 rounded-xl border-2 p-2 text-center cursor-pointer transition-all ${
                  numpadField === "price"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-background hover:border-primary/40"
                }`}
                onClick={() => {
                  setNumpadField("price");
                  setIsFieldFresh(true);
                }}
              >
                <div
                  className={`text-[9px] sm:text-[10px] font-bold uppercase mb-0.5 ${
                    numpadField === "price" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Precio Variable
                </div>
                <div
                  className={`text-xs sm:text-base font-bold ${
                    numpadField === "price" ? "text-primary" : "text-foreground"
                  }`}
                >
                  S/ {numpadPrice || "0.00"}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 sm:gap-3">
              <div
                className="flex-1 rounded-xl border-2 p-2 text-center cursor-pointer transition-all border-purple-500 bg-purple-500/10 shadow-sm"
                onClick={() => setNumpadField("price")}
              >
                <div className="text-[9px] sm:text-[10px] font-bold uppercase mb-0.5 text-purple-600">
                  Precio del Servicio
                </div>
                <div className="text-xs sm:text-base font-bold text-foreground">
                  S/ {numpadPrice || "0.00"}
                </div>
              </div>
            </div>
          )}

          {/* Selector de Modo para Telas: Metraje Directo vs Desglose de Cortes */}
          {!isService && (
            <div className="flex bg-secondary/50 p-1 rounded-xl gap-1 mt-0.5 border border-border/40">
              <button
                type="button"
                onClick={handleSwitchToDirect}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  numpadMode === "direct"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Metraje Directo</span>
              </button>
              <button
                type="button"
                onClick={handleSwitchToCuts}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  numpadMode === "cuts"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Desglose de Cortes</span>
              </button>
            </div>
          )}

          {/* Modo 1: Metraje Directo */}
          {!isService && numpadMode === "direct" && (
            <div
              className={`w-full rounded-xl border-2 p-2 text-center cursor-pointer transition-all flex items-center justify-center gap-2 ${
                numpadField === "qty"
                  ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                  : "border-border bg-background hover:border-emerald-500/40"
              }`}
              onClick={() => {
                setNumpadField("qty");
                setIsFieldFresh(true);
              }}
            >
              <div
                className={`text-xs font-bold uppercase ${
                  numpadField === "qty" ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                Cantidad:
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tighter ${
                  numpadField === "qty" ? "text-emerald-500" : "text-foreground"
                }`}
              >
                {numpadQty || "0"}
              </div>
              <div
                className={`text-xs sm:text-sm font-bold uppercase ${
                  numpadField === "qty" ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                mts
              </div>
            </div>
          )}

          {/* Modo 2: Desglose de Cortes */}
          {!isService && numpadMode === "cuts" && (
            <div className="flex flex-col gap-1.5">
              {/* Cabecera de columnas de cortes */}
              <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase px-2">
                <span className="w-16">Cortes</span>
                <span className="w-20 text-center">Medida</span>
                <span className="flex-1 text-right pr-7">Subtotal</span>
              </div>

              {/* Lista dinámica de filas de corte */}
              <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-0.5">
                {numpadCuts.map((cut) => {
                  const isCountActive =
                    activeCutId === cut.id &&
                    activeCutField === "count" &&
                    numpadField === "cut";
                  const isMetersActive =
                    activeCutId === cut.id &&
                    activeCutField === "meters" &&
                    numpadField === "cut";
                  const cutSubtotal = (cut.count || 0) * (cut.meters || 0);

                  return (
                    <div
                      key={cut.id}
                      className="flex items-center gap-1.5 bg-background p-1.5 rounded-xl border border-border/70 shadow-xs"
                    >
                      {/* Cantidad de piezas/cortes */}
                      <button
                        type="button"
                        onClick={() => selectCutField(cut.id, "count")}
                        className={`w-16 h-8 rounded-lg border-2 font-mono font-black text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
                          isCountActive
                            ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/20"
                            : "border-border bg-secondary/30 text-foreground hover:border-primary/40"
                        }`}
                      >
                        {cut.countStr !== "" ? (cut.countStr ?? cut.count) : "0"}
                        <span className="text-[9px] font-normal text-muted-foreground ml-0.5">
                          pz
                        </span>
                      </button>

                      <span className="text-muted-foreground text-xs font-bold">×</span>

                      {/* Metraje por cada corte */}
                      <button
                        type="button"
                        onClick={() => selectCutField(cut.id, "meters")}
                        className={`w-20 h-8 rounded-lg border-2 font-mono font-black text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
                          isMetersActive
                            ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/20"
                            : "border-border bg-secondary/30 text-foreground hover:border-primary/40"
                        }`}
                      >
                        {cut.metersStr !== "" ? (cut.metersStr ?? cut.meters) : "0"}
                        <span className="text-[9px] font-normal text-muted-foreground ml-0.5">
                          m
                        </span>
                      </button>

                      <span className="text-muted-foreground text-xs font-bold">=</span>

                      {/* Subtotal de metros */}
                      <div className="flex-1 text-right font-mono font-black text-xs sm:text-sm text-foreground pr-1 truncate">
                        {cutSubtotal.toFixed(2)}m
                      </div>

                      {/* Botón eliminar fila */}
                      <button
                        type="button"
                        onClick={() => removeNumpadCut(cut.id)}
                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 cursor-pointer"
                        title="Eliminar corte"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Botón añadir fila y total acumulado */}
              <div className="flex items-center justify-between pt-1 gap-2">
                <Button
                  type="button"
                  onClick={addNumpadCut}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold border-dashed border-2 flex items-center gap-1.5 rounded-xl hover:bg-primary/5 hover:text-primary"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Corte</span>
                </Button>
                <div className="text-xs font-mono font-bold text-muted-foreground">
                  Total:{" "}
                  <span className="text-emerald-500 font-black">
                    {previewQty.toFixed(2)} mts
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Teclado Numérico */}
        <div className="grid grid-cols-3 gap-1.5 shrink-0 pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleNumpadKey(num)}
              className="h-10 sm:h-11 text-lg sm:text-xl font-black rounded-xl bg-secondary/60 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleNumpadKey(".")}
            className="h-10 sm:h-11 text-lg sm:text-xl font-black rounded-xl bg-secondary/60 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation cursor-pointer"
          >
            .
          </button>
          <button
            type="button"
            onClick={() => handleNumpadKey("0")}
            className="h-10 sm:h-11 text-lg sm:text-xl font-black rounded-xl bg-secondary/60 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleNumpadKey("DEL")}
            className="h-10 sm:h-11 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border-2 border-transparent active:bg-red-500 active:text-white transition-colors touch-manipulation cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen Subtotal */}
        <div className="bg-background border-2 border-border rounded-xl p-2 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-mono font-bold text-muted-foreground truncate">
            {isService
              ? `S/ ${previewPrice.toFixed(2)}`
              : numpadMode === "cuts"
              ? `${previewQty.toFixed(2)} MTS (${numpadCuts.length} ${
                  numpadCuts.length === 1 ? "corte" : "cortes"
                }) × S/ ${previewPrice.toFixed(2)}`
              : `${previewQty} MTS × S/ ${previewPrice.toFixed(2)}`}
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-500 font-mono shrink-0">
            S/ {previewSubtotal.toFixed(2)}
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex gap-2 sm:gap-3 shrink-0 pt-1 pb-1">
          <Button
            variant="outline"
            className="h-11 flex-1 text-xs sm:text-sm font-bold uppercase rounded-xl border-2"
            onClick={closeNumpad}
          >
            Cancelar
          </Button>
          <Button
            className="h-11 flex-[2] text-sm sm:text-base font-black uppercase rounded-xl shadow-xl bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleNumpadOk}
            disabled={
              (!isService && previewQty <= 0) ||
              !numpadPrice ||
              isNaN(parseFloat(numpadPrice))
            }
          >
            {numpadCartItemId ? "Actualizar" : "Agregar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
