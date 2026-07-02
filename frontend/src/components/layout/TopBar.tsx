import { Menu, Wifi, WifiOff } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { useWSStore } from "@/stores/useWSStore";

export function TopBar() {
  const { toggleSidebar } = useAppStore();
  const isConnected = useWSStore((s) => s.isConnected);

  return (
    <header className="h-16 border-b border-border bg-ink-900/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-ink-400 hover:text-text-primary"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm text-ink-400">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-success">
              <Wifi size={14} />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-danger">
              <WifiOff size={14} />
              Disconnected
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-400 bg-ink-800 px-2.5 py-1 rounded-full">
          v0.1.0
        </span>
      </div>
    </header>
  );
}
