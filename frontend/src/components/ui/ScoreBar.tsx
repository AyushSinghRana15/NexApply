import { cn } from "@/lib/utils";

interface ScoreBarProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBar({ score, size = "md" }: ScoreBarProps) {
  const color =
    score >= 80 ? "bg-cube-green" : score >= 60 ? "bg-cube-orange" : "bg-cube-red";

  return (
    <div
      className={cn(
        "bg-gray-200 overflow-hidden rubik-border-thin",
        size === "sm" && "h-1.5 w-20",
        size === "md" && "h-2 w-24",
        size === "lg" && "h-3 w-full"
      )}
    >
      <div
        className={cn("h-full transition-all duration-500", color)}
        style={{ width: `${Math.min(score, 100)}%` }}
      />
    </div>
  );
}
