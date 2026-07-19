import { Menu } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { useWSStore } from "@/stores/useWSStore";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { toggleSidebar } = useAppStore();
  const isConnected = useWSStore((s) => s.isConnected);

  return (
    <header className="h-14 border-b border-border bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-text-secondary hover:text-text-primary transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-2 h-2 rounded-full transition-colors",
            isConnected ? "bg-green-500" : "bg-red-400"
          )} />
          <span className="text-xs font-medium text-text-secondary">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold text-text-muted bg-gray-100 px-2.5 py-1 rounded-lg">
          v0.1.0
        </span>
      </div>
    </header>
  );
}
