"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Role = "ADMIN" | "CAJERA" | "VENDEDOR";

interface RoleContextProps {
  role: Role;
  setRole: (role: Role) => void;
  username: string;
  setUsername: (username: string) => void;
  isHydrated: boolean;
}

const RoleContext = createContext<RoleContextProps | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("ADMIN");
  const [username, setUsernameState] = useState<string>("Propietario");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("goltex_role");
    if (stored === "ADMIN" || stored === "CAJERA" || stored === "VENDEDOR") {
      setRoleState(stored as Role);
    }
    const storedUsername = localStorage.getItem("goltex_username");
    if (storedUsername) {
      setUsernameState(storedUsername);
    }
    setIsHydrated(true);
  }, []);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem("goltex_role", newRole);
  };

  const setUsername = (newUsername: string) => {
    setUsernameState(newUsername);
    localStorage.setItem("goltex_username", newUsername);
  };

  return (
    <RoleContext.Provider value={{ role, setRole, username, setUsername, isHydrated }}>
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
