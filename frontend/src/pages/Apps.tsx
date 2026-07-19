import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfig } from "@/hooks/useQueries";
import { toast } from "@/components/common/Toast";
import { updateConfig } from "@/api/client";
import { Button } from "@/components/ui";
import { CheckCircle, XCircle, Plus, X, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppConfig {
  platforms?: Record<string, { enabled?: boolean; cookie_valid?: boolean; cookies?: string[]; headless?: boolean; max_concurrent?: number }>;
}

const PLATFORM_INFO: Record<string, { label: string; placeholder: string }> = {
  indeed: { label: "Indeed", placeholder: "user@example.com" },
  naukri: { label: "Naukri", placeholder: "user@example.com" },
  glassdoor: { label: "Glassdoor", placeholder: "user@example.com" },
  foundit: { label: "Foundit", placeholder: "user@example.com" },
  internshala: { label: "Internshala", placeholder: "user@example.com" },
};

export function Apps() {
  const { data: config } = useConfig();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [editingCookies, setEditingCookies] = useState<Record<string, string[]>>({});
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [newPlatformKey, setNewPlatformKey] = useState("");
  const [newPlatformLabel, setNewPlatformLabel] = useState("");

  const platforms = (config as AppConfig | undefined)?.platforms;

  useEffect(() => {
    if (platforms) {
      const initial: Record<string, string[]> = {};
      Object.entries(platforms).forEach(([key, val]) => {
        initial[key] = val.cookies ?? [];
      });
      setEditingCookies(initial);
    }
  }, [platforms]);

  const handleSaveCookies = async (platformKey: string) => {
    setLoading((p) => ({ ...p, [`${platformKey}_save`]: true }));
    try {
      const newPlatforms = { ...platforms, [platformKey]: { ...(platforms?.[platformKey] ?? {}), cookies: editingCookies[platformKey] ?? [] } };
      await updateConfig({ platforms: newPlatforms });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.getState().add("success", `${platformKey} cookies saved`);
    } catch (e: any) {
      toast.getState().add("error", e?.message || "Failed to save cookies");
    } finally {
      setLoading((p) => ({ ...p, [`${platformKey}_save`]: false }));
    }
  };

  const handleAddPlatform = async () => {
    if (!newPlatformKey.trim()) return;
    const key = newPlatformKey.trim().toLowerCase().replace(/\s+/g, "_");
    const newPlatforms = {
      ...platforms,
      [key]: { enabled: true, cookies: [], headless: true, max_concurrent: 1 },
    };
    try {
      await updateConfig({ platforms: newPlatforms });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setEditingCookies((p) => ({ ...p, [key]: [] }));
      setNewPlatformKey("");
      setNewPlatformLabel("");
      setShowAddPlatform(false);
      toast.getState().add("success", `Added platform: ${key}`);
    } catch {
      toast.getState().add("error", "Failed to add platform");
    }
  };

  const handleDeletePlatform = async (platformKey: string) => {
    if (!window.confirm(`Delete ${platformKey}?`)) return;
    const newPlatforms = { ...platforms };
    delete newPlatforms[platformKey];
    try {
      await updateConfig({ platforms: newPlatforms });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.getState().add("success", `Deleted ${platformKey}`);
    } catch {
      toast.getState().add("error", "Failed to delete platform");
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">App Logins</h1>
        <Button variant="primary" size="sm" onClick={() => setShowAddPlatform(true)}>
          <Plus size={14} /> Add Platform
        </Button>
      </div>

      {showAddPlatform && (
        <div className="bg-white rounded-2xl border border-border p-5 soft-shadow animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Add New Platform</h3>
            <button onClick={() => setShowAddPlatform(false)} className="text-text-muted hover:text-text-primary transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Platform key (lowercase, underscore)</label>
              <input
                type="text"
                value={newPlatformKey}
                onChange={(e) => setNewPlatformKey(e.target.value)}
                placeholder="e.g. linkedin, wellfound, cutshort"
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-xl focus:ring-2 focus:ring-accent/20 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Display label</label>
              <input
                type="text"
                value={newPlatformLabel}
                onChange={(e) => setNewPlatformLabel(e.target.value)}
                placeholder="e.g. LinkedIn"
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-xl focus:ring-2 focus:ring-accent/20 outline-none"
              />
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={handleAddPlatform} disabled={!newPlatformKey.trim()}>
            <Plus size={14} /> Add
          </Button>
        </div>
      )}

      {Object.entries(PLATFORM_INFO).map(([key, info]) => {
        const p = platforms?.[key];
        const isCookieValid = p?.cookie_valid ?? false;
        const isSaving = loading[`${key}_save`] ?? false;

        return (
          <div key={key} className="bg-white rounded-2xl border border-border p-5 soft-shadow space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{info.label}</span>
                <span className={cn(
                  "text-xs font-medium px-2.5 py-0.5 rounded-lg flex items-center gap-1",
                  isCookieValid ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                )}>
                  {isCookieValid ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {isCookieValid ? "Session Active" : "No Session"}
                </span>
              </div>
              <button
                onClick={() => handleDeletePlatform(key)}
                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
              >
                Delete
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Cookies (one per line)</label>
              <textarea
                value={(editingCookies[key] ?? []).join("\n")}
                onChange={(e) => setEditingCookies((prev) => ({
                  ...prev,
                  [key]: e.target.value.split("\n").filter((s) => s.trim()),
                }))}
                placeholder={"sessionid=abc123\ncsrftoken=xyz789"}
                rows={5}
                className="w-full px-3 py-2 text-sm font-mono bg-surface border border-border rounded-xl focus:ring-2 focus:ring-accent/20 outline-none"
              />
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveCookies(key)}
              disabled={isSaving}
            >
              <Save size={14} /> {isSaving ? "Saving..." : "Save Cookies"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
