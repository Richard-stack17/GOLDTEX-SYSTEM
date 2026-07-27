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
        let finalPerms = data.permissions;
        if (roleName === 'ADMIN') {
          // El Admin siempre debe tener acceso a TODO
          finalPerms = new Proxy(finalPerms, {
            get() {
              return true;
            }
          });
        }
        setPermissions(finalPerms);
        const storagePerms = roleName === 'ADMIN' 
          ? { access_pos: true, access_caja: true, access_contabilidad: true, access_clientes: true, access_proformas: true, access_inventory: true, access_personal: true, access_dashboard: true, access_settings: true }
          : finalPerms;
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
        .select("role, employee_id")
        .eq("username", currentUsername)
        .single();

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

      if (freshRole !== role) {
        setRoleState(freshRole);
        localStorage.setItem("goltex_role", freshRole);
      }
      if (freshEmpId !== employeeId) {
        setEmployeeIdState(freshEmpId);
        if (freshEmpId) localStorage.setItem("goltex_employee_id", freshEmpId);
        else localStorage.removeItem("goltex_employee_id");
      }

      await fetchPermissions(freshRole);
    } catch (e) {
      console.warn("Error al refrescar sesión:", e);
    }
  }, [username, role, employeeId, fetchPermissions]);

  useEffect(() => {
    const storedRole = localStorage.getItem("goltex_role");
    const storedUsername = localStorage.getItem("goltex_username");
    const storedEmpId = localStorage.getItem("goltex_employee_id");
    const localPerms = localStorage.getItem("goltex_permissions");

    if (storedRole) setRoleState(storedRole);
    if (storedUsername) setUsernameState(storedUsername);
    if (storedEmpId) setEmployeeIdState(storedEmpId);

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

  // Suscripción en tiempo real a cambios en perfiles y matriz de roles
  useEffect(() => {
    if (!username) return;

    const profileChannel = supabase
      .channel(`profile-${username}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `username=eq.${username}` },
        () => {
          refreshUserSession();
        }
      )
      .subscribe();

    const rolesChannel = supabase
      .channel("roles-permissions-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roles" },
        () => {
          refreshUserSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(rolesChannel);
    };
  }, [username, refreshUserSession]);

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

  const clearSession = () => {
    setRoleState("");
    setUsernameState("");
    setEmployeeIdState(null);
    setPermissions({});
    localStorage.removeItem("goltex_role");
    localStorage.removeItem("goltex_username");
    localStorage.removeItem("goltex_employee_id");
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
