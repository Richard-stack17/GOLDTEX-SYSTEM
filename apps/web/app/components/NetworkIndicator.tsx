import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function NetworkIndicator() {
  const { isOnline, isDesktopWeb } = useNetworkStatus();

  // Ocultar por completo si es la versión web de escritorio
  if (isDesktopWeb) {
    return null;
  }

  if (isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-500 transition-colors">
        <Wifi className="w-4 h-4" />
        <span className="text-xs font-bold tracking-wide">ONLINE</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-500 animate-pulse transition-colors">
      <WifiOff className="w-4 h-4" />
      <span className="text-xs font-bold tracking-wide">OFFLINE</span>
    </div>
  );
}
