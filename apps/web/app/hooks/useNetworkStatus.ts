import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isDesktopWeb, setIsDesktopWeb] = useState<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const retryCount = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detección de entorno: ¿Es escritorio o móvil/tablet/APK?
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isModernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isDesktop = !isMobileUserAgent && !isModernIPad;
    setIsDesktopWeb(isDesktop);

    // En la web de escritorio, siempre online. Si la página cargó, hay internet.
    // La lógica offline-first solo aplica en la tablet/APK.
    if (isDesktop) {
      setIsOnline(true);
      return; // No necesitamos pings ni heartbeats en escritorio
    }

    // ── Lógica Offline-First (solo para APK/Tablet) ──
    setIsOnline(navigator.onLine);

    const checkRealConnectivity = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      try {
        const { error } = await supabase.from('roles').select('id').limit(1);
        
        if (error && (error.message.includes('Failed to fetch') || error.message.includes('Network'))) {
          throw new Error('Network timeout');
        }
        
        setIsOnline(true);
        retryCount.current = 0;
      } catch (err) {
        if (retryCount.current < 3) {
          const delay = Math.pow(2, retryCount.current) * 1000;
          retryCount.current += 1;
          timeoutRef.current = setTimeout(checkRealConnectivity, delay);
        } else {
          setIsOnline(false);
        }
      }
    };

    const handleOnline = () => {
      clearTimeout(timeoutRef.current);
      retryCount.current = 0;
      checkRealConnectivity();
    };

    const handleOffline = () => {
      clearTimeout(timeoutRef.current);
      retryCount.current = 0;
      checkRealConnectivity();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkRealConnectivity();

    const heartbeat = setInterval(() => {
       if (navigator.onLine) checkRealConnectivity();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timeoutRef.current);
      clearInterval(heartbeat);
    };
  }, []);

  return { isOnline, isDesktopWeb };
}
