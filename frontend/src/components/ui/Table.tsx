import React from "react";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  header: string;
  width?: string;
  render?: (item: any) => React.ReactNode;
}

interface TableProps {
  columns: Column[];
  data: any[];
  onRowClick?: (item: any) => void;
  selectedId?: string;
  emptyMessage?: string;
}

export function Table({
  columns,
  data,
  onRowClick,
  selectedId,
  emptyMessage = "No data",
}: TableProps) {
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
          {data.map((item: any) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={cn(
                "border-b border-border-light last:border-0 transition-colors",
                onRowClick && "cursor-pointer",
                selectedId === item.id ? "bg-accent/5" : "hover:bg-surface-hover"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render ? col.render(item) : item[col.key]}
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
