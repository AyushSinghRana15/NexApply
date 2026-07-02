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
        "inline-flex items-center px-2.5 py-0.5 text-xs font-bold rubik-border-thin uppercase tracking-wider",
        variant === "default" && "bg-gray-100 text-black",
        variant === "success" && "bg-cube-green text-white",
        variant === "warning" && "bg-cube-orange text-white",
        variant === "danger" && "bg-cube-red text-white",
        variant === "pending" && "bg-cube-yellow text-black",
        className
      )}
    >
      {children}
    </span>
  );
}
