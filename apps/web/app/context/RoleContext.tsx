"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type Role = string;

interface RoleContextProps {
  role: Role;
  setRole: (role: Role) => void;
  username: string;
  setUsername: (username: string) => void;
  employeeId: string | null;
  setEmployeeId: (id: string | null) => void;
  profileId: string | null;
  setProfileId: (id: string | null) => void;
  defaultStoreId: string | null;
  setDefaultStoreId: (id: string | null) => void;
  permissions: Record<string, boolean>;
  clearSession: () => void;
  refreshUserSession: () => Promise<void>;
  isHydrated: boolean;
}

const RoleContext = createContext<RoleContextProps | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("");
  const [username, setUsernameState] = useState<string>("");
  const [employeeId, setEmployeeIdState] = useState<string | null>(null);
  const [profileId, setProfileIdState] = useState<string | null>(null);
  const [defaultStoreId, setDefaultStoreIdState] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  const fetchPermissions = useCallback(async (roleName: string) => {
    if (!roleName) return;
    try {
      const { data, error } = await supabase
        .from("roles")
        .select("permissions")
        .eq("name", roleName)
        .single();

      if (!error && data && data.permissions) {
        let finalPerms = { ...data.permissions };
        if (roleName === 'ADMIN') {
          // El Admin siempre debe tener acceso a TODO
          const adminPerms = {
            access_pos: true,
            access_caja: true,
            access_contabilidad: true,
            access_clientes: true,
            access_proformas: true,
            access_inventory: true,
            access_personal: true,
            access_dashboard: true,
            access_settings: true
          };
          finalPerms = new Proxy(adminPerms, {
            get(target: any, prop: string) {
              return true;
            }
          }) as any;
        }

        console.log('⚡ [ROLE CONTEXT] Permisos actualizados en vivo para rol:', roleName, finalPerms);
        setPermissions(finalPerms);

        const storagePerms = roleName === 'ADMIN'
          ? { access_pos: true, access_caja: true, access_contabilidad: true, access_clientes: true, access_proformas: true, access_inventory: true, access_personal: true, access_dashboard: true, access_settings: true }
          : { ...data.permissions };

        localStorage.setItem("goltex_permissions", JSON.stringify(storagePerms));
      } else {
        const localPerms = localStorage.getItem("goltex_permissions");
        if (localPerms) {
          try {
            setPermissions(JSON.parse(localPerms));
          } catch (e) {}
        }
      }
    } catch (e) {
      const localPerms = localStorage.getItem("goltex_permissions");
      if (localPerms) {
        try {
          setPermissions(JSON.parse(localPerms));
        } catch (err) {}
      }
    }
  }, []);

  const refreshUserSession = useCallback(async () => {
    const currentUsername = localStorage.getItem("goltex_username") || username;
    if (!currentUsername) return;

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, role, employee_id, default_store_id")
        .eq("username", currentUsername)
        .single();

      console.log('🔄 [ROLE CONTEXT] Perfil recargado. Nuevo default_store_id:', profile?.default_store_id);

      if (error || !profile) {
        return;
      }

      if (profile.role === "DELETED") {
        clearSession();
        if (typeof window !== "undefined") {
          window.location.href = "/login?revoked=true";
        }
        return;
      }

      const freshRole = profile.role;
      const freshEmpId = profile.employee_id;
      const freshProfileId = profile.id;
      const freshDefaultStoreId = profile.default_store_id ?? null;

      if (freshRole !== role) {
        setRoleState(freshRole);
        localStorage.setItem("goltex_role", freshRole);
      }
      if (freshEmpId !== employeeId) {
        setEmployeeIdState(freshEmpId);
        if (freshEmpId) localStorage.setItem("goltex_employee_id", freshEmpId);
        else localStorage.removeItem("goltex_employee_id");
      }
      if (freshProfileId !== profileId) {
        setProfileIdState(freshProfileId);
        localStorage.setItem("goltex_profile_id", freshProfileId);
      }
      if (freshDefaultStoreId !== defaultStoreId) {
        setDefaultStoreIdState(freshDefaultStoreId);
        if (freshDefaultStoreId) localStorage.setItem("goltex_default_store_id", freshDefaultStoreId);
        else localStorage.removeItem("goltex_default_store_id");
      }

      await fetchPermissions(freshRole);
    } catch (e) {
      console.warn("Error al refrescar sesión:", e);
    }
  }, [username, role, employeeId, profileId, defaultStoreId, fetchPermissions]);

  useEffect(() => {
    const storedRole = localStorage.getItem("goltex_role");
    const storedUsername = localStorage.getItem("goltex_username");
    const storedEmpId = localStorage.getItem("goltex_employee_id");
    const storedProfileId = localStorage.getItem("goltex_profile_id");
    const storedDefaultStoreId = localStorage.getItem("goltex_default_store_id");
    const localPerms = localStorage.getItem("goltex_permissions");

    if (storedRole) setRoleState(storedRole);
    if (storedUsername) setUsernameState(storedUsername);
    if (storedEmpId) setEmployeeIdState(storedEmpId);
    if (storedProfileId) setProfileIdState(storedProfileId);
    if (storedDefaultStoreId) setDefaultStoreIdState(storedDefaultStoreId);

    if (localPerms) {
      try {
        const parsed = JSON.parse(localPerms);
        setPermissions(storedRole === 'ADMIN' ? new Proxy(parsed, { get: () => true }) : parsed);
      } catch (e) {}
    }

    setIsHydrated(true);

    if (storedUsername) {
      refreshUserSession();
    }
  }, []);

  // Asegurar que los permisos se recarguen automáticamente cada vez que cambia la cadena del rol
  useEffect(() => {
    if (role) {
      void fetchPermissions(role);
    }
  }, [role, fetchPermissions]);

  // Suscripción en tiempo real a cambios en el perfil actual, la tienda asignada y la matriz de roles
  useEffect(() => {
    if (!profileId) return;

    const profileChannel = supabase
      .channel(`user_profile_${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${profileId}` },
        (payload) => {
          console.log('⚡ [REALTIME - PROFILES] Evento recibido en BD:', payload);
          if (payload.new && (payload.new as any).role) {
            const newRole = (payload.new as any).role;
            console.log('⚡ [REALTIME - ROLE] Actualizando rol e impulsando permisos:', newRole);
            setRoleState(newRole);
            localStorage.setItem("goltex_role", newRole);
            void fetchPermissions(newRole);
          }
          refreshUserSession();
        }
      )
      .subscribe();

    const employeeStoreChannel = employeeId
      ? supabase
          .channel(`employee_store_${employeeId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "employee_stores", filter: `employee_id=eq.${employeeId}` },
            (payload) => {
              console.log('⚡ [REALTIME - ROLE] Recibido evento de cambio en BD:', payload);
              refreshUserSession();
            }
          )
          .subscribe()
      : null;

    const rolesChannel = supabase
      .channel("roles-permissions-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roles" },
        (payload) => {
          console.log('⚡ [REALTIME - ROLE] Recibido evento de cambio en BD:', payload);
          refreshUserSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      if (employeeStoreChannel) supabase.removeChannel(employeeStoreChannel);
      supabase.removeChannel(rolesChannel);
    };
  }, [profileId, employeeId, refreshUserSession]);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem("goltex_role", newRole);
    fetchPermissions(newRole);
  };

  const setUsername = (newUsername: string) => {
    setUsernameState(newUsername);
    localStorage.setItem("goltex_username", newUsername);
  };

  const setEmployeeId = (newId: string | null) => {
    setEmployeeIdState(newId);
    if (newId) {
      localStorage.setItem("goltex_employee_id", newId);
    } else {
      localStorage.removeItem("goltex_employee_id");
    }
  };

  const setProfileId = (newId: string | null) => {
    setProfileIdState(newId);
    if (newId) {
      localStorage.setItem("goltex_profile_id", newId);
    } else {
      localStorage.removeItem("goltex_profile_id");
    }
  };

  const setDefaultStoreId = (newId: string | null) => {
    setDefaultStoreIdState(newId);
    if (newId) {
      localStorage.setItem("goltex_default_store_id", newId);
    } else {
      localStorage.removeItem("goltex_default_store_id");
    }
  };

  const clearSession = () => {
    setRoleState("");
    setUsernameState("");
    setEmployeeIdState(null);
    setPermissions({});
    localStorage.removeItem("goltex_role");
    localStorage.removeItem("goltex_username");
    localStorage.removeItem("goltex_employee_id");
    localStorage.removeItem("goltex_profile_id");
    localStorage.removeItem("goltex_default_store_id");
    localStorage.removeItem("goltex_permissions");
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        username,
        setUsername,
        employeeId,
        setEmployeeId,
        profileId,
        setProfileId,
        defaultStoreId,
        setDefaultStoreId,
        permissions,
        clearSession,
        refreshUserSession,
        isHydrated
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
