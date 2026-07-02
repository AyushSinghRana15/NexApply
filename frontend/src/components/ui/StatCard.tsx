import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tileVariants: Record<string, string> = {
  red: "bg-cube-red text-white",
  blue: "bg-cube-blue text-white",
  green: "bg-cube-green text-white",
  yellow: "bg-cube-yellow text-black",
  orange: "bg-cube-orange text-white",
  white: "bg-white text-black",
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
        "rubik-border rubik-shadow p-5 flex items-center gap-4 transition-all duration-200 hover:translate-x-0.5 hover:translate-y-0.5",
        tileVariants[variant] ?? tileVariants.white,
        className
      )}
    >
      <div className="p-3 bg-black/10 rubik-border-thin shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium opacity-80">{label}</p>
        <p className="text-2xl font-black mt-0.5">{value}</p>
      </div>
    </div>
  );
}
