"use client";
import React from "react";
import { Button } from "@goltex/ui";
import { CheckCircle2, Lock, Layers, Scissors, X, Delete } from "lucide-react";
import { usePos } from "../context/PosContext";
import { useRole } from "../../context/RoleContext";

export default function PosCatalog() {
  const {
    isCajaOpen, handleOpenCaja, viewMode, setViewMode, activeFamily, setActiveFamily, search, setSearch,
    familyPage, setFamilyPage, servicesPage, setServicesPage, searchPage, setSearchPage,
    familyPagePills, searchFamiliesInPage, searchProductsInPage, combinedSearchResults, totalSearchPages, matchedProducts,
    qwertyOpen, setQwertyOpen, handleQwertyKey, localServices, families, openNumpad, setNumpadProduct
  } = usePos();
  const { permissions } = useRole();

  const servicesPageSize = 12;
  const familyPageSize = 15;
  const searchPageSize = 12;

  if (!isCajaOpen) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-secondary/5 pb-20 lg:pb-8">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6 shadow-inner animate-bounce">
          <Lock className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black tracking-tight mb-2">Caja Actualmente Cerrada</h2>
        <p className="text-muted-foreground max-w-md text-sm mb-6 leading-relaxed">
          {permissions?.pos_open_caja
            ? "Para comenzar a explorar productos, seleccionar telas y emitir tickets de corte, realiza la apertura de caja."
            : "Todavía no se ha aperturado la caja del día. Solicita a un usuario administrador o supervisor realizar la apertura."}
        </p>
        {permissions?.pos_open_caja && (
          <button
            onClick={handleOpenCaja}
            className="px-6 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-3 cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            Aperturar Caja Ahora
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-secondary/10 flex flex-col pb-20 lg:pb-0 relative">
      {/* QWERTY */}
      {qwertyOpen && (
        <div className="fixed inset-x-2 top-20 sm:absolute sm:top-[20px] sm:left-6 sm:right-6 bg-card border-2 border-border/80 rounded-3xl p-3 sm:p-5 shadow-2xl z-50 flex flex-col gap-2 animate-in fade-in duration-200 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-1 px-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Teclado Virtual</span>
            <button onClick={() => setQwertyOpen(false)} className="text-red-500 hover:bg-red-500/10 font-bold p-1 rounded-lg flex items-center gap-1 text-xs cursor-pointer">
              <span>Cerrar</span> <X className="w-4 h-4" />
            </button>
          </div>
          {[["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"], ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"]].map((row, ri) => (
            <div key={ri} className="flex gap-1.5 justify-center">
              {row.map((key) => (
                <button key={key} onClick={() => handleQwertyKey(key)}
                  className="h-10 sm:h-12 flex-1 max-w-[50px] bg-secondary/80 hover:bg-primary hover:text-white rounded-xl font-bold text-base sm:text-lg active:scale-95 transition-all touch-manipulation cursor-pointer">
                  {key}
                </button>
              ))}
            </div>
          ))}
          <div className="flex gap-1.5 justify-center">
            {["Z", "X", "C", "V", "B", "N", "M"].map((key) => (
              <button key={key} onClick={() => handleQwertyKey(key)}
                className="h-10 sm:h-12 flex-1 max-w-[50px] bg-secondary/80 hover:bg-primary hover:text-white rounded-xl font-bold text-base sm:text-lg active:scale-95 transition-all touch-manipulation cursor-pointer">
                {key}
              </button>
            ))}
            <button onClick={() => handleQwertyKey("DEL")} className="h-10 sm:h-12 px-4 sm:px-5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer">
              <Delete className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2 justify-center mt-1">
            <button onClick={() => { setSearch(""); setActiveFamily(null); }} className="h-10 sm:h-12 px-4 sm:px-5 bg-secondary/40 text-muted-foreground hover:bg-secondary rounded-xl font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer">Limpiar</button>
            <button onClick={() => handleQwertyKey("SPACE")} className="h-10 sm:h-12 flex-1 max-w-[300px] bg-secondary/80 hover:bg-primary hover:text-white rounded-xl font-bold text-xs sm:text-sm active:scale-95 transition-all uppercase cursor-pointer">Espacio</button>
            <button onClick={() => setQwertyOpen(false)} className="h-10 sm:h-12 px-6 sm:px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs sm:text-sm active:scale-95 transition-all uppercase cursor-pointer">OK</button>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full overflow-auto">
        <div className="h-12 flex items-center justify-between px-3 sm:px-6 shrink-0 border-b border-border/30 bg-surface/50">
          {viewMode === 'SERVICES' ? (
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-transparent border-0 flex-1 min-w-0 mr-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
              <Button variant="ghost" className="h-8 px-2.5 rounded-lg border border-border/50 text-xs font-bold hover:bg-purple-50 hover:text-purple-600 transition-colors shrink-0" disabled={servicesPage === 1} onClick={() => setServicesPage(p => p - 1)}>Anterior</Button>
              <span className="whitespace-nowrap text-[11px] font-bold text-muted-foreground uppercase shrink-0">
                Pág {servicesPage} de {Math.max(1, Math.ceil(localServices.length / servicesPageSize))}
              </span>
              <Button variant="ghost" className="h-8 px-2.5 rounded-lg border border-border/50 text-xs font-bold hover:bg-purple-50 hover:text-purple-600 transition-colors shrink-0" disabled={servicesPage === Math.max(1, Math.ceil(localServices.length / servicesPageSize))} onClick={() => setServicesPage(p => p + 1)}>Siguiente</Button>
            </div>
          ) : viewMode === 'FAMILIES' && !activeFamily && !search ? (
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 min-w-0 mr-2 no-scrollbar">
              {familyPagePills.map((pill) => (
                <button
                  key={pill.page}
                  type="button"
                  onClick={() => setFamilyPage(pill.page)}
                  className={`h-8 px-3 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer shadow-sm ${familyPage === pill.page
                    ? "bg-emerald-600 text-white shadow-emerald-500/20"
                    : "bg-background border border-border/60 text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-600 hover:bg-emerald-50/50"
                    }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 min-w-0"></div>
          )}

          <div className="flex bg-secondary/40 p-1 rounded-xl border border-border shrink-0">
            <button
              type="button"
              onClick={() => { setViewMode('FAMILIES'); setActiveFamily(null); setNumpadProduct(null); }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'FAMILIES'
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Telas</span>
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('SERVICES'); setActiveFamily(null); setNumpadProduct(null); }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'SERVICES'
                ? "bg-purple-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Servicios</span>
            </button>
          </div>
        </div>

        {viewMode === 'SERVICES' ? (
          <div className="p-3 sm:p-6">
            <h2 className="h-8 flex items-center shrink-0 whitespace-nowrap text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Todos los Servicios</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {localServices.slice((servicesPage - 1) * servicesPageSize, servicesPage * servicesPageSize).map((svc) => (
                <button key={svc.id} onClick={() => {
                  openNumpad({ id: svc.id, familyId: 'SERVICE', name: svc.name, code: 'SVC', price: 0, is_service: true }, undefined); // Simplified for existing lookup inside openNumpad or handled dynamically
                }}
                  className="flex flex-col items-center justify-center p-3 sm:p-6 bg-purple-50 border-2 border-purple-200 hover:bg-purple-100 transition-all active:scale-[0.96] rounded-2xl shadow-sm text-center gap-2 cursor-pointer text-purple-700">
                  <div className="text-sm sm:text-xl font-black uppercase tracking-tight line-clamp-2">{svc.name}</div>
                </button>
              ))}
              {localServices.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground text-base sm:text-lg">No hay servicios registrados.</div>
              )}
            </div>
          </div>
        ) : !activeFamily && !search ? (
          <div className="p-3 sm:p-6 flex flex-col h-full">
            <h2 className="h-8 flex items-center shrink-0 whitespace-nowrap text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Familias de Tela</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 flex-1 content-start">
              {families.slice((familyPage - 1) * familyPageSize, familyPage * familyPageSize).map((fam) => (
                <button key={fam.id} onClick={() => { setActiveFamily(fam); setNumpadProduct(null); }}
                  className="text-left p-2.5 sm:p-3 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 flex flex-col items-start gap-1 min-w-0">
                  <div className="text-lg sm:text-2xl font-black mb-0.5 opacity-80">{fam.code}</div>
                  <div className="text-xs sm:text-base font-semibold tracking-tight truncate w-full">{fam.name}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
            {search ? (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Resultados ({combinedSearchResults.length}) — Pág. {searchPage}/{totalSearchPages || 1}
                  </h2>
                </div>
                {searchFamiliesInPage.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Familias</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      {searchFamiliesInPage.map((fam) => (
                        <button key={fam.id}
                          onClick={() => { setActiveFamily(fam); setSearch(""); setQwertyOpen(false); setNumpadProduct(null); }}
                          className={`text-left p-3 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer bg-glass shadow-sm ${fam.color || "border-border hover:border-primary"}`}>
                          <div className="text-2xl font-black mb-1 opacity-80">{fam.code}</div>
                          <div className="text-base font-semibold tracking-tight">{fam.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {searchProductsInPage.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Telas</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {searchProductsInPage.map((product) => (
                        <button key={product.id} onClick={() => openNumpad(product)}
                          className="flex flex-col items-center justify-center p-3 bg-glass border-2 border-border hover:border-primary/50 transition-all active:scale-[0.96] rounded-2xl shadow-sm text-center gap-2 cursor-pointer">
                          <div className="text-sm font-black uppercase tracking-tight"><span className="font-mono text-primary mr-1.5">{product.code}</span>{product.name}</div>
                          <div className="text-lg font-black text-primary">S/ {product.price.toFixed(2)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {combinedSearchResults.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-lg">Sin resultados para "{search}".</div>
                )}
                {totalSearchPages > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide border-t border-border/55 pt-4 pb-2">
                    {Array.from({ length: totalSearchPages }).map((_, i) => (
                      <Button key={i + 1} variant={searchPage === i + 1 ? "default" : "outline"}
                        className="h-10 px-4 text-xs sm:text-sm rounded-xl font-bold whitespace-nowrap shrink-0" onClick={() => setSearchPage(i + 1)}>
                        {i * searchPageSize + 1}–{Math.min((i + 1) * searchPageSize, combinedSearchResults.length)}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="h-8 flex items-center shrink-0 whitespace-nowrap text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Familia {activeFamily?.code} — {activeFamily?.name}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                  {matchedProducts.map((product) => (
                    <button key={product.id} onClick={() => openNumpad(product)}
                      className="flex flex-col items-center justify-center p-2.5 sm:p-3 bg-glass border-2 border-border hover:border-primary/50 transition-all active:scale-[0.96] rounded-xl sm:rounded-2xl shadow-sm text-center gap-1 cursor-pointer min-w-0">
                      <div className="text-[11px] sm:text-sm font-bold uppercase tracking-tight truncate w-full"><span className="font-mono text-primary mr-1">{product.code}</span>{product.name}</div>
                      <div className="text-xs sm:text-lg font-black text-primary">S/ {product.price.toFixed(2)}</div>
                    </button>
                  ))}
                  {matchedProducts.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground text-sm sm:text-lg">Sin telas en esta categoría.</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
