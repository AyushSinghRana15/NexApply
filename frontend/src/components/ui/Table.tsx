import React from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  selectedId?: string;
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  data,
  onRowClick,
  selectedId,
  emptyMessage = "No data",
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-light bg-surface">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={(item as Record<string, string>).id}
              onClick={() => onRowClick?.(item)}
              className={cn(
                "border-b border-border-light last:border-0 transition-colors",
                onRowClick && "cursor-pointer",
                selectedId === (item as Record<string, string>).id ? "bg-accent/5" : "hover:bg-surface-hover"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render ? col.render(item) : (item as Record<string, React.ReactNode>)[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-12 text-sm text-text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
