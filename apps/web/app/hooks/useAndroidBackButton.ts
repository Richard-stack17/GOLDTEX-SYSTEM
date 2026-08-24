'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isNativeAndroidApp } from '../lib/platform';

/**
 * Rutas raíz donde presionar "Atrás" no tiene a dónde ir.
 * En estas rutas el botón no hace nada (evita cerrar la app accidentalmente).
 */
const ROOT_PATHS = ['/hub', '/pos', '/login', '/'];

/**
 * Registra el manejador del botón físico de retroceso de Android.
 * Solo activo en la APK Capacitor (isNativeAndroidApp() === true).
 * No se registra ni interfiere cuando se usa en la versión web (PC / navegador).
 */
export function useAndroidBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Salir inmediatamente si no es la APK nativa de Android
    if (!isNativeAndroidApp()) return;

    let App: typeof import('@capacitor/app').App | null = null;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    async function register() {
      try {
        const mod = await import('@capacitor/app');
        App = mod.App;

        listenerHandle = await App.addListener('backButton', ({ canGoBack }) => {
          const isRoot = ROOT_PATHS.some(
            (p) => pathname === p || pathname?.startsWith(p + '/')
          );

          if (isRoot) {
            // En rutas raíz no retroceder: no hace nada (evita cerrar la app)
            return;
          }

          if (canGoBack) {
            // Si el historial del WebView tiene entradas, navega hacia atrás
            router.back();
          } else {
            // Fallback: ir al hub
            router.replace('/hub');
          }
        });
      } catch {
        // En entornos web el import puede fallar silenciosamente
      }
    }

    register();

    return () => {
      listenerHandle?.remove().catch(() => { });
    };
    // pathname cambia en cada navegación: re-registramos para capturar el path actual
  }, [pathname, router]);
}
