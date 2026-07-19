"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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
  isHydrated: boolean;
}

const RoleContext = createContext<RoleContextProps | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("ADMIN");
  const [username, setUsernameState] = useState<string>("Propietario");
  const [employeeId, setEmployeeIdState] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("goltex_role");
    if (stored) {
      setRoleState(stored);
      fetchPermissions(stored);
    } else {
      // Default fallback
      fetchPermissions("ADMIN");
    }
    const storedUsername = localStorage.getItem("goltex_username");
    if (storedUsername) {
      setUsernameState(storedUsername);
    }
    const storedEmpId = localStorage.getItem("goltex_employee_id");
    if (storedEmpId) {
      setEmployeeIdState(storedEmpId);
    }
    setIsHydrated(true);
  }, []);

  const fetchPermissions = async (roleName: string) => {
    try {
      const { data, error } = await supabase
        .from("roles")
        .select("permissions")
        .eq("name", roleName)
        .single();
      
      if (!error && data && data.permissions) {
        let finalPerms = data.permissions;
        if (roleName === 'ADMIN') {
          // El Admin siempre debe tener acceso a TODO, sin importar el JSONB
          finalPerms = new Proxy(finalPerms, {
            get(target, prop) {
              return true;
            }
          });
        }
        setPermissions(finalPerms);
        // Save normal object to local storage (Proxy gets stringified as empty if empty, so we just save a record of true)
        const storagePerms = roleName === 'ADMIN' 
          ? { access_pos: true, access_caja: true, access_contabilidad: true, access_clientes: true, access_proformas: true, access_inventory: true, access_personal: true, access_dashboard: true, access_settings: true }
          : finalPerms;
        localStorage.setItem("goltex_permissions", JSON.stringify(storagePerms));
      } else {
        // Fallback to local storage if offline
        const localPerms = localStorage.getItem("goltex_permissions");
        if (localPerms) {
          setPermissions(JSON.parse(localPerms));
        }
      }
    } catch (e) {
      const localPerms = localStorage.getItem("goltex_permissions");
      if (localPerms) {
        setPermissions(JSON.parse(localPerms));
      }
    }
  };

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
    setRoleState("ADMIN");
    setUsernameState("");
    setEmployeeIdState(null);
    setPermissions({});
    localStorage.removeItem("goltex_role");
    localStorage.removeItem("goltex_username");
    localStorage.removeItem("goltex_employee_id");
    localStorage.removeItem("goltex_permissions");
  };

  return (
    <RoleContext.Provider value={{ role, setRole, username, setUsername, employeeId, setEmployeeId, permissions, clearSession, isHydrated }}>
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

