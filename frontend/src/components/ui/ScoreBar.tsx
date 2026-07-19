import { cn } from "@/lib/utils";

interface ScoreBarProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBar({ score, size = "md" }: ScoreBarProps) {
  const color =
    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-red-400";

  return (
    <div
      className={cn(
        "bg-gray-100 overflow-hidden rounded-full",
        size === "sm" && "h-1.5 w-20",
        size === "md" && "h-2 w-24",
        size === "lg" && "h-2.5 w-full"
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
        style={{ width: `${Math.min(score, 100)}%` }}
      />
    </div>
  );
}
