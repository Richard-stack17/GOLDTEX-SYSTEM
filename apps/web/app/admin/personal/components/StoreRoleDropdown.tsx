'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Shield } from 'lucide-react';

interface RoleItem {
  id: string;
  name: string;
  store_id?: string | null;
  stores?: { name: string };
}

interface StoreRoleDropdownProps {
  roles: RoleItem[];
  selectedRoleId: string;
  onSelect: (role: { id: string; name: string }) => void;
  disabled?: boolean;
  getRoleBadgeStyle?: (name: string) => string;
}

export function StoreRoleDropdown({
  roles,
  selectedRoleId,
  onSelect,
  disabled = false,
  getRoleBadgeStyle
}: StoreRoleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 260 && rect.top > 200) {
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

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Botón Píldora de Selección */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 h-9 px-2.5 rounded-xl border transition-all cursor-pointer select-none font-bold text-xs shadow-2xs max-w-full ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-background'
            : selectedRole
            ? 'border-border bg-card hover:bg-secondary/60 text-foreground'
            : 'border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-muted-foreground'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {selectedRole ? (
            <>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-[11px] font-bold whitespace-nowrap truncate max-w-[200px] sm:max-w-[280px] ${badgeFn(selectedRole.name)}`}
                title={selectedRole.name}
              >
                {selectedRole.name}
              </span>
              {selectedRole.store_id ? (
                <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 rounded-md shrink-0 hidden sm:inline-flex items-center">
                  Sucursal
                </span>
              ) : (
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.5 rounded-md shrink-0 hidden sm:inline-flex items-center">
                  Global
                </span>
              )}
            </>
          ) : (
            <span className="text-amber-700 dark:text-amber-400 text-xs font-semibold px-1">
              Seleccionar rol...
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>

      {/* Menú Flotante Personalizado */}
      {isOpen && (
        <div className={`absolute right-0 z-50 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in-0 zoom-in-95 ${
          openUpwards
            ? 'bottom-full mb-1.5 origin-bottom-right'
            : 'top-full mt-1.5 origin-top-right'
        }`}>
          <div className="px-2.5 py-1.5 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Selecciona el rol para esta tienda
          </div>
          <div className="max-h-60 overflow-y-auto overflow-x-hidden space-y-1 py-0.5">
            {roles.map((r) => {
              const isSelected = r.id === selectedRoleId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onSelect({ id: r.id, name: r.name });
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-500/10 border border-indigo-500/30 text-foreground'
                      : 'hover:bg-secondary/70 border border-transparent text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold shrink-0 ${badgeFn(r.name)}`}>
                      {r.name}
                    </span>
                    {r.store_id ? (
                      <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 rounded-md shrink-0">
                        Sucursal
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.5 rounded-md shrink-0">
                        Global
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
