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
      <div className="p-4 rubik-border-thin bg-gray-100 mb-4">
        <Icon size={40} className="text-gray-400" />
      </div>
      <h3 className="text-lg font-bold text-black">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-2 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-cube-blue text-white font-bold rubik-border-thin hover:bg-blue-800 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
