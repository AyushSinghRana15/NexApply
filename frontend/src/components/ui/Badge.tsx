import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "pending";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-lg",
        variant === "default" && "bg-gray-100 text-text-secondary",
        variant === "success" && "bg-green-50 text-green-600",
        variant === "warning" && "bg-amber-50 text-amber-600",
        variant === "danger" && "bg-red-50 text-red-600",
        variant === "pending" && "bg-yellow-50 text-yellow-600",
        className
      )}
    >
      {children}
    </span>
  );
}
