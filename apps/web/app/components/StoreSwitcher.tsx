'use client';

import React, { useState } from 'react';
import { createPortal } from "react-dom";
import { usePathname } from 'next/navigation';
import { Store as StoreIcon, ChevronDown, Check, Building2, LayoutGrid, Loader2 } from 'lucide-react';
import { useStore, Store as StoreType } from '../context/StoreContext';

export default function StoreSwitcher() {
  const pathname = usePathname();
  const { activeStore, availableStores, setActiveStore, setAllStoresMode, isLoadingStores, isAllStoresMode, isGlobalUser, availableStoreIds } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const cleanPath = (pathname || '').replace(/\/$/, '') || '/';
  const isSingleStoreRoute =
    cleanPath === '/hub' ||
    cleanPath.startsWith('/pos') ||
    cleanPath.startsWith('/caja');

  const showAllStoresOption = !isSingleStoreRoute && availableStores.length >= 2;

  if (isLoadingStores) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-xs font-semibold text-muted-foreground animate-pulse">
        <Building2 className="w-3.5 h-3.5" />
        <span>Cargando tienda...</span>
      </div>
    );
  }

  // Si solo tiene acceso a 1 tienda, mostrar etiqueta estática (sin opción "Todas")
  if (availableStores.length <= 1) {
    const storeName = activeStore?.name || availableStores[0]?.name || "Sin tienda";
    return (
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 text-xs font-bold select-none">
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        <span>{storeName}</span>
      </div>
    );
  }

  // Texto del botón según el modo
  const isDisplayingAllMode = isAllStoresMode && !isSingleStoreRoute;
  const buttonLabel = isDisplayingAllMode
    ? (isGlobalUser ? "Todas las Tiendas" : "Mis Tiendas (Todas)")
    : activeStore?.name || availableStores[0]?.name || "Seleccionar tienda";
  const ButtonIcon = isDisplayingAllMode ? LayoutGrid : Building2;

  const handleSelectStore = async (store: StoreType) => {
    setIsOpen(false);
    if (store.id !== activeStore?.id || isAllStoresMode) {
      setIsSwitching(true);
      await setActiveStore(store);
      window.location.reload();
    }
  };

  const handleSelectAll = async () => {
    setIsOpen(false);
    if (!isAllStoresMode) {
      setIsSwitching(true);
      await setAllStoresMode();
      window.location.reload();
    }
  };

  return (
    <div className="relative inline-block text-left shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full text-white text-xs font-bold transition-all shadow-sm cursor-pointer border shrink-0 whitespace-nowrap ${
          isAllStoresMode
            ? 'bg-amber-600 hover:bg-amber-700 border-amber-500/30'
            : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500/30'
        }`}
      >
        <ButtonIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate max-w-[120px] sm:max-w-xs">{buttonLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-card border-2 border-border/80 rounded-2xl shadow-2xl z-[9999] p-1.5">
            <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground border-b border-border mb-1">
              Cambiar de Tienda
            </div>
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {/* Opción "Todas las Tiendas" o "Mis Tiendas" según acceso */}
              {showAllStoresOption && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors text-left ${
                      isAllStoresMode
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'text-foreground hover:bg-secondary/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <LayoutGrid className={`w-4 h-4 shrink-0 ${isAllStoresMode ? 'text-amber-600' : 'text-muted-foreground'}`} />
                      <div className="truncate">
                        <div className="truncate">
                          {isGlobalUser ? "Todas las Tiendas" : "Mis Tiendas (Todas)"}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-normal truncate">
                          {isGlobalUser ? (
                            "Vista consolidada global"
                          ) : (
                            availableStoreIds.length === availableStores.length
                              ? `Consolidando ${availableStoreIds.length} sucursales`
                              : `${availableStoreIds.length} de ${availableStores.length} sucursales con acceso aquí`
                          )}
                        </div>
                      </div>
                    </div>
                    {isAllStoresMode && <Check className="w-4 h-4 text-amber-600 shrink-0 ml-1" />}
                  </button>

                  {/* Separador */}
                  <div className="border-t border-border my-1" />
                </>
              )}

              {/* Tiendas individuales */}
              {availableStores.map(store => {
                const isSelected = !isDisplayingAllMode && (store.id === activeStore?.id || (!activeStore && store.id === availableStores[0]?.id));
                return (
                  <button
                    key={store.id}
                    onClick={() => handleSelectStore(store)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors text-left ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'text-foreground hover:bg-secondary/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StoreIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                      <div className="truncate">
                        <div className="truncate">{store.name}</div>
                        {store.role && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            Rol: {store.role}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {isSwitching && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-100">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <h2 className="text-xl font-bold text-foreground">Cambiando tienda...</h2>
          <p className="text-sm text-muted-foreground mt-2">Sincronizando entorno de trabajo</p>
        </div>,
        document.body
      )}
    </div>
  );
}
