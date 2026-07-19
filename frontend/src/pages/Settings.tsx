import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfig } from "@/hooks/useQueries";
import { toast } from "@/components/common/Toast";
import { updateConfig } from "@/api/client";
import { Button } from "@/components/ui";
import { Save } from "lucide-react";
import { cn } from "@/lib/utils";

type Platforms = Record<string, { enabled?: boolean; headless?: boolean; max_concurrent?: number; cookies?: string[] }>;

interface AppConfig {
  min_match_score?: number;
  max_applications_per_run?: number;
  review_timeout_seconds?: number;
  auto_apply_enabled?: boolean;
  application_delay_seconds?: number;
  platforms?: Platforms;
  agent_wakeup_interval_seconds?: number;
  notification?: Record<string, boolean>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          "w-10 h-5 rounded-full relative transition-colors cursor-pointer",
          checked ? "bg-accent" : "bg-gray-300"
        )}
      >
        <div className={cn(
          "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )} />
      </div>
    </label>
  );
}

export function Settings() {
  const { data: config, isLoading } = useConfig();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AppConfig>({});
  const [platforms, setPlatforms] = useState<Platforms>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setForm(config as AppConfig);
      setPlatforms((config as AppConfig).platforms ?? {});
      setHasChanges(false);
    }
  }, [config]);

  const platformsConfig: { key: string; label: string }[] = [
    { key: "indeed", label: "Indeed" },
    { key: "naukri", label: "Naukri" },
    { key: "glassdoor", label: "Glassdoor" },
    { key: "foundit", label: "Foundit" },
    { key: "internshala", label: "Internshala" },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig({ ...form, platforms });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setHasChanges(false);
      toast.getState().add("success", "Configuration saved");
    } catch (err: any) {
      toast.getState().add("error", err?.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-20 text-text-muted text-sm">Loading configuration...</div>;
  }

  return (
    <div className="max-w-[900px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
            <Save size={14} /> {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-5 space-y-5 soft-shadow animate-fade-in">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Pipeline</h3>

          <div>
            <label className="text-sm font-medium block mb-2">
              Min match score: <span className="text-accent font-bold">{form.min_match_score ?? 60}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={form.min_match_score ?? 60}
              onChange={(e) => { setForm({ ...form, min_match_score: +e.target.value }); setHasChanges(true); }}
              className="w-full accent-accent h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              Review timeout: <span className="text-accent font-bold">{form.review_timeout_seconds ?? 300}s</span>
            </label>
            <input
              type="range"
              min={60}
              max={1200}
              step={60}
              value={form.review_timeout_seconds ?? 300}
              onChange={(e) => { setForm({ ...form, review_timeout_seconds: +e.target.value }); setHasChanges(true); }}
              className="w-full accent-accent h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              App delay: <span className="text-accent font-bold">{form.application_delay_seconds ?? 5}s</span>
            </label>
            <input
              type="range"
              min={0}
              max={30}
              value={form.application_delay_seconds ?? 5}
              onChange={(e) => { setForm({ ...form, application_delay_seconds: +e.target.value }); setHasChanges(true); }}
              className="w-full accent-accent h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <Toggle
            checked={form.auto_apply_enabled ?? false}
            onChange={(v) => { setForm({ ...form, auto_apply_enabled: v }); setHasChanges(true); }}
            label="Auto-apply"
          />
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 space-y-5 soft-shadow animate-fade-in">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Platforms</h3>
          {platformsConfig.map(({ key, label }) => {
            const p = platforms[key] ?? {};
            return (
              <div key={key} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{label}</span>
                  <div className="flex gap-1.5 text-[10px] font-medium uppercase tracking-wide">
                    <span className={p.headless !== false ? "text-green-500 bg-green-50 px-2 py-0.5 rounded-lg" : "text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg"}>
                      {p.headless !== false ? "headless" : "headed"}
                    </span>
                    <span className="text-text-muted bg-gray-100 px-2 py-0.5 rounded-lg">
                      max {p.max_concurrent ?? 1}
                    </span>
                  </div>
                </div>
                <div
                  onClick={() => { setPlatforms({ ...platforms, [key]: { ...p, enabled: !p.enabled } }); setHasChanges(true); }}
                  className={cn(
                    "w-10 h-5 rounded-full relative transition-colors cursor-pointer",
                    p.enabled ? "bg-accent" : "bg-gray-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    p.enabled ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
