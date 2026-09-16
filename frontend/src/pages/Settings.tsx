import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfig } from "@/hooks/useQueries";
import { toast } from "@/components/common/Toast";
import { updateConfig } from "@/api/client";
import { Button } from "@/components/ui";
import { Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsForm {
  tailor: { min_match_score: number };
  guard: { review_timeout_seconds: number };
  fleet: { human_delay_max: number };
  autonomy: { mode: "full" | "supervised" | "manual" };
  platforms: Record<string, boolean>;
}

const PLATFORM_KEYS = ["indeed", "glassdoor", "foundit", "internshala", "naukri"];

const PLATFORM_LABELS: Record<string, string> = {
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  foundit: "Foundit",
  internshala: "Internshala",
  naukri: "Naukri",
};

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
  const [form, setForm] = useState<SettingsForm>({
    tailor: { min_match_score: 70 },
    guard: { review_timeout_seconds: 300 },
    fleet: { human_delay_max: 0.8 },
    autonomy: { mode: "full" },
    platforms: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      const c: Record<string, any> = config as Record<string, any>;
      setForm({
        tailor: {
          min_match_score: c?.tailor?.min_match_score ?? 70,
        },
        guard: {
          review_timeout_seconds: c?.guard?.review_timeout_seconds ?? 300,
        },
        fleet: {
          human_delay_max: c?.fleet?.human_delay_max ?? 0.8,
        },
        autonomy: {
          mode: c?.autonomy?.mode === "manual" ? "manual" : c?.autonomy?.mode === "supervised" ? "supervised" : "full",
        },
        platforms: ({ ...(c?.platforms ?? {}) }),
      });
      setHasChanges(false);
    }
  }, [config]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig(form as unknown as Record<string, unknown>);
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

  const autoApply = form.autonomy.mode === "full";

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
              Min match score: <span className="text-accent font-bold">{form.tailor.min_match_score}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={form.tailor.min_match_score}
              onChange={(e) => { setForm((f) => ({ ...f, tailor: { ...f.tailor, min_match_score: +e.target.value } })); setHasChanges(true); }}
              className="w-full accent-accent h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              Review timeout: <span className="text-accent font-bold">{form.guard.review_timeout_seconds}s</span>
            </label>
            <input
              type="range"
              min={60}
              max={1200}
              step={60}
              value={form.guard.review_timeout_seconds}
              onChange={(e) => { setForm((f) => ({ ...f, guard: { ...f.guard, review_timeout_seconds: +e.target.value } })); setHasChanges(true); }}
              className="w-full accent-accent h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              Human-like delay: <span className="text-accent font-bold">{form.fleet.human_delay_max}s</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={form.fleet.human_delay_max}
              onChange={(e) => { setForm((f) => ({ ...f, fleet: { ...f.fleet, human_delay_max: +e.target.value } })); setHasChanges(true); }}
              className="w-full accent-accent h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <Toggle
            checked={autoApply}
            onChange={(v) => { setForm((f) => ({ ...f, autonomy: { mode: v ? "full" : "supervised" } })); setHasChanges(true); }}
            label="Auto-apply (full autonomy)"
          />
          <p className="text-xs text-text-muted">
            Off = supervised mode — every application pauses for human review.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 space-y-5 soft-shadow animate-fade-in">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Platforms</h3>
          {PLATFORM_KEYS.map((key) => {
            const enabled = form.platforms[key] ?? false;
            return (
              <div key={key} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{PLATFORM_LABELS[key] ?? key}</span>
                  <span className={cn(
                    "text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-lg",
                    enabled ? "text-green-600 bg-green-50" : "text-gray-400 bg-gray-100"
                  )}>
                    {enabled ? "on" : "off"}
                  </span>
                </div>
                <Toggle
                  checked={enabled}
                  onChange={(v) => { setForm((f) => ({ ...f, platforms: { ...f.platforms, [key]: v } })); setHasChanges(true); }}
                  label=""
                />
              </div>
            );
          })}
          <p className="text-xs text-text-muted">
            Only platforms with an enabled watcher + worker + cookies will process jobs.
          </p>
        </div>
      </div>
    </div>
  );
}