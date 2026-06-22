import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        variant === "primary" && "bg-accent hover:bg-accent-hover text-white",
        variant === "secondary" && "bg-surface hover:bg-surface-hover text-text-primary border border-border",
        variant === "ghost" && "hover:bg-surface-hover text-dark-400",
        variant === "danger" && "bg-red-500/10 hover:bg-red-500/20 text-red-400",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
