import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
}

export function Table<T extends { id: number | string }>({ columns, data, onRowClick }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ink-800 border-b border-border">
            {columns.map((col) => (
              <th key={col.key} className={cn("text-left px-4 py-3 font-medium text-ink-400", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={cn(
                "border-b border-border last:border-0 transition-colors",
                onRowClick && "cursor-pointer hover:bg-surface-hover"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3", col.className)}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-ink-500">
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
