'use client';

import React from 'react';
import { PersonalProvider, usePersonal } from './PersonalContext';
import StoreSwitcher from '../../components/StoreSwitcher';
import { AccessDeniedView } from '../../components/AccessDeniedView';
import { PersonalModals } from './components/PersonalModals';
import { PersonalEmployeesTab } from './components/PersonalEmployeesTab';
import { PersonalUsersTab } from './components/PersonalUsersTab';
import { PersonalRolesTab } from './components/PersonalRolesTab';
import { ArrowLeft, Users, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useIsNativeAndroid } from '../../lib/platform';

function PersonalView() {
  const {
    activeStoreId, activeTab, setActiveTab, hasUnsavedRoleChanges,
    setShowRoleExitConfirm, setPendingTab, isUserGlobalAdmin, isHydrated, permissions
  } = usePersonal();

  const isNativeAndroid = useIsNativeAndroid();

  if (!isHydrated) return null;
  if (isNativeAndroid) {
    return (
      <AccessDeniedView
        moduleName="Gestión de Personal"
        customReason="El módulo de Gestión de Personal está disponible exclusivamente desde la versión Web."
      />
    );
  }
  if (!permissions?.access_personal) {
    return <AccessDeniedView moduleName="Módulo de Personal" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-card border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-6 shadow-sm shrink-0">
        <div className="flex items-center gap-4 pt-2 sm:pt-0 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-foreground flex items-center gap-2 truncate">
                Gestión de Personal
                <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-indigo-500 hidden sm:block shrink-0" />
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Control de accesos y permisos</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <StoreSwitcher />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          <div className="flex bg-muted p-1 rounded-xl shrink-0">
            {[
              { id: "empleados", label: "Empleados" },
              { id: "usuarios", label: "Usuarios" },
              ...(Boolean(permissions?.personal_manage_roles || isUserGlobalAdmin) ? [{ id: "roles", label: "Roles" }] : []),
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => {
                  if (activeTab === 'roles' && hasUnsavedRoleChanges) {
                    setPendingTab(id);
                    setShowRoleExitConfirm(true);
                  } else {
                    setActiveTab(id);
                  }
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === id
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-screen-xl w-full mx-auto">
        {activeTab === 'empleados' && <PersonalEmployeesTab />}
        {activeTab === 'usuarios' && <PersonalUsersTab />}
        {activeTab === 'roles' && Boolean(permissions?.personal_manage_roles || isUserGlobalAdmin) && <PersonalRolesTab />}
      </main>

      <PersonalModals />
    </div>
  );
}

export default function PersonalPage() {
  return (
    <PersonalProvider>
      <PersonalView />
    </PersonalProvider>
  );
}
