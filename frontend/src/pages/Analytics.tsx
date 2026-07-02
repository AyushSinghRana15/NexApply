import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";
import { TrendingUp, Send, Clock, Zap } from "lucide-react";
import { useStatsSummary, useStatsTimeline, useStatsPlatforms } from "@/hooks/useQueries";
import { fetchApplications } from "@/api/client";
import { StatCard } from "@/components/ui";

const PLATFORM_COLORS: Record<string, string> = {
  Indeed: "#c04a4a",
  Naukri: "#ef4444",
  Glassdoor: "#4a8c5c",
  Foundit: "#f97316",
  Internshala: "#14b8a6",
};

const SCORE_COLORS = ["#ef4444", "#f97316", "#eab308", "#4a8c5c", "#16a34a"];

const TOOLTIP_STYLE = {
  background: "#1c1814",
  border: "1px solid #2c241e",
  borderRadius: "8px",
  fontSize: "13px",
  outline: "none",
};

function CustomPieLabel({ cx, cy }: { cx: number; cy: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="fill-text-primary">
      <tspan x={cx} dy="-0.5em" className="text-2xl font-bold" />
    </text>
  );
}

export function Analytics() {
  const { data: stats } = useStatsSummary();
  const { data: timeline } = useStatsTimeline();
  const { data: platforms } = useStatsPlatforms();

  const { data: appsData } = useQuery({
    queryKey: ["applications", "analytics"],
    queryFn: () => fetchApplications({ per_page: 500 }),
    refetchInterval: 30_000,
  });

  const apps = appsData?.items ?? [];

  const acceptanceRate = useMemo(() => {
    if (!stats) return 0;
    const total = stats.total_applied + stats.total_skipped + stats.total_pending + stats.total_timeout;
    if (total === 0) return 0;
    return Math.round((stats.total_applied / total) * 100);
  }, [stats]);

  const fastestDecision = useMemo(() => {
    if (apps.length === 0) return null;
    const times = apps
      .filter((a) => a.time_to_decide_seconds != null && a.status === "APPLIED")
      .map((a) => a.time_to_decide_seconds);
    if (times.length === 0) return null;
    return Math.min(...times);
  }, [apps]);

  const timelineData = useMemo(() => {
    if (!timeline?.days) return [];
    return timeline.days.map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      Applied: d.applied,
      Skipped: d.skipped,
    }));
  }, [timeline]);

  const platformData = useMemo(() => {
    if (!platforms?.platforms) return [];
    return platforms.platforms.map((p) => ({
      name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      value: p.total,
    }));
  }, [platforms]);

  const totalPlatformCount = useMemo(
    () => platformData.reduce((sum, p) => sum + p.value, 0),
    [platformData]
  );

  const scoreBuckets = useMemo(() => {
    const buckets = [
      { range: "0-20", min: 0, max: 20, count: 0, color: SCORE_COLORS[0] },
      { range: "20-40", min: 20, max: 40, count: 0, color: SCORE_COLORS[1] },
      { range: "40-60", min: 40, max: 60, count: 0, color: SCORE_COLORS[2] },
      { range: "60-80", min: 60, max: 80, count: 0, color: SCORE_COLORS[3] },
      { range: "80-100", min: 80, max: 100, count: 0, color: SCORE_COLORS[4] },
    ];
    for (const app of apps) {
      const score = app.match_score;
      for (const b of buckets) {
        if (score >= b.min && score < b.max) {
          b.count++;
          break;
        }
        if (score === 100 && b.max === 100) {
          b.count++;
          break;
        }
      }
    }
    return buckets;
  }, [apps]);

  const decisionSpeedData = useMemo(() => {
    const dayMap = new Map<string, number[]>();
    for (const app of apps) {
      if (app.time_to_decide_seconds == null || app.status !== "APPLIED") continue;
      const day = app.created_at.slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(app.time_to_decide_seconds);
    }
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, times]) => ({
        date: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        avgSeconds: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      }));
  }, [apps]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-ink-400 text-sm mt-1">Detailed pipeline statistics and trends</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Applied" value={stats?.total_applied ?? 0} icon={<Send size={20} />} />
        <StatCard label="Avg Match Score" value={stats ? `${stats.avg_match_score}%` : "-"} icon={<TrendingUp size={20} />} />
        <StatCard label="Acceptance Rate" value={`${acceptanceRate}%`} icon={<Zap size={20} />} />
        <StatCard
          label="Fastest Decision"
          value={fastestDecision != null ? (fastestDecision < 60 ? `${fastestDecision}s` : `${Math.floor(fastestDecision / 60)}m ${fastestDecision % 60}s`) : "-"}
          icon={<Clock size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-4">Applications Timeline</h2>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3d342a" />
                <XAxis dataKey="date" stroke="#8a7c6a" fontSize={12} tickLine={false} />
                <YAxis stroke="#8a7c6a" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="Applied" fill="#4a8c5c" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="Skipped" fill="#5c5042" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-ink-500 text-sm text-center py-12">No data yet</p>
          )}
        </div>

        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-4">Platform Breakdown</h2>
          {platformData.length > 0 ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {platformData.map((entry) => (
                      <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] ?? "#8a7c6a"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                <p className="text-2xl font-bold text-text-primary">{totalPlatformCount}</p>
                <p className="text-[10px] text-ink-500">Total</p>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                {platformData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: PLATFORM_COLORS[entry.name] ?? "#8a7c6a" }}
                    />
                    <span className="text-ink-400">{entry.name}</span>
                    <span className="font-medium text-text-primary">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-ink-500 text-sm text-center py-12">No data yet</p>
          )}
        </div>

        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-4">Match Score Distribution</h2>
          {scoreBuckets.some((b) => b.count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3d342a" />
                <XAxis dataKey="range" stroke="#8a7c6a" fontSize={12} tickLine={false} />
                <YAxis stroke="#8a7c6a" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {scoreBuckets.map((entry) => (
                    <Cell key={entry.range} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-ink-500 text-sm text-center py-12">No data yet</p>
          )}
        </div>

        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-4">Decision Speed</h2>
          {decisionSpeedData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={decisionSpeedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3d342a" />
                <XAxis dataKey="date" stroke="#8a7c6a" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#8a7c6a"
                  fontSize={12}
                  tickLine={false}
                  label={{ value: "seconds", angle: -90, position: "insideLeft", fill: "#8a7c6a", fontSize: 11 }}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="avgSeconds"
                  stroke="#c04a4a"
                  strokeWidth={2}
                  dot={{ fill: "#c04a4a", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-ink-500 text-sm text-center py-12">No data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
