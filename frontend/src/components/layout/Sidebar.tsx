import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  Briefcase,
  BarChart3,
  FileText,
  Settings,
  LogIn,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/useAppStore";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/review", label: "Review", icon: ClipboardCheck },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/resumes", label: "Resumes", icon: FileText },
  { to: "/apps", label: "App Login", icon: LogIn },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-60 bg-ink-900 border-r border-border transform transition-transform duration-300 lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-between h-16 px-6 border-b border-border">
        <span className="text-lg font-bold tracking-tight">
          Nex<span className="text-accent">Apply</span>
        </span>
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-ink-400 hover:text-text-primary"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="p-4 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent/10 text-accent border-r-2 border-accent"
                  : "text-ink-400 hover:text-text-primary hover:bg-surface-hover"
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
