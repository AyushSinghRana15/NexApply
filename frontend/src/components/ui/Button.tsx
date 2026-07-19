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
        "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-smooth disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-2.5 text-base",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover shadow-sm hover:shadow-md",
        variant === "secondary" && "bg-white text-text-primary border border-border hover:bg-surface-hover hover:border-gray-300",
        variant === "ghost" && "bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary",
        variant === "danger" && "bg-danger text-white hover:bg-red-600 shadow-sm hover:shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
