'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Profile, Role, Employee } from '../types';

interface FreeUserDropdownProps {
  profiles: Profile[];
  selectedUserId: string;
  onSelect: (userId: string) => void;
  roles: Role[];
  storeMap: Map<string, string>;
  getRoleBadgeStyle?: (name: string) => string;
  linkingEmployee: Employee | null;
  placeholder?: string;
  disabled?: boolean;
}

export function FreeUserDropdown({
  profiles,
  selectedUserId,
  onSelect,
  roles,
  storeMap,
  getRoleBadgeStyle,
  linkingEmployee,
  placeholder = '— Seleccionar Usuario Libre —',
  disabled = false,
}: FreeUserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProfile = profiles.find((p) => p.id === selectedUserId);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 280 && rect.top > 220) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const defaultBadgeStyle = (name: string) => {
    if (name === 'ADMIN') return 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400';
    if (name === 'CAJERA' || name === 'CAJERO') return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400';
    if (name === 'MOSTRADOR') return 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400';
    return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
  };

  const badgeFn = getRoleBadgeStyle || defaultBadgeStyle;

  const renderProfileContent = (profile: Profile) => {
    const isGlobal = profile.role === 'ADMIN' || roles.some((r: any) => (r.id === profile.role_id || r.name === profile.role) && (!r.store_id || r.is_system));
    let empStores = profile.employee_stores || [];
    if (empStores.length === 0 && profile.default_store_id) {
      empStores = [{ store_id: profile.default_store_id, role: profile.role }];
    }
    const pStores = empStores.map((es: any) => es.store_id).filter(Boolean);
    const pStoreIds = pStores;

    const empStoreIds = (linkingEmployee?.employee_stores || []).map((es: any) => es.store_id).filter(Boolean);
    const empStoresSorted = [...empStoreIds].sort().join(',');
    const pStoresSorted = [...pStoreIds].sort().join(',');
    const hasConflict = empStoreIds.length > 0 && pStoreIds.length > 0 && empStoresSorted !== pStoresSorted;
    const isMismatch = !isGlobal && hasConflict;

    return (
      <div className="flex flex-col gap-2 w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-bold text-xs text-foreground">
            @{profile.username}
          </span>
          {isMismatch && (
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
              Tiendas distintas
            </span>
          )}
        </div>

        {/* Desglose por tienda y rol en filas independientes */}
        <div className="space-y-1.5 pl-1 border-l-2 border-border/50">
          {isGlobal ? (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${badgeFn(profile.role || 'ADMIN')}`}>
                {profile.role || 'ADMIN'}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Acceso Global (Todas las tiendas)
              </span>
            </div>
          ) : empStores.length > 0 ? (
            empStores.map((es: any, idx: number) => {
              const storeName = storeMap.get(es.store_id) || 'Tienda';
              const roleName = es.role || profile.role || 'Sin rol';
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${badgeFn(roleName)}`}>
                    {roleName}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {storeName}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${badgeFn(profile.role || 'Sin rol')}`}>
                {profile.role || 'Sin rol'}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {profile.default_store_id ? (storeMap.get(profile.default_store_id) || 'Tienda') : 'Sin tienda'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Botón Píldora Desplegable con altura dinámica */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none text-sm font-semibold shadow-2xs ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-background text-foreground'
            : 'border-border bg-card hover:bg-secondary/60 text-foreground'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex-1 min-w-0">
          {selectedProfile ? (
            renderProfileContent(selectedProfile)
          ) : (
            <span className="text-muted-foreground text-xs font-semibold">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-500' : ''
          }`}
        />
      </button>

      {/* Menú Desplegable con lista de opciones completas */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-50 min-w-[280px] bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in-0 zoom-in-95 ${
            openUpwards
              ? 'bottom-full mb-1.5 origin-bottom'
              : 'top-full mt-1.5 origin-top'
          }`}
        >
          <div className="max-h-64 overflow-y-auto space-y-1.5 p-1">
            {profiles.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center font-medium">
                No hay usuarios libres disponibles para tu sucursal
              </div>
            ) : (
              profiles.map((p) => {
                const isSelected = p.id === selectedUserId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-start justify-between p-3 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-500/10 border border-indigo-500/30'
                        : 'hover:bg-secondary/70 border border-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      {renderProfileContent(p)}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
