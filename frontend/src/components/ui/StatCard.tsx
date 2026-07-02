import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  className?: string;
}

export function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <div className={cn("bg-surface rounded-xl border border-border p-5 flex items-center gap-4 transition-all duration-300 hover:border-ink-600 hover:bg-surface-hover", className)}>
      <div className="p-3 rounded-lg bg-ink-700 text-accent">{icon}</div>
      <div>
        <p className="text-sm text-ink-400">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
      </div>
    </div>
  );
}
