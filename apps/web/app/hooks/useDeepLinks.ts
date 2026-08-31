'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeAndroidApp } from '../lib/platform';

/**
 * Hook para escuchar aperturas de la APK vía Deep Links (Custom URL Scheme: com.goltex.pos://).
 * Permite que al completar la autenticación/vinculación de Google en el navegador externo,
 * Android redirija el flujo automáticamente de vuelta a la aplicación móvil.
 */
export function useDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeAndroidApp()) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    async function register() {
      try {
        const { App } = await import('@capacitor/app');

        let lastProcessedUrl = '';

        listenerHandle = await App.addListener('appUrlOpen', async (event) => {
          const rawUrl = event?.url || '';
          if (!rawUrl || rawUrl === lastProcessedUrl) return;
          lastProcessedUrl = rawUrl;

          try {
            // Cerrar la ventana del navegador externo
            try {
              const { Browser } = await import('@capacitor/browser');
              await Browser.close();
            } catch (_) {}

            // Ejemplo rawUrl: "com.goltex.pos://auth/callback?code=xxx"
            if (rawUrl.includes('auth/callback')) {
              const questionIdx = rawUrl.indexOf('?');
              const hashIdx = rawUrl.indexOf('#');
              let searchOrHash = '';
              if (questionIdx !== -1) {
                searchOrHash = rawUrl.substring(questionIdx);
              } else if (hashIdx !== -1) {
                searchOrHash = rawUrl.substring(hashIdx);
              }
              const targetRoute = `/auth/callback${searchOrHash}`;
              router.replace(targetRoute);
            } else {
              const urlObj = new URL(rawUrl.replace('com.goltex.pos://', 'https://localhost/'));
              const target = urlObj.pathname + urlObj.search + urlObj.hash;
              if (target && target !== '/') {
                router.replace(target);
              }
            }
          } catch (e) {
            console.error('Error parseando deep link:', e);
          }
        });
      } catch (err) {
        console.error('Error registrando listener de deep link:', err);
      }
    }

    register();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [router]);
}
