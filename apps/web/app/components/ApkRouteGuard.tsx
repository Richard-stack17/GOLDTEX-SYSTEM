"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function ApkRouteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const isApkMode = process.env.NEXT_PUBLIC_APP_MODE === 'apk';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isApkMode && mounted && pathname) {
      // Normalizar ruta quitando barras finales adicionales para comparación
      const normalizedPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;

      const isAllowed = 
        normalizedPath === '/' ||
        normalizedPath.startsWith('/login') ||
        normalizedPath.startsWith('/hub') ||
        normalizedPath.startsWith('/pos') ||
        normalizedPath.startsWith('/configuracion');

      if (!isAllowed) {
        router.replace('/hub');
      }
    }
  }, [isApkMode, mounted, pathname, router]);

  return null;
}
