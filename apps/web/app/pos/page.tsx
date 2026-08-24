"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@goltex/ui";
import { Lock, RefreshCw, Eye, ShoppingCart, Search } from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useStore } from "../context/StoreContext";
import { PosProvider, usePos } from "./context/PosContext";

import PosHeader from "./components/PosHeader";
import PosCatalog from "./components/PosCatalog";
import PosCart from "./components/PosCart";
import PosHistory from "./components/PosHistory";
import PosNumpadModal from "./components/PosNumpadModal";
import ReceiptPreview from "../components/ReceiptPreview";

function PosContent() {
  const { role, isHydrated, permissions } = useRole();
  const { isAllStoresMode } = useStore();
  const router = useRouter();
  const [hasPosAccess, setHasPosAccess] = useState(false);

  const {
    mobileTab, setMobileTab, rightPanelMode, setRightPanelMode, isCajaOpen, activePrinter,
    closingCajaLoading, cajaSummaryOpen, setCajaSummaryOpen, cajaSummary, confirmCloseCaja,
    exitGuardOpen, setExitGuardOpen, handleExitWithoutSaving,
    previewTicketData, setPreviewTicketData,
    isClearCartModalOpen, setIsClearCartModalOpen, setCart, cart
  } = usePos();

  useEffect(() => {
    if (!isHydrated) return;
    if (permissions && !permissions.access_pos) {
      router.replace("/hub");
    } else if (permissions?.access_pos) {
      setHasPosAccess(true);
    }
  }, [permissions, isHydrated, router]);

  if (!isHydrated || !hasPosAccess) return null;

  if (isAllStoresMode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background min-h-[100dvh]">
        <div className="max-w-md w-full p-8 text-center space-y-6 bg-card border border-border rounded-2xl shadow-xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Bloqueo Operativo</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              El Punto de Venta es un módulo físico. No puedes cobrar en modo consolidado ("Todas las Tiendas").
              <br /><br />
              Por favor, selecciona una tienda específica en el menú superior para poder operar.
            </p>
          </div>
          <Button variant="default" className="w-full font-bold h-12 text-sm bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => router.push('/hub')}>
            Volver al Hub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] bg-background text-foreground overflow-hidden relative">

      {/* LEFT PANEL — Catálogo de Telas */}
      <div className={`flex-1 flex flex-col h-full border-r border-border overflow-hidden bg-secondary/10 ${mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'}`}>
        <PosHeader />
        <PosCatalog />
      </div>

      {/* RIGHT PANEL — Proforma + Emitir + Historial */}
      <div className={`w-full lg:w-[360px] xl:w-[440px] 2xl:w-[500px] flex flex-col h-full bg-surface shadow-xl z-20 shrink-0 border-t lg:border-t-0 lg:border-l border-border ${mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'} ${!isCajaOpen ? 'pointer-events-none opacity-40 select-none' : ''}`}>

        {/* Header en móvil para volver al catálogo */}
        <div className="lg:hidden flex items-center justify-between p-3 border-b border-border bg-card">
          <Button variant="ghost" size="sm" className="gap-2 font-bold text-xs" onClick={() => setMobileTab('catalog')}>
            Volver al Catálogo
          </Button>
          <span className="font-black text-sm uppercase text-primary">Proforma Actual</span>
        </div>

        <div className="px-5 pt-5 pb-3 border-b border-border bg-card shrink-0 flex flex-col gap-3">
          <div className="flex gap-2 bg-secondary/30 p-1 rounded-xl">
            <button
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${rightPanelMode === 'cart' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setRightPanelMode('cart')}
            >
              Nueva Proforma
            </button>
            <button
              disabled={!isCajaOpen}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${!isCajaOpen ? 'opacity-40 cursor-not-allowed text-muted-foreground' : rightPanelMode === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => isCajaOpen && setRightPanelMode('history')}
            >
              Mis Proformas
            </button>
          </div>
          {rightPanelMode === 'cart' && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Resumen
              </span>
              <span className="text-xs font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">
                {cart.length} {cart.length === 1 ? "ítem" : "ítems"}
              </span>
            </div>
          )}
        </div>

        {rightPanelMode === 'cart' ? <PosCart /> : <PosHistory />}
      </div>

      {/* BARRA DE NAVEGACIÓN INFERIOR (MÓVIL) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-2 flex items-center justify-around gap-2 shadow-2xl h-16">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${mobileTab === 'catalog'
            ? 'bg-primary/10 text-primary font-black scale-105'
            : 'text-muted-foreground hover:bg-secondary/50 font-semibold'
            }`}
        >
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider">
            <Search className="w-4 h-4" />
            <span>Catálogo</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${mobileTab === 'cart'
            ? 'bg-emerald-500/10 text-emerald-600 font-black scale-105'
            : 'text-muted-foreground hover:bg-secondary/50 font-semibold'
            }`}
        >
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider relative">
            <ShoppingCart className="w-4 h-4" />
            <span>Proforma</span>
            {cart.length > 0 && (
              <span className="ml-1 bg-emerald-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none shadow-sm">
                {cart.length}
              </span>
            )}
          </div>
        </button>
      </div>

      <PosNumpadModal />

      {/* Modals */}
      <Dialog open={exitGuardOpen} onOpenChange={setExitGuardOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">¿Seguro que deseas salir?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Tienes telas en el carrito que no han sido registradas como proforma. Si sales ahora, se perderán estos datos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setExitGuardOpen(false)}>
              Cancelar y Seguir Aquí
            </Button>
            <Button variant="destructive" className="flex-1 h-12 font-bold" onClick={handleExitWithoutSaving}>
              Salir sin Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cajaSummaryOpen} onOpenChange={setCajaSummaryOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center mb-2">Resumen del Día</DialogTitle>
          </DialogHeader>

          {closingCajaLoading || !cajaSummary ? (
            <div className="py-10 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <p className="font-bold">Calculando recaudación total...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-2xl p-4 border border-border space-y-3">
                <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                  <span>EFECTIVO</span>
                  <span className="text-foreground">S/ {cajaSummary.efectivo.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                  <span>IZIPAY</span>
                  <span className="text-foreground">S/ {cajaSummary.izipay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                  <span>BCP</span>
                  <span className="text-foreground">S/ {cajaSummary.bcp.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                  <span>BBVA</span>
                  <span className="text-foreground">S/ {cajaSummary.bbva.toFixed(2)}</span>
                </div>
                <div className="pt-3 mt-3 border-t border-border flex justify-between items-center text-lg font-black">
                  <span>TOTAL FINAL</span>
                  <span className="text-emerald-500">S/ {cajaSummary.total.toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-3 rounded-xl text-xs font-semibold flex items-center justify-center text-center">
                Al confirmar, se imprimirá automáticamente el ticket de arqueo de caja.
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setCajaSummaryOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1 h-12 font-bold" onClick={confirmCloseCaja}>
                  Confirmar Cierre Definitivo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewTicketData} onOpenChange={(open) => !open && setPreviewTicketData(null)}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full bg-white text-slate-900 shadow-2xl rounded-2xl border border-slate-200 p-3.5 sm:p-6 overflow-hidden">
          <DialogHeader className="mb-1">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-slate-800">
              <Eye className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Vista Previa de Impresión</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-1 w-full overflow-x-auto font-mono text-xs">
            {previewTicketData && (
              <ReceiptPreview
                maxChars={activePrinter?.max_chars || 48}
                paperWidth={activePrinter?.paper_width || 80}
                saleData={previewTicketData}
              />
            )}
          </div>
          <div className="pt-2">
            <Button variant="outline" className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors border-0" onClick={() => setPreviewTicketData(null)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isClearCartModalOpen} onOpenChange={setIsClearCartModalOpen}>
        <DialogContent className="max-w-md p-6 bg-white rounded-2xl shadow-xl border-0">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span className="text-red-500">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
              </span>
              ¿Vaciar proforma actual?
            </DialogTitle>
          </DialogHeader>
          <div className="text-slate-600 mb-6">
            Esta acción eliminará todos los productos del carrito actual. No quedará ningún registro de este borrador.
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" className="rounded-xl font-semibold px-6 border-slate-200 hover:bg-slate-50 text-slate-700" onClick={() => setIsClearCartModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="default" className="rounded-xl font-bold px-6 bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow" onClick={() => { setCart([]); setIsClearCartModalOpen(false); }}>
              Vaciar Proforma
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function POSPage() {
  return (
    <PosProvider>
      <PosContent />
    </PosProvider>
  );
}
