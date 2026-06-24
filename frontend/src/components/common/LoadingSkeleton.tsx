import { cn } from "@/lib/utils";

export function LoadingSkeleton({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn("h-4 bg-dark-700 rounded", className ?? "w-full")}
          style={{ width: lines > 1 ? `${70 + Math.random() * 30}%` : "100%" }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-dark-700" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-dark-700 rounded w-1/3" />
          <div className="h-3 bg-dark-700 rounded w-1/4" />
        </div>
      </div>
      <div className="h-8 bg-dark-700 rounded" />
      <div className="h-3 bg-dark-700 rounded w-2/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <div className="h-4 bg-dark-700 rounded w-1/4" />
          <div className="h-4 bg-dark-700 rounded w-1/5" />
          <div className="h-4 bg-dark-700 rounded w-1/6" />
          <div className="h-4 bg-dark-700 rounded w-16" />
          <div className="h-4 bg-dark-700 rounded w-20" />
        </div>
      ))}
    </div>
  );
}
