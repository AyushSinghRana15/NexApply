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
        "fixed inset-y-0 left-0 z-50 w-60 bg-white rubik-border transform transition-transform duration-300 lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-between h-16 px-6 border-b-2 border-black">
        <span className="text-lg font-black tracking-tight">
          Nex<span className="text-cube-blue">Apply</span>
        </span>
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-black hover:text-cube-red"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="p-3 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 text-sm font-bold rubik-border-thin transition-all duration-100",
                isActive
                  ? "bg-cube-yellow text-black rubik-shadow-sm"
                  : "bg-white text-black hover:bg-gray-100 hover:translate-x-0.5"
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
