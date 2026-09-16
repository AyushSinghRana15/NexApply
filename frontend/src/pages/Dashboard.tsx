import { useMemo, useEffect } from "react";
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
  Activity, Check, Minus, ArrowRight
} from "lucide-react";
import { formatTimeAgo, cn } from "@/lib/utils";
import { fetchEmailTrackingStats, fetchCookieStatus, fetchHealth } from "@/api/client";

const agentMeta: Record<string, { name: string; role: string; icon: typeof Search; color: string }> = {
  radar: { name: "Radar", role: "Job Discovery", icon: Search, color: "text-blue-500 bg-blue-50" },
  tailor: { name: "Tailor", role: "Resume AI", icon: Brain, color: "text-purple-500 bg-purple-50" },
  fleet: { name: "Fleet", role: "Auto-Apply", icon: Globe, color: "text-green-500 bg-green-50" },
  guard: { name: "Guard", role: "Review Gate", icon: Shield, color: "text-amber-500 bg-amber-50" },
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
  return <Icon size={14} className={className} />;
}

function AgentCard({ agent }: { agent: string }) {
  const info = useWSStore((s) => s.agents[agent]);
  const meta = agentMeta[agent];
  if (!meta) return null;

  const isOnline = info?.status === "online";
  const isError = info?.status === "error";

  return (
    <div className="bg-white rounded-2xl border border-border p-4 soft-shadow hover-lift transition-smooth">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl", meta.color)}>
            <meta.icon size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold">{meta.name}</p>
            <p className="text-xs text-text-muted">{meta.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "w-2 h-2 rounded-full",
            isOnline ? "bg-green-500" : isError ? "bg-amber-500" : "bg-gray-300"
          )} />
          <span className={cn(
            "text-xs font-medium",
            isOnline ? "text-green-600" : isError ? "text-amber-600" : "text-text-muted"
          )}>
            {isOnline ? "Online" : isError ? "Error" : "Offline"}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted mt-3 pt-3 border-t border-border-light">
        <span>{info?.jobs_today ?? 0} jobs today</span>
        <span>{info?.last_active ? formatTimeAgo(info.last_active) : "---"}</span>
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
  const { pendingReviews, activityFeed, isConnected, setAgentStatus } = useWSStore();
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const agents = (health?.agents ?? {}) as Record<string, { state?: string; queue_size?: number; processed?: number; started_at?: string }>;
    const worker = agents.graph_worker;
    const radar = agents.radar;
    if (radar) {
      setAgentStatus("radar", radar.state === "online" ? "online" : "offline", radar.queue_size ?? 0, radar.started_at);
    }
    const pipelineState = worker?.state === "online" ? "online" : "offline";
    const processed = worker?.processed ?? 0;
    for (const agent of ["tailor", "fleet", "guard"] as const) {
      setAgentStatus(agent, pipelineState, processed, worker?.started_at);
    }
  }, [health, setAgentStatus]);

  const { data: cookieStatus } = useQuery({
    queryKey: ["cookies/status"],
    queryFn: fetchCookieStatus,
    refetchInterval: 30_000,
  });

  const configPlatforms = useMemo(() => {
    if (!config?.platforms) return null;
    return config.platforms as Record<string, boolean>;
  }, [config]);

  const displayPlatforms = ["indeed", "naukri", "glassdoor", "foundit", "internshala"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">Pipeline overview</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-400")} />
          <span className="text-xs font-medium text-text-secondary">{isConnected ? "Live" : "Offline"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {statsLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </>
        ) : (
          <>
            <StatCard label="Applied" value={stats?.total_applied ?? 0} icon={<Send size={18} />} variant="green" />
            <StatCard label="Pending" value={(stats?.total_pending ?? 0) + pendingReviews.length} icon={<Clock size={18} />} variant="yellow" />
            <StatCard label="Avg Score" value={stats ? `${stats.avg_match_score}%` : "---"} icon={<BarChart3 size={18} />} variant="blue" />
            <StatCard label="Responses" value={emailStats ? `${emailStats.response_rate ?? 0}%` : "---"} icon={<Mail size={18} />} variant="orange" />
          </>
        )}
      </div>

      <div className="animate-fade-in">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Agents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          {Object.keys(agentMeta).map((key) => (
            <AgentCard key={key} agent={key} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-5 soft-shadow animate-fade-in">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Activity</h2>
          <div className="space-y-0 max-h-[360px] overflow-y-auto">
            {activityFeed.length === 0 && (
              <p className="text-text-muted text-sm text-center py-8">Waiting for activity...</p>
            )}
            {activityFeed.slice(0, 50).map((event, i) => (
              <div
                key={event.id}
                className="flex items-start gap-3 py-3 px-1 border-b border-border-light last:border-0 transition-colors hover:bg-surface-hover rounded-lg"
              >
                <div className={cn(
                  "p-1.5 rounded-lg shrink-0 mt-0.5",
                  i % 4 === 0 ? "bg-blue-50 text-blue-500"
                    : i % 4 === 1 ? "bg-green-50 text-green-500"
                      : i % 4 === 2 ? "bg-amber-50 text-amber-500"
                        : "bg-purple-50 text-purple-500"
                )}>
                  <EventIcon type={event.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{event.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {event.platform && (
                      <span className="text-[10px] font-semibold text-text-muted uppercase">{event.platform}</span>
                    )}
                    <span className="text-[10px] text-text-muted">{formatTimeAgo(event.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 soft-shadow animate-fade-in">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Platforms</h2>
          <div className="space-y-0">
            {displayPlatforms.map((platform) => {
              const enabled = configPlatforms?.[platform] === true;
              const session = cookieStatus?.platforms?.[platform];
              const ready = enabled && Boolean(session?.loaded);
              return (
                <div
                  key={platform}
                  className="flex items-center justify-between py-3 px-1 border-b border-border-light last:border-0"
                >
                  <span className="text-sm font-medium capitalize">{platform}</span>
                  {ready ? (
                    <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                      <Check size={14} />
                      Ready
                    </div>
                  ) : enabled ? (
                    <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                      <Clock size={14} />
                      Needs cookies
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-text-muted text-xs font-medium">
                      <Minus size={14} />
                      Disabled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5 soft-shadow animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent Applications</h2>
          <Link to="/applications" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {appsLoading ? (
          <TableSkeleton rows={5} />
        ) : (
          <div className="space-y-0">
            {recentApps?.items.slice(0, 5).map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between py-3 px-1 border-b border-border-light last:border-0 transition-colors hover:bg-surface-hover rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{app.title}</p>
                  <p className="text-xs text-text-muted">{app.company}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge
                    variant={
                      app.status === "APPLIED" ? "success"
                        : app.status === "PENDING_REVIEW" ? "pending"
                          : "danger"
                    }
                  >
                    {app.status.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-text-muted w-14 text-right">
                    {formatTimeAgo(app.created_at)}
                  </span>
                </div>
              </div>
            ))}
            {(!recentApps?.items || recentApps.items.length === 0) && (
              <p className="text-text-muted text-sm text-center py-8">No applications yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
