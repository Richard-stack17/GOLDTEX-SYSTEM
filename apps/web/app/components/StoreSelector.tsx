'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface StoreSelectorProps {
  value: string;
  onChange: (storeId: string) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Dropdown para seleccionar a qué tienda se asigna un registro (producto, familia, servicio, etc).
 * Usado dentro de formularios/modales de creación y edición.
 */
export default function StoreSelector({
  value,
  onChange,
  label = "Asignar a Tienda",
  disabled = false,
  required = true,
  className = "",
}: StoreSelectorProps) {
  const { availableStores } = useStore();

  // Si solo tiene 1 tienda, mostrar como texto fijo (no hay opción)
  if (availableStores.length <= 1) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {Boolean(label) && (
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {label}
          </label>
        )}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm font-medium text-foreground">
          <Building2 className="w-4 h-4 text-indigo-500" />
          {availableStores[0]?.name || "Sin tienda"}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {Boolean(label) && (
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="" disabled>
          Selecciona una tienda...
        </option>
        {availableStores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </div>
  );
}
