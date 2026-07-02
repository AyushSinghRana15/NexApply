import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-ink-800 mb-4">
        <Icon size={40} className="text-ink-500" />
      </div>
      <h3 className="text-lg font-semibold text-ink-300">{title}</h3>
      {description && <p className="text-sm text-ink-500 mt-2 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
