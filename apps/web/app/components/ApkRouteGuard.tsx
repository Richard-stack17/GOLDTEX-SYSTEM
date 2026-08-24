"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";

export function ApkRouteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const isApkMode = process.env.NEXT_PUBLIC_APP_MODE === 'apk';
  const [mounted, setMounted] = useState(false);

  // Botón físico de retroceso de Android (no-op en web)
  useAndroidBackButton();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const savedUser = localStorage.getItem("goltex_username");
      const savedRole = localStorage.getItem("goltex_role");
      const currentPath = window.location.pathname;

      // Si el botón atrás de Android intenta llevar a /login teniendo sesión activa, volver a /hub
      if (currentPath.startsWith('/login') && savedUser && savedRole) {
        router.replace('/hub');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [router]);

  useEffect(() => {
    if (mounted && pathname) {
      const normalizedPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;

      // 1. Proteger /login si ya está autenticado
      if (normalizedPath.startsWith('/login')) {
        const savedUser = localStorage.getItem("goltex_username");
        const savedRole = localStorage.getItem("goltex_role");
        const isRevoked = typeof window !== 'undefined' && window.location.search.includes('revoked=true');
        const isInactive = typeof window !== 'undefined' && window.location.search.includes('inactive_store=true');
        const hasError = typeof window !== 'undefined' && window.location.search.includes('error=');
        if (savedUser && savedRole && !isRevoked && !isInactive && !hasError) {
          router.replace('/hub');
          return;
        }
      }

      // 2. Restringir rutas no móviles en modo APK
      if (isApkMode) {
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
    }
  }, [isApkMode, mounted, pathname, router]);

  return null;
}
