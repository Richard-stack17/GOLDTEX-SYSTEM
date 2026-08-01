import * as React from "react";
import { cn } from "../../lib/utils";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "./button";
import { Select } from "./select";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
  className,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between px-2 gap-4 py-4", className)}>
      <div className="flex items-center gap-4 text-sm text-muted-foreground w-full sm:w-auto justify-center sm:justify-start">
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap">Filas por página</span>
            <div className="w-[70px]">
              <Select
                value={itemsPerPage.toString()}
                onChange={(e) => {
                  onItemsPerPageChange(Number(e.target.value));
                  onPageChange(1); // Reset to page 1 when changing items per page
                }}
                className="h-8 text-xs bg-card"
              >
                {itemsPerPageOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
        <div className="hidden sm:block">
          Mostrando <span className="font-medium text-foreground">{totalItems === 0 ? 0 : startItem}</span> - <span className="font-medium text-foreground">{endItem}</span> de <span className="font-medium text-foreground">{totalItems}</span> registros
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Anterior</span>
        </Button>
        
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, i) => (
            page === "..." ? (
              <div key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </div>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="icon"
                className={cn("h-8 w-8 text-xs font-semibold", currentPage === page ? "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent" : "")}
                onClick={() => onPageChange(page as number)}
              >
                {page}
              </Button>
            )
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Siguiente</span>
        </Button>
      </div>
      
      <div className="sm:hidden text-sm text-muted-foreground w-full text-center mt-2">
        Mostrando <span className="font-medium text-foreground">{totalItems === 0 ? 0 : startItem}</span> - <span className="font-medium text-foreground">{endItem}</span> de <span className="font-medium text-foreground">{totalItems}</span> registros
      </div>
    </div>
  );
}
