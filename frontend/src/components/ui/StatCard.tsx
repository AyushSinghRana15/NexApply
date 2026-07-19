import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tileVariants: Record<string, string> = {
  red: "bg-red-50 text-red-600 border-red-100",
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  green: "bg-green-50 text-green-600 border-green-100",
  yellow: "bg-amber-50 text-amber-600 border-amber-100",
  orange: "bg-orange-50 text-orange-600 border-orange-100",
  white: "bg-white text-text-primary border-border",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  variant?: keyof typeof tileVariants;
  className?: string;
}

export function StatCard({ label, value, icon, variant = "white", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 flex items-center gap-4 soft-shadow hover-lift transition-smooth",
        tileVariants[variant] ?? tileVariants.white,
        className
      )}
    >
      <div className="p-2.5 rounded-xl bg-black/5 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
      </div>
    </div>
  );
}
