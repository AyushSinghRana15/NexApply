import { cn } from "@/lib/utils";

const LINE_WIDTHS = [70, 85, 80, 90, 75];

export function LoadingSkeleton({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn("h-4 rounded-xl animate-shimmer", className ?? "w-full")}
          style={{ width: lines > 1 ? `${LINE_WIDTHS[i % LINE_WIDTHS.length]}%` : "100%" }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-border p-5 soft-shadow space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl animate-shimmer" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-gray-100 rounded-lg w-1/3 animate-shimmer" />
          <div className="h-3 bg-gray-100 rounded-lg w-1/4 animate-shimmer" />
        </div>
      </div>
      <div className="h-8 bg-gray-100 rounded-xl animate-shimmer" />
      <div className="h-3 bg-gray-100 rounded-lg w-2/3 animate-shimmer" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-border">
          <div className="h-4 bg-gray-100 rounded-lg w-1/4 animate-shimmer" />
          <div className="h-4 bg-gray-100 rounded-lg w-1/5 animate-shimmer" />
          <div className="h-4 bg-gray-100 rounded-lg w-1/6 animate-shimmer" />
          <div className="h-4 bg-gray-100 rounded-lg w-16 animate-shimmer" />
          <div className="h-4 bg-gray-100 rounded-lg w-20 animate-shimmer" />
        </div>
      ))}
    </div>
  );
}
