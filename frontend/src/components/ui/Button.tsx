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
        "inline-flex items-center justify-center gap-2 font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none rubik-border-thin",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        variant === "primary" && "bg-cube-blue text-white hover:bg-blue-800",
        variant === "secondary" && "bg-white text-black hover:bg-gray-100",
        variant === "ghost" && "bg-transparent text-gray-500 hover:bg-gray-100 border-0",
        variant === "danger" && "bg-cube-red text-white hover:bg-red-800",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
