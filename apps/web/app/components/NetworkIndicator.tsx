import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface NetworkIndicatorProps {
  showAlways?: boolean;
}

export default function NetworkIndicator({ showAlways = false }: NetworkIndicatorProps) {
  const { isOnline } = useNetworkStatus();

  if (isOnline && !showAlways) {
    return null;
  }

  if (isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 h-10 xl:h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 select-none shrink-0" title="Conexión en línea con la nube activa">
        <Wifi className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">En Línea</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 h-10 xl:h-11 rounded-xl bg-red-500/15 border-2 border-red-500 text-red-600 dark:text-red-400 animate-pulse select-none shrink-0 shadow-xs" title="Atención: Sin conexión a internet. No se pueden emitir proformas.">
      <WifiOff className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
      <span className="text-[10px] font-black uppercase tracking-wider">Sin Red</span>
    </div>
  );
}

export function NetworkBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="bg-red-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 shadow-sm animate-pulse shrink-0">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Sin conexión a internet — No se pueden emitir proformas</span>
    </div>
  );
}
