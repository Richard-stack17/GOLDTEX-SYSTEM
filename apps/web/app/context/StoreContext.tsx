"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRole } from "./RoleContext";
import { syncCatalog, db } from "../lib/localDb";

export interface Store {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  role?: string;
}

interface StoreContextProps {
  activeStore: Store | null;
  activeStoreId: string | null;
  availableStores: Store[];
  availableStoreIds: string[];
  isAllStoresMode: boolean;
  setActiveStore: (store: Store) => Promise<void>;
  setAllStoresMode: () => Promise<void>;
  isLoadingStores: boolean;
  reloadStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextProps | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { employeeId, isHydrated, setRole, role } = useRole();
  const [activeStore, setActiveStoreState] = useState<Store | null>(null);
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [isAllStoresMode, setIsAllStoresModeState] = useState(false);

  // IDs derivados para queries .in()
  const availableStoreIds = availableStores.map(s => s.id);

  // Cargar tiendas al hidratar la sesión
  useEffect(() => {
    // Evitar race condition: esperar a que el rol esté cargado
    if (!isHydrated || !role) return;
    loadUserStores();
  }, [isHydrated, employeeId, role]);

  const loadUserStores = async () => {
    setIsLoadingStores(true);
    try {
      // 1. Cargar todas las tiendas activas de la base de datos
      const { data: allStores, error: storesErr } = await supabase
        .from("stores")
        .select("*")
        .order("name", { ascending: true });

      if (storesErr || !allStores) {
        console.error("Error al cargar tiendas (¿Problema de RLS?):", storesErr);
        setIsLoadingStores(false);
        return;
      }

      let storesForUser: Store[] = [];

      // Si es ADMIN, tiene acceso a TODAS las tiendas
      if (role === 'ADMIN') {
        storesForUser = allStores.map(s => ({ ...s, role: 'ADMIN' }));
      } else if (employeeId) {
        // Consultar employee_stores para ver a qué tiendas pertenece el empleado
        const { data: empStores, error: empError } = await supabase
          .from("employee_stores")
          .select("store_id, role, stores (*)")
          .eq("employee_id", employeeId);
          
        if (empError) {
           console.error("Error al consultar employee_stores:", empError);
        }

        if (empStores && empStores.length > 0) {
          storesForUser = empStores.map((es: any) => ({
            id: es.stores.id,
            name: es.stores.name,
            address: es.stores.address,
            phone: es.stores.phone,
            role: es.role || role
          }));
        } else {
          // Fallback: si no tiene asignación explícita, ve todas
          storesForUser = allStores.map(s => ({ ...s, role }));
        }
      } else {
        storesForUser = allStores.map(s => ({ ...s, role }));
      }

      setAvailableStores(storesForUser);

      // 2. Determinar la tienda activa guardada en localStorage o por defecto
      let savedMode = localStorage.getItem("goltex_store_mode");
      let savedStoreId = localStorage.getItem("goltex_active_store_id");
      
      // Limpiar basura del localStorage ("null" literal o "undefined")
      if (savedMode === "null" || savedMode === "undefined") savedMode = null;
      if (savedStoreId === "null" || savedStoreId === "undefined") savedStoreId = null;

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

      console.log("🏪 StoreContext Debug:", { 
        roleContextual: role, 
        storesEnBaseDeDatos: allStores.length,
        availableStores: storesForUser, 
        isAllStoresMode: savedMode === "ALL" || storesForUser.length > 1 && !savedMode,
        resultadoModo: debugMode,
        rawLocalStorage: { mode: localStorage.getItem("goltex_store_mode"), id: localStorage.getItem("goltex_active_store_id") }
      });

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
    // 1. Limpiar caché Dexie (no queremos datos de una tienda sola en offline)
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
      console.log("🧹 Caché Dexie limpiado por cambio de tienda.");
    } catch (err) {
      console.error("Error limpiando caché Dexie:", err);
    }
  };

  const reloadStores = async () => {
    await loadUserStores();
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
        reloadStores
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
