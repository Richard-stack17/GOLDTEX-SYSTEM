import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Retorna true únicamente cuando la app se ejecuta empaquetada de forma nativa en Android (Capacitor APK).
 * En la Web (Chrome en PC, Mac, o navegadores móviles) retorna false.
 */
export function isNativeAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Hook reactivo para verificar si se ejecuta en la APK de Android.
 */
export function useIsNativeAndroid(): boolean {
  const [isNative, setIsNative] = useState<boolean>(false);

  useEffect(() => {
    setIsNative(isNativeAndroidApp());
  }, []);

  return isNative;
}
