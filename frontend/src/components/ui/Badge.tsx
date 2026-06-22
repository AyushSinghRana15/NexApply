import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variant === "default" && "bg-dark-700 text-dark-300",
        variant === "success" && "bg-green-500/10 text-green-400",
        variant === "warning" && "bg-yellow-500/10 text-yellow-400",
        variant === "danger" && "bg-red-500/10 text-red-400",
        className
      )}
    >
      {children}
    </span>
  );
}
