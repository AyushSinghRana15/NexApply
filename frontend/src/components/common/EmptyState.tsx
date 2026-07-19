import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="p-4 rounded-2xl bg-gray-100 mb-4 animate-bounce-gentle">
        <Icon size={36} className="text-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      {description && <p className="text-sm text-text-secondary mt-2 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-5 py-2.5 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover shadow-sm hover:shadow-md transition-smooth"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
