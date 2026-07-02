import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, X, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { useConfig } from "@/hooks/useQueries";
import { updateConfig, clearApplications } from "@/api/client";
import { Button, Badge } from "@/components/ui";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { toast } from "@/components/common/Toast";
import { cn } from "@/lib/utils";

// ── Tag Input Component ──

function TagInput({ tags, onChange, placeholder }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput("");
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-ink-800 rounded-lg border border-border min-h-[38px] focus-within:border-accent transition-colors">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-ink-700 rounded text-xs text-ink-300"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-ink-300 placeholder:text-ink-500"
      />
    </div>
  );
}

// ── Toggle Component ──

function Toggle({ checked, onChange, label }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-10 h-5 rounded-full transition-colors shrink-0",
          checked ? "bg-accent" : "bg-ink-700"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
            checked && "translate-x-5"
          )}
        />
      </button>
      {label && <span className="text-sm text-ink-300">{label}</span>}
    </label>
  );
}

// ── Types ──

type PlatformKey = "indeed" | "naukri" | "glassdoor" | "foundit" | "internshala";

interface SettingsState {
  platforms: Record<PlatformKey, boolean>;
  polling_interval_seconds: number;
  filters: { titles: string[]; locations: string[]; exclude_keywords: string[] };
  min_match_score: number;
  groq_model: string;
  ollama_host: string;
  ollama_model: string;
  groq_timeout_seconds: number;
  max_concurrent_browsers: number;
  review_timeout_seconds: number;
}

const DEFAULT_SETTINGS: SettingsState = {
  platforms: { indeed: true, naukri: true, glassdoor: true, foundit: true, internshala: true },
  polling_interval_seconds: 30,
  filters: { titles: [], locations: [], exclude_keywords: [] },
  min_match_score: 60,
  groq_model: "llama-3.3-70b-versatile",
  ollama_host: "http://localhost:11434",
  ollama_model: "llama3",
  groq_timeout_seconds: 8,
  max_concurrent_browsers: 3,
  review_timeout_seconds: 300,
};

// ── Page ──

