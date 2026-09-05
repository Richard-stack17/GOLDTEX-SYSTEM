'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  sublabel?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  disabled = false,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={containerRef}>
      {/* Botón Píldora del Selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 h-10 px-3.5 rounded-xl border transition-all cursor-pointer select-none text-sm font-semibold shadow-2xs ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-background text-foreground'
            : 'border-border bg-card hover:bg-secondary/60 text-foreground'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {selectedOption ? (
            <>
              {selectedOption.badge && (
                <span
                  className={`px-2 py-0.5 rounded-lg border text-xs font-bold shrink-0 ${
                    selectedOption.badgeColor || 'bg-secondary text-foreground'
                  }`}
                >
                  {selectedOption.badge}
                </span>
              )}
              <span className="truncate font-semibold text-foreground text-sm">
                {selectedOption.label}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-500' : ''
          }`}
        />
      </button>

      {/* Menú Desplegable Flotante (Con apertura inteligente arriba/abajo) */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-50 min-w-[260px] bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in-0 zoom-in-95 ${
            openUpwards
              ? 'bottom-full mb-1.5 origin-bottom'
              : 'top-full mt-1.5 origin-top'
          } ${dropdownClassName}`}
        >
          <div className="max-h-80 overflow-y-auto space-y-1 py-0.5 divide-y divide-border/30">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    if (!opt.disabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-500/10 border border-indigo-500/30 text-foreground font-bold'
                      : 'hover:bg-secondary/70 border border-transparent text-foreground font-medium'
                  } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col items-start min-w-0 flex-1 pr-2 gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {opt.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-black tracking-wider uppercase shrink-0 ${
                            opt.badgeColor || 'bg-secondary text-foreground'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      <span className={`text-sm ${isSelected ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'font-semibold text-foreground'}`}>
                        {opt.label}
                      </span>
                    </div>
                    {opt.sublabel && (
                      <p className="text-xs text-muted-foreground font-normal leading-relaxed text-left">
                        {opt.sublabel}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />
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
