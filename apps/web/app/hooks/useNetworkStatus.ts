import { useState, useEffect, useRef } from 'react';
import { Network } from '@capacitor/network';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isDesktopWeb, setIsDesktopWeb] = useState<boolean>(false);
  const isChecking = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isModernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isDesktop = !isMobileUserAgent && !isModernIPad;
    setIsDesktopWeb(isDesktop);

    let isMounted = true;

    const checkRealConnectivity = async () => {
      if (isChecking.current) return;
      isChecking.current = true;

      try {
        if (!navigator.onLine) {
          if (isMounted) setIsOnline(false);
          return;
        }

        // Fast active ping with 2.5s AbortController timeout to Supabase REST
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        try {
          const res = await fetch("https://tfonrkwnnfdpyurccvzl.supabase.co/rest/v1/", {
            method: 'HEAD',
            headers: { 'apikey': 'sb_publishable_Q0fIbnnePd-ZXZY4ECXpAw_UybzSWki' },
            signal: controller.signal,
            cache: 'no-store'
          });
          clearTimeout(timeoutId);
          if (isMounted) setIsOnline(res.status < 500);
        } catch (_) {
          clearTimeout(timeoutId);
          if (isMounted) setIsOnline(false);
        }
      } finally {
        isChecking.current = false;
      }
    };

    // 1. Initial check & Native Capacitor Network listener
    let networkListener: any = null;
    try {
      Network.getStatus().then(status => {
        if (isMounted) {
          if (!status.connected) {
            setIsOnline(false);
          } else {
            checkRealConnectivity();
          }
        }
      }).catch(() => {
        checkRealConnectivity();
      });

      Network.addListener('networkStatusChange', status => {
        if (isMounted) {
          if (!status.connected) {
            setIsOnline(false);
          } else {
            checkRealConnectivity();
          }
        }
      }).then(l => {
        networkListener = l;
      }).catch(() => {});
    } catch (_) {
      checkRealConnectivity();
    }

    // 2. Window online / offline / focus / visibilitychange listeners
    const handleOnline = () => {
      checkRealConnectivity();
    };

    const handleOffline = () => {
      if (isMounted) setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleOnline);
    document.addEventListener('visibilitychange', handleOnline);

    // 3. Periodic fast heartbeat every 5s
    const heartbeat = setInterval(() => {
      checkRealConnectivity();
    }, 5000);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleOnline);
      document.removeEventListener('visibilitychange', handleOnline);
      clearInterval(heartbeat);
      if (networkListener && typeof networkListener.remove === 'function') {
        networkListener.remove();
      }
    };
  }, []);

  return { isOnline, isDesktopWeb };
}
