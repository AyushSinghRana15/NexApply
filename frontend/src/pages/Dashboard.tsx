import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useStatsSummary, useStatsTimeline, useStatsPlatforms, useApplications } from "@/hooks/useQueries";
import { useWSStore } from "@/stores/useWSStore";
import { StatCard, Badge, ScoreBar } from "@/components/ui";
import { LayoutDashboard, Send, Clock, AlertTriangle, BarChart3 } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";

export function Dashboard() {
  const { data: stats } = useStatsSummary();
  const { data: timeline } = useStatsTimeline();
  const { data: platforms } = useStatsPlatforms();
  const { data: recentApps } = useApplications({ page: 1, status: undefined });
  const pendingCount = useWSStore((s) => s.pendingReviews.length);

  const latestDays = useMemo(() => {
    if (!timeline?.days) return [];
    return [...timeline.days].reverse().slice(0, 7).reverse();
  }, [timeline]);

  const maxCount = useMemo(
    () => Math.max(...latestDays.map((d) => d.applied + d.skipped), 1),
    [latestDays]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-dark-400 text-sm mt-1">NexApply agent pipeline overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Applied" value={stats?.total_applied ?? 0} icon={<Send size={20} />} />
        <StatCard label="Pending Review" value={pendingCount + (stats?.total_pending ?? 0)} icon={<Clock size={20} />} />
        <StatCard label="Skipped" value={stats?.total_skipped ?? 0} icon={<AlertTriangle size={20} />} />
        <StatCard label="Avg Score" value={stats ? `${stats.avg_match_score}%` : "-"} icon={<BarChart3 size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-4">Last 7 Days</h2>
          <div className="flex items-end gap-2 h-32">
            {latestDays.map((day) => {
              const total = day.applied + day.skipped;
              const height = total > 0 ? (total / maxCount) * 100 : 4;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col-reverse" style={{ height: `${Math.max(height, 4)}%` }}>
                    <div
                      className="w-full bg-green-500/80 rounded-t"
                      style={{ height: `${(day.applied / Math.max(total, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-dark-500">
                    {new Date(day.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-4">By Platform</h2>
          <div className="space-y-3">
            {platforms?.platforms.map((p) => (
              <div key={p.platform} className="flex items-center justify-between">
                <span className="text-sm capitalize">{p.platform}</span>
                <div className="flex items-center gap-3 text-xs text-dark-400">
                  <span className="text-green-400">{p.applied} applied</span>
                  <span>{p.skipped} skipped</span>
                </div>
              </div>
            ))}
            {(!platforms?.platforms || platforms.platforms.length === 0) && (
              <p className="text-dark-500 text-sm">No data yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-dark-400 uppercase tracking-wider">Recent Applications</h2>
          <Link to="/applications" className="text-xs text-accent hover:underline">View all</Link>
        </div>
        <div className="space-y-3">
          {recentApps?.items.slice(0, 5).map((app) => (
            <div key={app.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{app.title}</p>
                <p className="text-xs text-dark-400">{app.company} &middot; {app.platform}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-dark-500">{formatTimeAgo(app.created_at)}</span>
                <Badge variant={app.status === "APPLIED" ? "success" : app.status === "PENDING_REVIEW" ? "warning" : "danger"}>
                  {app.status.replace("_", " ")}
                </Badge>
              </div>
            </div>
          ))}
          {(!recentApps?.items || recentApps.items.length === 0) && (
            <p className="text-dark-500 text-sm text-center py-4">No applications yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
