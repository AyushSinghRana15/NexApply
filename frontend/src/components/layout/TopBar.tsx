import { Menu, Wifi, WifiOff } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { useWSStore } from "@/stores/useWSStore";

export function TopBar() {
  const { toggleSidebar } = useAppStore();
  const isConnected = useWSStore((s) => s.isConnected);

  return (
    <header className="h-16 border-b-2 border-black bg-white flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-black hover:text-cube-blue"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm font-bold">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-cube-green rubik-border-thin px-2 py-0.5">
              <Wifi size={14} />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-cube-red rubik-border-thin px-2 py-0.5">
              <WifiOff size={14} />
              Disconnected
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-black bg-cube-yellow rubik-border-thin px-2.5 py-1">
          v0.1.0
        </span>
      </div>
    </header>
  );
}
