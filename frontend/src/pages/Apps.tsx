import { useQuery } from "@tanstack/react-query";
import { fetchCookieStatus } from "@/api/client";
import { useConfig } from "@/hooks/useQueries";
import { Badge, Button } from "@/components/ui";
import { CheckCircle, XCircle, Info, Terminal, RefreshCw, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORM_INFO: Record<string, { label: string; file: string }> = {
  indeed: { label: "Indeed", file: "cookies/indeed_cookies.json" },
  naukri: { label: "Naukri", file: "cookies/naukri_cookies.json" },
  internshala: { label: "Internshala", file: "cookies/internshala_cookies.json" },
  glassdoor: { label: "Glassdoor", file: "cookies/glassdoor_cookies.json" },
  foundit: { label: "Foundit", file: "cookies/foundit_cookies.json" },
};

export function Apps() {
  const { data: config } = useConfig();
  const { data: status, refetch, isFetching } = useQuery({
    queryKey: ["cookies/status"],
    queryFn: fetchCookieStatus,
  });

  const platforms = (config as Record<string, any> | undefined)?.platforms ?? {};

  const entries = Object.keys(PLATFORM_INFO).map((key) => {
    const cfgEnabled = Boolean(platforms[key]);
    const s = status?.platforms?.[key];
    return { key, ...PLATFORM_INFO[key], cfgEnabled, ...(s ?? {}) };
  });

  return (
    <div className="max-w-[900px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">App Logins</h1>
        <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={cn(isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 items-start">
        <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-text-secondary space-y-1.5">
          <p>
            Login to each platform once in a browser, then save the session cookies. NexApply reuses
            these cookies for every application — it never re-logs-in mid-run.
          </p>
          <p className="font-mono text-xs text-text-muted">
            python3 scripts/save_cookies.py indeed
          </p>
          <p className="text-xs text-text-muted">
            Enable/disable platforms in the Settings page.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border divide-y divide-border soft-shadow">
        {entries.map(({ key, label, file, cfgEnabled, loaded, last_captured, enabled }) => {
          const platformEnabled = cfgEnabled && Boolean(enabled);
          return (
            <div key={key} className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">{label}</span>
                <div className="hidden sm:flex items-center gap-1.5 text-text-muted text-xs">
                  <LinkIcon size={12} />
                  {file}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!platformEnabled && <Badge variant="warning">disabled</Badge>}
                {platformEnabled && loaded && (
                  <Badge variant="success">
                    <CheckCircle size={12} /> Session Active
                  </Badge>
                )}
                {platformEnabled && !loaded && (
                  <Badge variant="danger">
                    <XCircle size={12} /> No Session
                  </Badge>
                )}
              </div>

              <div className="text-right text-xs text-text-muted hidden md:block">
                {last_captured
                  ? `Saved ${new Date(last_captured).toLocaleDateString()} ${new Date(last_captured).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : platformEnabled
                    ? "Capture cookies to enable"
                    : "Disabled in config"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface rounded-2xl border border-border p-5 space-y-3 soft-shadow">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-accent" />
          <h3 className="text-sm font-semibold">Capture cookies (CLI)</h3>
        </div>
        <pre className="text-xs font-mono bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto leading-relaxed">
{`# 1. Log in to the platform in the automated browser
python3 scripts/save_cookies.py indeed

# 2. Save a new cookie file for another platform
python3 scripts/save_cookies.py naukri
python3 scripts/save_cookies.py internshala

# Cookies are stored in cookies/<platform>_cookies.json`}
        </pre>
      </div>
    </div>
  );
}