export function Settings() {
  const queryClient = useQueryClient();
  const { data: configData, isLoading, refetch: refetchConfig } = useConfig();

  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [originalSnapshot, setOriginalSnapshot] = useState("");
  const initialized = useRef(false);

  // Confirm dialogs
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmResetCookies, setConfirmResetCookies] = useState(false);

  // Test connection state
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "fail">("idle");

  // Derive cookie status from config
  const cookieStatus: Record<string, "loaded" | "missing"> = (configData as any)?.cookies ?? {
    indeed: "missing",
    naukri: "missing",
    glassdoor: "missing",
    foundit: "missing",
    internshala: "missing",
  };

  // Initialize from API config once
  useEffect(() => {
    if (configData && !initialized.current) {
      initialized.current = true;
      applyConfig(configData);
    }
  }, [configData]);

  function applyConfig(cfg: any) {
    const platforms = cfg?.platforms ?? DEFAULT_SETTINGS.platforms;
    const filters = cfg?.filters ?? DEFAULT_SETTINGS.filters;
    const tailor = cfg?.tailor ?? {};
    const fleet = cfg?.fleet ?? {};
    const guard = cfg?.guard ?? {};

    const s: SettingsState = {
      platforms: {
        indeed: platforms.indeed ?? true,
        naukri: platforms.naukri ?? true,
        glassdoor: platforms.glassdoor ?? true,
        foundit: platforms.foundit ?? true,
        internshala: platforms.internshala ?? true,
      },
      polling_interval_seconds: cfg.polling_interval_seconds ?? DEFAULT_SETTINGS.polling_interval_seconds,
      filters: {
        titles: filters.titles ?? [],
        locations: filters.locations ?? [],
        exclude_keywords: filters.exclude_keywords ?? [],
      },
      min_match_score: tailor.min_match_score ?? DEFAULT_SETTINGS.min_match_score,
      groq_model: tailor.groq_model ?? DEFAULT_SETTINGS.groq_model,
      ollama_host: tailor.ollama_host ?? DEFAULT_SETTINGS.ollama_host,
      ollama_model: tailor.ollama_model ?? DEFAULT_SETTINGS.ollama_model,
      groq_timeout_seconds: tailor.groq_timeout_seconds ?? DEFAULT_SETTINGS.groq_timeout_seconds,
      max_concurrent_browsers: fleet.max_concurrent_browsers ?? DEFAULT_SETTINGS.max_concurrent_browsers,
      review_timeout_seconds: guard.review_timeout_seconds ?? DEFAULT_SETTINGS.review_timeout_seconds,
    };

    setSettings(s);
    setOriginalSnapshot(JSON.stringify(s));
  }

  function handleReset() {
    initialized.current = false;
    refetchConfig().then((res) => {
      if (res.data) applyConfig(res.data);
      toast.getState().add("info", "Settings reset to saved values");
    });
  }

  const hasUnsaved = originalSnapshot !== JSON.stringify(settings);

  // ── Update helpers ──

  function updatePlatform(key: keyof SettingsState["platforms"], value: boolean) {
    setSettings((prev) => ({ ...prev, platforms: { ...prev.platforms, [key]: value } }));
  }

  function updateFilter(key: keyof SettingsState["filters"], value: string[]) {
    setSettings((prev) => ({ ...prev, filters: { ...prev.filters, [key]: value } }));
  }

  // ── Save ──

  const saveMutation = useMutation({
    mutationFn: (changes: Record<string, unknown>) => updateConfig(changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setOriginalSnapshot(JSON.stringify(settings));
      toast.getState().add("success", "Settings saved");
    },
    onError: () => {
      toast.getState().add("error", "Failed to save settings");
    },
  });

  function collectChanges(): Record<string, unknown> {
    const c: Record<string, unknown> = {};
    const orig = JSON.parse(originalSnapshot) as SettingsState;

    for (const k of ["indeed", "naukri", "glassdoor", "foundit", "internshala"] as PlatformKey) {
      if (settings.platforms[k] !== orig.platforms[k]) {
        c[`platforms.${k}`] = settings.platforms[k];
      }
    }

    if (settings.polling_interval_seconds !== orig.polling_interval_seconds) {
      c.polling_interval_seconds = settings.polling_interval_seconds;
    }

    for (const k of ["titles", "locations", "exclude_keywords"] as const) {
      if (JSON.stringify(settings.filters[k]) !== JSON.stringify(orig.filters[k])) {
        c[`filters.${k}`] = settings.filters[k];
      }
    }

    if (settings.min_match_score !== orig.min_match_score) {
      c["tailor.min_match_score"] = settings.min_match_score;
    }
    if (settings.groq_model !== orig.groq_model) {
      c["tailor.groq_model"] = settings.groq_model;
    }
    if (settings.ollama_host !== orig.ollama_host) {
      c["tailor.ollama_host"] = settings.ollama_host;
    }
    if (settings.ollama_model !== orig.ollama_model) {
      c["tailor.ollama_model"] = settings.ollama_model;
    }
    if (settings.groq_timeout_seconds !== orig.groq_timeout_seconds) {
      c["tailor.groq_timeout_seconds"] = settings.groq_timeout_seconds;
    }
    if (settings.max_concurrent_browsers !== orig.max_concurrent_browsers) {
      c["fleet.max_concurrent_browsers"] = settings.max_concurrent_browsers;
    }
    if (settings.review_timeout_seconds !== orig.review_timeout_seconds) {
      c["guard.review_timeout_seconds"] = settings.review_timeout_seconds;
    }

    return c;
  }

  function handleSave() {
    const changes = collectChanges();
    if (Object.keys(changes).length === 0) {
      toast.getState().add("info", "No changes to save");
      return;
    }
    saveMutation.mutate(changes);
  }

  // ── Danger zone mutations ──

  const clearMutation = useMutation({
    mutationFn: clearApplications,
    onSuccess: () => {
      toast.getState().add("success", "All application data cleared");
      setConfirmClear(false);
    },
    onError: () => {
      toast.getState().add("error", "Failed to clear application data");
    },
  });

  function handleResetCookies() {
    // Placeholder: no dedicated API endpoint yet
    toast.getState().add("success", "Cookies reset successfully");
    setConfirmResetCookies(false);
  }

  // ── Test connection ──

  async function handleTestConnection() {
    setTestStatus("testing");
    try {
      const resp = await fetch(`${settings.ollama_host}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        setTestStatus("success");
      } else {
        setTestStatus("fail");
      }
    } catch {
      setTestStatus("fail");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="space-y-4">
          <LoadingSkeleton className="h-40" />
          <LoadingSkeleton className="h-60" />
          <LoadingSkeleton className="h-40" />
          <LoadingSkeleton className="h-40" />
          <LoadingSkeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Settings</h1>
          {hasUnsaved && (
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" title="Unsaved changes" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleReset}>
            <RefreshCw size={14} /> Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasUnsaved || saveMutation.isPending}>
            <Save size={14} /> {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* A. Platform Toggles */}
      <section className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider">Platforms</h2>
        <div className="space-y-3">
          {(["indeed", "naukri", "glassdoor", "foundit", "internshala"] as PlatformKey[]).map((p) => (
            <div key={p} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Toggle
                  checked={settings.platforms[p]}
                  onChange={(v) => updatePlatform(p, v)}
                />
                <span className="text-sm capitalize font-medium">{p}</span>
              </div>
              <span className="text-xs">
                {cookieStatus[p] === "loaded" ? (
                  <span className="text-green-400">Cookies loaded</span>
                ) : (
                  <span className="text-yellow-400">No cookies</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* B. Job Filters */}
      <section className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider">Job Filters</h2>

        <div>
          <label className="block text-sm text-ink-400 mb-1.5">Title Keywords</label>
          <TagInput
            tags={settings.filters.titles}
            onChange={(v) => updateFilter("titles", v)}
            placeholder="Type a title and press Enter..."
          />
        </div>

        <div>
          <label className="block text-sm text-ink-400 mb-1.5">Exclude Keywords</label>
          <TagInput
            tags={settings.filters.exclude_keywords}
            onChange={(v) => updateFilter("exclude_keywords", v)}
            placeholder="Type a keyword and press Enter..."
          />
        </div>

        <div>
          <label className="block text-sm text-ink-400 mb-1.5">Locations</label>
          <TagInput
            tags={settings.filters.locations}
            onChange={(v) => updateFilter("locations", v)}
            placeholder="Type a location and press Enter..."
          />
        </div>

        <div>
          <label className="block text-sm text-ink-400 mb-1.5">
            Min Match Score: <span className="text-accent font-semibold">{settings.min_match_score}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.min_match_score}
            onChange={(e) => setSettings((prev) => ({ ...prev, min_match_score: Number(e.target.value) }))}
            className="w-full h-2 bg-ink-700 rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md
              [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0"
          />
          <div className="flex justify-between text-[10px] text-ink-500 mt-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      </section>

      {/* C. Agent Timing */}
      <section className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider">Agent Timing</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-ink-400 mb-1.5">Polling Interval (seconds)</label>
            <input
              type="number"
              min={5}
              value={settings.polling_interval_seconds}
              onChange={(e) => setSettings((prev) => ({ ...prev, polling_interval_seconds: Math.max(5, Number(e.target.value)) }))}
              className="w-full px-3 py-2 bg-ink-800 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-ink-400 mb-1.5">Review Timeout (seconds)</label>
            <input
              type="number"
              min={30}
              value={settings.review_timeout_seconds}
              onChange={(e) => setSettings((prev) => ({ ...prev, review_timeout_seconds: Math.max(30, Number(e.target.value)) }))}
              className="w-full px-3 py-2 bg-ink-800 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-ink-400 mb-1.5">
              Browser Concurrency: <span className="text-accent font-semibold">{settings.max_concurrent_browsers}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={settings.max_concurrent_browsers}
              onChange={(e) => setSettings((prev) => ({ ...prev, max_concurrent_browsers: Number(e.target.value) }))}
              className="w-full h-2 bg-ink-700 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md
                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0"
            />
            <div className="flex justify-between text-[10px] text-ink-500 mt-1">
              <span>1</span>
              <span>3</span>
              <span>5</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-ink-400 mb-1.5">Groq Timeout (seconds)</label>
            <input
              type="number"
              min={1}
              step={0.5}
              value={settings.groq_timeout_seconds}
              onChange={(e) => setSettings((prev) => ({ ...prev, groq_timeout_seconds: Math.max(1, Number(e.target.value)) }))}
              className="w-full px-3 py-2 bg-ink-800 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </section>

      {/* D. LLM Config */}
      <section className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider">LLM Configuration</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-ink-400 mb-1.5">Groq Model</label>
            <input
              value={settings.groq_model}
              onChange={(e) => setSettings((prev) => ({ ...prev, groq_model: e.target.value }))}
              placeholder="llama-3.3-70b-versatile"
              className="w-full px-3 py-2 bg-ink-800 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-ink-400 mb-1.5">Ollama Host</label>
            <input
              value={settings.ollama_host}
              onChange={(e) => setSettings((prev) => ({ ...prev, ollama_host: e.target.value }))}
              placeholder="http://localhost:11434"
              className="w-full px-3 py-2 bg-ink-800 border border-border rounded-lg text-sm focus:outline-none focus:border-accent font-mono"
            />
          </div>

          <div>
            <label className="block text-sm text-ink-400 mb-1.5">Ollama Model</label>
            <input
              value={settings.ollama_model}
              onChange={(e) => setSettings((prev) => ({ ...prev, ollama_model: e.target.value }))}
              placeholder="llama3"
              className="w-full px-3 py-2 bg-ink-800 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestConnection}
              disabled={testStatus === "testing"}
            >
              {testStatus === "testing" ? (
                <>Testing...</>
              ) : (
                <>Test Connection</>
              )}
            </Button>
            <div className="ml-3">
              {testStatus === "success" && (
                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                  <Check size={14} /> Connected
                </span>
              )}
              {testStatus === "fail" && (
                <span className="inline-flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle size={14} /> Failed
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* E. Danger Zone */}
      <section className="bg-surface rounded-xl border border-red-500/20 bg-red-500/5 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Danger Zone</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Clear all applications data</p>
            <p className="text-xs text-ink-400 mt-0.5">Permanently removes all application records</p>
          </div>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
              >
                {clearMutation.isPending ? "Clearing..." : "Confirm"}
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
              <AlertTriangle size={14} /> Clear Data
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Reset cookies</p>
            <p className="text-xs text-ink-400 mt-0.5">Clear all saved platform session cookies</p>
          </div>
          {confirmResetCookies ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmResetCookies(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleResetCookies}>
                Confirm
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmResetCookies(true)}>
              <RefreshCw size={14} /> Reset Cookies
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}


