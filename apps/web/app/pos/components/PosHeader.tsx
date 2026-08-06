"use client";
import React from "react";
import { Button, Input } from "@goltex/ui";
import { ArrowLeft, Search, Sun, Moon } from "lucide-react";
import AccountSwitcher from "../../components/AccountSwitcher";
import { useTheme } from "../../context/ThemeContext";
import { useStore } from "../../context/StoreContext";
import { useRole } from "../../context/RoleContext";
import { usePos } from "../context/PosContext";

export default function PosHeader() {
  const { theme, toggleTheme } = useTheme();
  const { activeStore } = useStore();
  const { permissions } = useRole();
  const {
    handleBackClick, search, setQwertyOpen, isCajaOpen, handleOpenCaja, handleCloseCajaAttempt, ticketNumber
  } = usePos();

  return (
    <div className="p-3 sm:p-4 border-b border-border bg-card z-10 flex flex-col gap-2 shadow-sm relative shrink-0">
      {/* ESCRITORIO ADAPTATIVO (lg:flex) */}
      <div className="hidden lg:flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Button variant="ghost" size="icon" className="w-10 h-10 xl:w-11 xl:h-11 rounded-xl hover:bg-secondary/80 shrink-0" onClick={handleBackClick}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {activeStore && (
            <div className="flex flex-col text-left shrink-0">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Punto de Venta</span>
              <span className="text-xs font-black text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg mt-1 uppercase leading-none truncate max-w-[130px] xl:max-w-[160px]">
                {activeStore.name}
              </span>
            </div>
          )}
          <div className="relative flex-1 min-w-[150px] flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 xl:w-5 xl:h-5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar familia, código o tela..."
              className="pl-10 xl:pl-11 h-10 xl:h-11 bg-background text-xs xl:text-sm rounded-xl border-2 border-border/60 focus-visible:border-primary shadow-sm cursor-pointer w-full"
              value={search}
              onClick={() => setQwertyOpen(true)}
              readOnly
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          {permissions?.pos_open_caja && !isCajaOpen && (
            <button
              onClick={handleOpenCaja}
              className="px-3.5 h-10 xl:h-11 shrink-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer animate-pulse"
            >
              Aperturar Caja
            </button>
          )}
          {permissions?.pos_close_caja && isCajaOpen && (
            <button
              onClick={handleCloseCajaAttempt}
              className="px-3.5 h-10 xl:h-11 shrink-0 flex items-center justify-center bg-red-600/10 border border-red-500/30 text-red-600 hover:bg-red-600 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Cerrar Caja
            </button>
          )}
          <div className="h-10 xl:h-11 shrink-0 flex items-center">
            <AccountSwitcher />
          </div>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
            className="w-10 sm:w-11 h-10 sm:h-11 shrink-0 flex items-center justify-center rounded-xl bg-secondary hover:bg-muted transition-colors border border-border"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
          </button>
          <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 h-10 sm:h-11 shrink-0 flex items-center gap-2 rounded-xl">
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider whitespace-nowrap">Próximo #</span>
            <span className="text-base xl:text-lg font-black text-emerald-600 leading-none">{ticketNumber}</span>
          </div>
        </div>
      </div>

      {/* MÓVIL (< lg) */}
      <div className="flex lg:hidden flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-secondary/80 shrink-0" onClick={handleBackClick}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {activeStore && (
            <div className="flex flex-col text-left shrink-0">
              <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none">POS</span>
              <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded mt-0.5 uppercase leading-none truncate max-w-[100px]">
                {activeStore.name}
              </span>
            </div>
          )}
          <div className="relative flex-1 min-w-0 flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar familia..."
              className="pl-9 h-10 bg-background text-xs rounded-xl border-2 border-border/60 focus-visible:border-primary shadow-sm cursor-pointer w-full"
              value={search}
              onClick={() => setQwertyOpen(true)}
              readOnly
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            {permissions?.pos_open_caja && !isCajaOpen && (
              <button
                onClick={handleOpenCaja}
                className="px-3 h-10 bg-emerald-600 text-white font-bold text-[10px] uppercase rounded-xl shadow-sm animate-pulse flex items-center justify-center shrink-0"
              >
                Aperturar Caja
              </button>
            )}
            {permissions?.pos_close_caja && isCajaOpen && (
              <button
                onClick={handleCloseCajaAttempt}
                className="px-3 h-10 bg-red-600/10 border border-red-500/30 text-red-600 font-bold text-[10px] uppercase rounded-xl flex items-center justify-center shrink-0"
              >
                Cerrar Caja
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AccountSwitcher />
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary border border-border shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-2.5 h-10 rounded-xl flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] text-emerald-600 font-bold uppercase">#</span>
              <span className="text-base font-black text-emerald-600 leading-none">{ticketNumber}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
