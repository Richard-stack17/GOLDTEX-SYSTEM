"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Role = "ADMIN" | "CAJERA" | "VENDEDOR";

interface RoleContextProps {
  role: Role;
  setRole: (role: Role) => void;
  isHydrated: boolean;
}

const RoleContext = createContext<RoleContextProps | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("ADMIN");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("goltex_role");
    if (stored === "ADMIN" || stored === "CAJERA" || stored === "VENDEDOR") {
      setRoleState(stored as Role);
    }
    setIsHydrated(true);
  }, []);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem("goltex_role", newRole);
  };

  return (
    <RoleContext.Provider value={{ role, setRole, isHydrated }}>
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
