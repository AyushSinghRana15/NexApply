import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useStatsSummary, useApplications, useConfig } from "@/hooks/useQueries";
import { useWSStore } from "@/stores/useWSStore";
import { StatCard, Badge } from "@/components/ui";
import { CardSkeleton, TableSkeleton } from "@/components/common";
import {
  Send, Clock, BarChart3, Mail,
  Search, Brain, Globe, Shield,
  CheckCircle, XCircle, AlertCircle,
  Activity, Check, Minus
} from "lucide-react";
import { formatTimeAgo, cn } from "@/lib/utils";
import { fetchEmailTrackingStats } from "@/api/client";

const agentMeta: Record<string, { name: string; role: string; icon: typeof Search }> = {
  radar: { name: "RadarAgent", role: "Job Discovery", icon: Search },
  tailor: { name: "TailorAgent", role: "Resume Tailoring", icon: Brain },
  fleet: { name: "ApplyFleet", role: "Browser Automation", icon: Globe },
  guard: { name: "GuardAgent", role: "Review Gate", icon: Shield },
};

const eventIconMap: Record<string, typeof Search> = {
  JOB_DETECTED: Search,
  JOB_TAILORED: Brain,
  JOB_FILLED: Globe,
  APPLICATION_SUBMITTED: CheckCircle,
  APPLICATION_SKIPPED: XCircle,
  REVIEW_TIMEOUT: Clock,
  EMAIL_UPDATE: Mail,
  AGENT_STATUS: Activity,
  RESUME_SUGGESTION: AlertCircle,
};

function EventIcon({ type, className }: { type: string; className?: string }) {
  const Icon = eventIconMap[type] ?? Activity;
  return <Icon size={16} className={className} />;
}

function AgentCard({ agent }: { agent: string }) {
  const info = useWSStore((s) => s.agents[agent]);
  const meta = agentMeta[agent];

  if (!meta) return null;

  const statusColor = info?.status === "online"
    ? "bg-green-500"
    : info?.status === "error"
      ? "bg-yellow-500"
      : "bg-red-500";

  const label = info?.status === "online" ? "Online"
    : info?.status === "error" ? "Error"
      : "Offline";

  return (
    <div className="bg-surface rounded-xl border border-border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-ink-700 text-accent">
            <meta.icon size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold">{meta.name}</p>
            <p className="text-xs text-ink-500">{meta.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", statusColor, info?.status === "online" && "animate-pulse")} />
          <span className={cn(
            "text-xs font-medium",
            info?.status === "online" ? "text-green-400"
              : info?.status === "error" ? "text-yellow-400"
                : "text-red-400"
          )}>
            {label}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-ink-400">
        <span>{info?.jobs_today ?? 0} jobs today</span>
        <span>{info?.last_active ? formatTimeAgo(info.last_active) : "—"}</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStatsSummary();
  const { data: emailStats } = useQuery({
    queryKey: ["email-stats"],
    queryFn: fetchEmailTrackingStats,
    refetchInterval: 30_000,
  });
  const { data: recentApps, isLoading: appsLoading } = useApplications({ page: 1 });
  const { data: config } = useConfig();
  const { pendingReviews, activityFeed, isConnected } = useWSStore();

  const configPlatforms = useMemo(() => {
    if (!config?.platforms) return null;
    return config.platforms as Record<string, { enabled?: boolean; cookie_valid?: boolean }>;
  }, [config]);

  const displayPlatforms = ["indeed", "naukri", "glassdoor", "foundit", "internshala"];

  const responseRate = emailStats?.response_rate ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-ink-400 text-sm mt-1">NexApply agent pipeline overview</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
          <span className="text-xs text-ink-400">{isConnected ? "Live" : "Disconnected"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </>
        ) : (
          <>
            <div className="animate-fade-in">
              <StatCard
                label="Applied"
                value={stats?.total_applied ?? 0}
                icon={<Send size={20} />}
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <StatCard
                label="Pending Review"
                value={(stats?.total_pending ?? 0) + pendingReviews.length}
                icon={<Clock size={20} />}
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <StatCard
                label="Avg Score"
                value={stats ? `${stats.avg_match_score}%` : "—"}
                icon={<BarChart3 size={20} />}
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <StatCard
                label="Response Rate"
                value={emailStats ? `${responseRate}%` : "—"}
                icon={<Mail size={20} />}
              />
            </div>
          </>
        )}
      </div>

      <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">Agent Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.keys(agentMeta).map((key) => (
            <AgentCard key={key} agent={key} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">Activity Feed</h2>
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
            {activityFeed.length === 0 && (
              <p className="text-ink-500 text-sm text-center py-8">Waiting for activity...</p>
            )}
            {activityFeed.slice(0, 100).map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <div className="p-1.5 rounded-md bg-ink-700 mt-0.5 shrink-0">
                  <EventIcon type={event.type} className="text-ink-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-300 truncate">{event.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {event.platform && (
                      <span className="text-[10px] text-ink-500 uppercase">{event.platform}</span>
                    )}
                    <span className="text-[10px] text-ink-500">{formatTimeAgo(event.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">Platform Health</h2>
          <div className="space-y-3">
            {displayPlatforms.map((platform) => {
              const pCfg = configPlatforms?.[platform];
              const connected = pCfg?.cookie_valid ?? pCfg?.enabled ?? false;
              return (
                <div
                  key={platform}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-ink-800"
                >
                  <span className="text-sm font-medium capitalize">{platform}</span>
                  {connected ? (
                    <div className="flex items-center gap-1.5 text-green-400">
                      <Check size={14} />
                      <span className="text-xs">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-ink-500">
                      <Minus size={14} />
                      <span className="text-xs">Disabled</span>
                    </div>
                  )}
                </div>
              );
            })}
            {(!config && !configPlatforms) && (
              <p className="text-ink-500 text-sm text-center py-4">Loading platform status...</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "0.25s" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider">Recent Applications</h2>
          <Link to="/applications" className="text-xs text-accent hover:underline">View all</Link>
        </div>
        {appsLoading ? (
          <TableSkeleton rows={5} />
        ) : (
          <div className="space-y-1">
            {recentApps?.items.slice(0, 5).map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{app.title}</p>
                  <p className="text-xs text-ink-400">{app.company}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge
                    variant={
                      app.status === "APPLIED"
                        ? "success"
                        : app.status === "PENDING_REVIEW"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {app.status.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-ink-500 w-14 text-right">
                    {formatTimeAgo(app.created_at)}
                  </span>
                </div>
              </div>
            ))}
            {(!recentApps?.items || recentApps.items.length === 0) && (
              <p className="text-ink-500 text-sm text-center py-6">No applications yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
