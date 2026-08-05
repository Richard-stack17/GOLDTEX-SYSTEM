"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useRole } from "./RoleContext";
import { syncCatalog, db } from "../lib/localDb";

export interface Store {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  role?: string;
  role_id?: string | null;
}

interface StoreContextProps {
  activeStore: Store | null;
  activeStoreId: string | null;
  availableStores: Store[];
  availableStoreIds: string[];
  isAllStoresMode: boolean;
  isGlobalUser: boolean;
  setActiveStore: (store: Store) => Promise<void>;
  setAllStoresMode: () => Promise<void>;
  isLoadingStores: boolean;
  reloadStores: () => Promise<void>;
  getStoreIdsWithPermission: (permissionKey: string) => string[];
}

const StoreContext = createContext<StoreContextProps | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { employeeId, isHydrated, setRole, role, defaultStoreId, profileId } = useRole();
  const [activeStore, setActiveStoreState] = useState<Store | null>(null);
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [isAllStoresMode, setIsAllStoresModeState] = useState(false);
  const [isGlobalUser, setIsGlobalUser] = useState(false);
  const [rolesMap, setRolesMap] = useState<Record<string, Record<string, boolean>>>({});

  // IDs derivados para queries .in() filtrados dinámicamente por permisos de la ruta actual
  const availableStoreIds = useMemo(() => {
    const rawIds = availableStores.map(s => s.id);
    if (role === 'ADMIN' || !pathname) return rawIds;

    // Detectar qué permiso principal rige la ruta actual
    let requiredPermission: string | null = null;
    if (pathname.startsWith("/inventario")) requiredPermission = "access_inventory";
    else if (pathname.startsWith("/dashboard")) requiredPermission = "access_dashboard";
    else if (pathname.startsWith("/admin/personal")) requiredPermission = "access_personal";
    else if (pathname.startsWith("/pos")) requiredPermission = "access_pos";
    else if (pathname.startsWith("/caja")) requiredPermission = "access_caja";
    else if (pathname.startsWith("/clientes")) requiredPermission = "access_clientes";
    else if (pathname.startsWith("/contabilidad")) requiredPermission = "access_contabilidad";
    else if (pathname.startsWith("/historial-proformas")) requiredPermission = "access_proformas";
    else if (pathname.startsWith("/configuracion")) requiredPermission = "access_settings";

    if (!requiredPermission) return rawIds;

    return availableStores
      .filter(s => {
        if (!s) return false;
        const storeRole = s.role || role;
        if (storeRole === 'ADMIN') return true;
        const perms = s.role_id ? (rolesMap?.[s.role_id]) : (rolesMap?.[`${s.id}_${storeRole}`] || rolesMap?.[`GLOBAL_${storeRole}`]);
        return perms ? Boolean(perms[requiredPermission!]) : false;
      })
      .map(s => s.id);
  }, [availableStores, pathname, role, rolesMap]);

  // Cargar tiendas al hidratar la sesión
  useEffect(() => {
    // Evitar race condition: esperar a que el rol esté cargado
    if (!isHydrated || !role) return;
    loadUserStores();
  }, [isHydrated, employeeId, role]);

  const applyProfileStore = async (targetStoreId: string | null) => {
    if (!targetStoreId) return;

    let targetStore = availableStores.find((store) => store.id === targetStoreId);

    if (!targetStore) {
      const { data: storeData } = await supabase
        .from("stores")
        .select("*")
        .eq("id", targetStoreId)
        .eq("is_active", true)
        .maybeSingle();

      if (storeData) {
        targetStore = { ...storeData, role: role || "USER" };
      }
    }

    if (!targetStore) return;

    // Si el usuario NO es ADMIN, solo agregamos la tienda si estamos seguros
    // de que fue autorizada. Pero loadUserStores ya es el único que debe setear
    // availableStores. Así que para no-admins, simplemente evitamos sobrescribir su lista 
    // con una tienda a la que no tengan acceso.
    if (role !== "ADMIN") {
      // No hacemos setAvailableStores. La lista de tiendas asignadas NO debe alterarse
      // si intentan cambiar a una tienda fantasma.
    } else {
      setAvailableStores((prev) => {
        if (prev.some((s) => s.id === targetStore!.id)) return prev;
        return [...prev, targetStore!];
      });
    }

    const currentStoreId = activeStore?.id || localStorage.getItem("goltex_active_store_id");
    if (currentStoreId === targetStoreId && activeStore?.id === targetStoreId && !isAllStoresMode) return;

    await clearDexieCache();
    setIsAllStoresModeState(false);
    setActiveStoreState(targetStore);
    localStorage.setItem("goltex_active_store_id", targetStore.id);
    localStorage.setItem("goltex_active_store_name", targetStore.name);
    localStorage.setItem("goltex_store_mode", "SINGLE");
    await syncCatalog(targetStore.id);
  };

  // ── Modificado: Eliminados useEffects que forzaban el regreso automático a defaultStoreId al cambiar de tienda ──

  const loadUserStores = async () => {
    setIsLoadingStores(true);
    try {
      // 1. Cargar todas las tiendas activas de la base de datos
      const { data: allStores, error: storesErr } = await supabase
        .from("stores")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (storesErr || !allStores) {
        console.error("Error al cargar tiendas (¿Problema de RLS?):", storesErr);
        setIsLoadingStores(false);
        return;
      }

      // Cargar mapa de roles y permisos
      const { data: rolesData } = await supabase.from("roles").select("id, name, permissions, store_id").eq("is_active", true);
      if (rolesData) {
        const map: Record<string, Record<string, boolean>> = {};
        rolesData.forEach((r: any) => {
          if (r.id && r.permissions) {
            map[r.id] = r.permissions;
            // Fallback key for backward compatibility or global roles
            const key = r.store_id ? `${r.store_id}_${r.name}` : `GLOBAL_${r.name}`;
            map[key] = r.permissions;
          }
        });
        setRolesMap(map);
      }

      let storesForUser: Store[] = [];

      // ── VERIFICACIÓN DE ACCESO GLOBAL VS ACCESO RESTRINGIDO POR TIENDA ──
      let empStores: any[] = [];
      if (profileId) {
        const { data: esData } = await supabase
          .from("employee_stores")
          .select("store_id, role, role_id, stores (*)")
          .eq("profile_id", profileId);
        if (esData) {
          empStores = esData.filter((es: any) => es.stores && es.stores.is_active === true);
        }
      }

      let isGlobalRoleTemplate = false;
      if (role && role !== 'ADMIN') {
        const { data: roleDefs } = await supabase
          .from("roles")
          .select("store_id, is_system")
          .eq("name", role)
          .eq("is_active", true);
        if (roleDefs && roleDefs.some((r: any) => r.store_id === null || r.is_system)) {
          isGlobalRoleTemplate = true;
        }
      }

      const hasSpecificStoreAssignments = empStores.length > 0 || Boolean(defaultStoreId);
      const isTrulyGlobalUser = role === 'ADMIN' || (isGlobalRoleTemplate && !hasSpecificStoreAssignments) || (!defaultStoreId && empStores.length === 0);
      
      setIsGlobalUser(isTrulyGlobalUser);

      if (isTrulyGlobalUser) {
        // ACCESO GLOBAL: Admin o Rol plantilla global SIN tiendas específicas asignadas
        storesForUser = allStores.map(s => ({ ...s, role: role || 'ADMIN' }));
      } else {
        // ACCESO RESTRINGIDO: Respeta estrictamente las tiendas asignadas
        if (empStores.length > 0) {
          storesForUser = empStores.map((es: any) => ({
            id: es.stores.id,
            name: es.stores.name,
            address: es.stores.address,
            phone: es.stores.phone,
            role: es.role || role,
            role_id: es.role_id || null
          }));
        } else if (defaultStoreId) {
          const matched = allStores.find(s => s.id === defaultStoreId);
          if (matched) {
            storesForUser = [{ ...matched, role: role }];
          }
        }
      }

      // BLOQUEO AUTOMÁTICO DE USUARIOS DE TIENDAS INACTIVAS O SIN TIENDAS
      if (storesForUser.length === 0) {
        console.error("🚫 [AUTH GUARD] Todas las tiendas del usuario están inactivas o no tiene tiendas asignadas.");
        
        // Clear session explicitly
        localStorage.removeItem("goltex_role");
        localStorage.removeItem("goltex_username");
        localStorage.removeItem("goltex_employee_id");
        localStorage.removeItem("goltex_profile_id");
        localStorage.removeItem("goltex_default_store_id");
        localStorage.removeItem("goltex_active_store_id");
        localStorage.removeItem("goltex_store_mode");
        localStorage.removeItem("goltex_permissions");
        
        if (typeof window !== "undefined") {
          window.location.href = "/login?inactive_store=true";
        }
        return;
      }

      setAvailableStores(storesForUser);

      // 2. Determinar la tienda activa guardada en localStorage o por defecto
      let savedMode = localStorage.getItem("goltex_store_mode");
      let savedStoreId = localStorage.getItem("goltex_active_store_id");
      
      // Limpiar basura del localStorage ("null" literal o "undefined")
      if (savedMode === "null" || savedMode === "undefined") savedMode = null;
      if (savedStoreId === "null" || savedStoreId === "undefined") savedStoreId = null;

      // REGLA ESTRICTA PARA NO-ADMINS en la inicialización:
      if (!isTrulyGlobalUser && storesForUser.length < 2) {
         // Los usuarios sin acceso global y con menos de 2 tiendas nunca deben estar en modo consolidado
         savedMode = "SINGLE";
         
         // Validar defaultStoreId
         const isDefaultValid = defaultStoreId && storesForUser.some(s => s.id === defaultStoreId);
         const preferredStartId = isDefaultValid ? defaultStoreId : (storesForUser.length > 0 ? storesForUser[0]?.id : null);
         
         // Si la tienda guardada no es válida para sus permisos, resetearla
         const isSavedValid = savedStoreId && storesForUser.some(s => s.id === savedStoreId);
         if (!isSavedValid && preferredStartId) {
            savedStoreId = preferredStartId;
         }
      }

      let debugMode = "NINGUNO";

      if (storesForUser.length > 1) {
        // Si tiene múltiples tiendas y tenía "Todas" guardado, o es la primera vez (no hay nada guardado)
        if (savedMode === "ALL" || (!savedMode && !savedStoreId)) {
          setIsAllStoresModeState(true);
          setActiveStoreState(null);
          localStorage.setItem("goltex_store_mode", "ALL");
          debugMode = "MODO CONSOLIDADO (Todas)";
        } else {
          // Buscar la tienda guardada o usar la primera como fallback
          let selected = storesForUser.find(s => s.id === savedStoreId);
          if (!selected) selected = storesForUser[0];

          setIsAllStoresModeState(false);
          setActiveStoreState(selected!);
          localStorage.setItem("goltex_active_store_id", selected!.id);
          localStorage.setItem("goltex_active_store_name", selected!.name);
          localStorage.setItem("goltex_store_mode", "SINGLE");

          if (selected!.role && selected!.role !== role && role !== 'ADMIN') {
            setRole(selected!.role);
          }
          debugMode = `MODO INDIVIDUAL: ${selected!.name}`;
          await syncCatalog(selected!.id);
        }
      } else if (storesForUser.length === 1) {
        // Fallback para 1 sola tienda
        const selected = storesForUser[0]!;
        setIsAllStoresModeState(false);
        setActiveStoreState(selected);
        localStorage.setItem("goltex_active_store_id", selected.id);
        localStorage.setItem("goltex_active_store_name", selected.name);
        localStorage.setItem("goltex_store_mode", "SINGLE");

        if (selected.role && selected.role !== role && role !== 'ADMIN') {
          setRole(selected.role);
        }
        debugMode = `MODO UNICO: ${selected.name}`;
        await syncCatalog(selected.id);
      } else {
        // storesForUser.length === 0
        setActiveStoreState(null);
        setIsAllStoresModeState(false);
        debugMode = "SIN TIENDAS ASIGNADAS (storesForUser vacío)";
      }

    } catch (e) {
      console.error("Excepción al cargar tiendas del usuario:", e);
    } finally {
      setIsLoadingStores(false);
    }
  };

  /**
   * Cambiar a una tienda específica.
   * Limpia el caché Dexie y re-sincroniza con la nueva tienda.
   */
  const setActiveStore = async (store: Store) => {
    // Validar si el store.id existe en las tiendas asignadas al usuario
    const isAllowed = availableStores.some(s => s.id === store.id) || role === 'ADMIN';
    if (!isAllowed) {
      console.warn("⚠️ [STORE CONTEXT] Intento de cambiar a una tienda no asignada:", store.id);
      return;
    }

    // 1. Limpiar caché Dexie antes de cambiar (regla de seguridad)
    await clearDexieCache();

    // 2. Actualizar estado
    setIsAllStoresModeState(false);
    setActiveStoreState(store);
    localStorage.setItem("goltex_active_store_id", store.id);
    localStorage.setItem("goltex_active_store_name", store.name);
    localStorage.setItem("goltex_store_mode", "SINGLE");

    // 3. Actualizar rol dinámico si corresponde
    if (store.role && store.role !== role && role !== 'ADMIN') {
      setRole(store.role);
    }

    // 4. Sincronizar Dexie con la nueva tienda
    await syncCatalog(store.id);
  };

  /**
   * Cambiar a modo "Todas las Tiendas" (consolidado).
   * Limpia el caché Dexie por seguridad.
   */
  const setAllStoresMode = async () => {
    // ── BLINDAJE CAPA 1: Solo usuarios globales o con 2+ tiendas ──
    const hasMultipleStores = availableStores.length >= 2;
    if (!isGlobalUser && !hasMultipleStores) {
      console.warn("⚠️ [STORE CONTEXT] setAllStoresMode bloqueado: el usuario no tiene acceso global ni múltiples tiendas.");
      return;
    }
    await clearDexieCache();

    // 2. Actualizar estado
    setIsAllStoresModeState(true);
    setActiveStoreState(null);
    localStorage.removeItem("goltex_active_store_id");
    localStorage.removeItem("goltex_active_store_name");
    localStorage.setItem("goltex_store_mode", "ALL");
  };

  /**
   * Limpieza total de tablas Dexie que dependen de tienda.
   * Se ejecuta SIEMPRE que se cambia de tienda o modo.
   */
  const clearDexieCache = async () => {
    try {
      await db.products.clear();
      await db.families.clear();
      await db.services.clear();
      await db.sales.clear();
      await db.transactions.clear();
    } catch (err) {
      console.error("Error limpiando caché Dexie:", err);
    }
  };

  const reloadStores = async () => {
    await loadUserStores();
  };

  const getStoreIdsWithPermission = (permissionKey: string): string[] => {
    if (role === 'ADMIN') {
      return availableStores.map(s => s.id);
    }
    return availableStores.filter(s => {
        const storeRole = s.role || role;
      if (storeRole === 'ADMIN') return true;
      const perms = s.role_id ? rolesMap[s.role_id] : (rolesMap[`${s.id}_${storeRole}`] || rolesMap[`GLOBAL_${storeRole}`]);
      return perms ? Boolean(perms[permissionKey]) : false;
      })
      .map(s => s.id);
  };

  return (
    <StoreContext.Provider
      value={{
        activeStore,
        activeStoreId: activeStore?.id || null,
        availableStores,
        availableStoreIds,
        isAllStoresMode,
        setActiveStore,
        setAllStoresMode,
        isLoadingStores,
        isGlobalUser,
        reloadStores,
        getStoreIdsWithPermission
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore debe ser usado dentro de un StoreProvider");
  }
  return context;
}
