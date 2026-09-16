import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToast } from "@/stores/toast";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: "border-green-200 bg-green-50 text-green-600",
  error: "border-red-200 bg-red-50 text-red-600",
  warning: "border-amber-200 bg-amber-50 text-amber-600",
  info: "border-blue-200 bg-blue-50 text-blue-600",
};

function ToastItem({ item }: { item: { id: string; type: ToastType; message: string } }) {
  const Icon = icons[item.type];
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border soft-shadow-lg animate-slide-in-right min-w-[280px]",
        colors[item.type]
      )}
    >
      <Icon size={18} className="shrink-0" />
      <span className="text-sm font-medium flex-1">{item.message}</span>
      <button onClick={() => useToast.getState().remove(item.id)} className="opacity-50 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToast((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} />
      ))}
    </div>
  );
}
