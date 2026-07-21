import { useState, useMemo } from 'react';

type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

export function useTableSort<T>(items: T[], initialSortConfig: SortConfig<T> | null = null) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSortConfig);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === bValue) return 0;
        
        // Handle null/undefined (push to bottom)
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        // Numeric or alphanumeric sort
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          // If both strings are purely numerical (like "1.1", "1.01"), sort as floats
          if (/^\d+(\.\d+)?$/.test(aValue) && /^\d+(\.\d+)?$/.test(bValue)) {
            const numA = parseFloat(aValue);
            const numB = parseFloat(bValue);
            if (numA !== numB) {
              return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
            }
          }
          // Fallback to natural sort
          const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        }

        // Standard comparison for numbers or other types
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: keyof T) => {
    let direction: SortDirection = 'asc';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
}
