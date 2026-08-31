import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isDesktopWeb, setIsDesktopWeb] = useState<boolean>(false);
  const timeoutRef = useRef<any>(null);
  const retryCount = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isModernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isDesktop = !isMobileUserAgent && !isModernIPad;
    setIsDesktopWeb(isDesktop);

    setIsOnline(navigator.onLine);

    const checkRealConnectivity = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      try {
        const { error } = await supabase.from('roles').select('id').limit(1);
        
        if (error && (error.message.includes('Failed to fetch') || error.message.includes('Network') || error.message.includes('fetch'))) {
          throw new Error('Network timeout');
        }
        
        setIsOnline(true);
        retryCount.current = 0;
      } catch (err) {
        if (retryCount.current < 2) {
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
      setIsOnline(true);
      checkRealConnectivity();
    };

    const handleOffline = () => {
      clearTimeout(timeoutRef.current);
      retryCount.current = 0;
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkRealConnectivity();

    const heartbeat = setInterval(() => {
      if (navigator.onLine) checkRealConnectivity();
    }, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timeoutRef.current);
      clearInterval(heartbeat);
    };
  }, []);

  return { isOnline, isDesktopWeb };
}
