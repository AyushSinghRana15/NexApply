import { useStatsSummary, useStatsTimeline, useStatsPlatforms } from "@/hooks/useQueries";
import { CardSkeleton } from "@/components/common";
import { cn } from "@/lib/utils";
import { BarChart3, CheckCircle, Clock, XCircle } from "lucide-react";
import type { PlatformBreakdown, TimelinePoint } from "@/types";

function StatBox({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4 soft-shadow hover-lift transition-smooth">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
        <div className={cn("p-2 rounded-xl", color)}>{icon}</div>
      </div>
      <p className="text-2xl font-bold mt-3 tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PlatformChart({ data }: { data: PlatformBreakdown[] }) {
  const maxCount = Math.max(...data.map((d) => d.total), 1);
  const colors = ["bg-blue-400", "bg-green-400", "bg-purple-400", "bg-amber-400", "bg-pink-400"];
  return (
    <div className="space-y-3">
      {data.map((p, i) => (
        <div key={p.platform}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium capitalize">{p.platform}</span>
            <span className="text-xs text-text-muted tabular-nums">{p.total}</span>
          </div>
          <MiniBar value={p.total} max={maxCount} color={colors[i % colors.length]} />
        </div>
      ))}
    </div>
  );
}

export function Analytics() {
  const { data: stats, isLoading: statsLoading } = useStatsSummary();
  const { data: timelineData } = useStatsTimeline();
  const { data: platformsData } = useStatsPlatforms();

  const timeline: TimelinePoint[] = timelineData?.days ?? [];
  const platforms: PlatformBreakdown[] = platformsData?.platforms ?? [];

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <StatBox label="Applied" value={stats?.total_applied ?? 0} icon={<CheckCircle size={16} />} color="bg-green-100 text-green-600" />
          <StatBox label="Skipped" value={stats?.total_skipped ?? 0} icon={<XCircle size={16} />} color="bg-red-100 text-red-600" />
          <StatBox label="Pending" value={stats?.total_pending ?? 0} icon={<Clock size={16} />} color="bg-amber-100 text-amber-600" />
          <StatBox label="Avg Score" value={`${stats?.avg_match_score ?? 0}%`} icon={<BarChart3 size={16} />} color="bg-blue-100 text-blue-600" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-5 soft-shadow animate-fade-in">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Platforms</h3>
          {platforms.length > 0 ? <PlatformChart data={platforms} /> : <div className="text-sm text-text-muted">No data</div>}
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 soft-shadow animate-fade-in">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Last 7 Days</h3>
          {timeline.length > 0 ? (
            <div className="space-y-1">
              {timeline.map((d: TimelinePoint) => (
                <div key={d.date} className="flex items-center justify-between text-sm py-1 border-b border-border-light last:border-0">
                  <span className="text-text-muted font-medium">{d.date}</span>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="text-green-600">{d.applied}</span>
                    <span className="text-red-500">{d.skipped}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No timeline data</p>
          )}
        </div>
      </div>
    </div>
  );
}
