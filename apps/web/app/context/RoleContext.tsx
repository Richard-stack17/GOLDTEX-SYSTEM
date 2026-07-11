"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Role = "ADMIN" | "CAJERA" | "VENDEDOR" | "MOSTRADOR";

interface RoleContextProps {
  role: Role;
  setRole: (role: Role) => void;
  username: string;
  setUsername: (username: string) => void;
  employeeId: string | null;
  setEmployeeId: (id: string | null) => void;
  clearSession: () => void;
  isHydrated: boolean;
}

const RoleContext = createContext<RoleContextProps | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("ADMIN");
  const [username, setUsernameState] = useState<string>("Propietario");
  const [employeeId, setEmployeeIdState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("goltex_role");
    if (stored === "ADMIN" || stored === "CAJERA" || stored === "VENDEDOR" || stored === "MOSTRADOR") {
      setRoleState(stored as Role);
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

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem("goltex_role", newRole);
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
    localStorage.removeItem("goltex_role");
    localStorage.removeItem("goltex_username");
    localStorage.removeItem("goltex_employee_id");
  };

  return (
    <RoleContext.Provider value={{ role, setRole, username, setUsername, employeeId, setEmployeeId, clearSession, isHydrated }}>
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
