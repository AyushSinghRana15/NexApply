import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfig } from "@/hooks/useQueries";
import { updateConfig } from "@/api/client";
import { Button } from "@/components/ui";
import { Save } from "lucide-react";

export function Settings() {
  const { data: config, isLoading } = useConfig();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <p className="text-dark-400">Loading configuration...</p>
      </div>
    );
  }

  const cfg = { ...config, ...editing };

  const handleChange = (path: string, value: unknown) => {
    const keys = path.split(".");
    let current: Record<string, unknown> = { ...editing };
    let ptr = current;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!ptr[keys[i]]) ptr[keys[i]] = {};
      ptr[keys[i]] = { ...(ptr[keys[i]] as Record<string, unknown>) };
      ptr = ptr[keys[i]] as Record<string, unknown>;
    }
    ptr[keys[keys.length - 1]] = value;
    setEditing(current);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await updateConfig(editing);
      setEditing({});
      setMessage("Configuration saved");
      queryClient.invalidateQueries({ queryKey: ["config"] });
    } catch {
      setMessage("Failed to save config");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  };

  const renderValue = (key: string, value: unknown, path: string): ReactNode => {
    if (typeof value === "boolean") {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleChange(path, e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-700 accent-accent"
          />
          <span className="text-sm">{key}</span>
        </label>
      );
    }
    if (typeof value === "number") {
      return (
        <div>
          <p className="text-xs text-dark-500 mb-1">{key}</p>
          <input
            type="number"
            value={value as number}
            onChange={(e) => handleChange(path, Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-600 text-sm focus:outline-none focus:border-accent"
          />
        </div>
      );
    }
    if (typeof value === "string") {
      return (
        <div>
          <p className="text-xs text-dark-500 mb-1">{key}</p>
          <input
            type="text"
            value={value as string}
            onChange={(e) => handleChange(path, e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-600 text-sm focus:outline-none focus:border-accent"
          />
        </div>
      );
    }
    if (Array.isArray(value)) {
      return (
        <div>
          <p className="text-xs text-dark-500 mb-1">{key}</p>
          <textarea
            value={(value as unknown[]).join("\n")}
            onChange={(e) => handleChange(path, e.target.value.split("\n").filter(Boolean))}
            className="w-full px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-600 text-sm focus:outline-none focus:border-accent font-mono"
            rows={4}
          />
        </div>
      );
    }
    if (typeof value === "object" && value !== null) {
      return (
        <div className="ml-4 border-l border-dark-700 pl-4 space-y-3">
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <div key={k}>{renderValue(k, v, `${path}.${k}`)}</div>
          ))}
        </div>
      );
    }
    return <span className="text-sm text-dark-400">{String(value)}</span>;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-dark-400 text-sm mt-1">Agent pipeline configuration</p>
        </div>
        <div className="flex items-center gap-3">
          {message && <span className="text-xs text-green-400">{message}</span>}
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || Object.keys(editing).length === 0}>
            <Save size={16} /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
        {Object.entries(cfg).map(([key, value]) => (
          <div key={key}>{renderValue(key, value, key)}</div>
        ))}
      </div>
    </div>
  );
}
