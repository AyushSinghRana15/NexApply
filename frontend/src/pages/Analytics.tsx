import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useStatsTimeline, useStatsPlatforms, useStatsSummary } from "@/hooks/useQueries";
import { StatCard } from "@/components/ui";
import { BarChart3, Globe, TrendingUp } from "lucide-react";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];

export function Analytics() {
  const { data: timeline } = useStatsTimeline();
  const { data: platforms } = useStatsPlatforms();
  const { data: stats } = useStatsSummary();

  const chartData = timeline?.days.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    Applied: d.applied,
    Skipped: d.skipped,
  }));

  const platformData = platforms?.platforms.map((p) => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    value: p.total,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-dark-400 text-sm mt-1">Detailed pipeline statistics and trends</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Applied" value={stats?.total_applied ?? 0} icon={<BarChart3 size={20} />} />
        <StatCard label="Avg Match Score" value={stats ? `${stats.avg_match_score}%` : "-"} icon={<TrendingUp size={20} />} />
        <StatCard label="Platforms Active" value={platforms?.platforms.length ?? 0} icon={<Globe size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-4">Daily Trend</h2>
          {chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Legend />
                <Bar dataKey="Applied" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Skipped" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-dark-500 text-sm text-center py-12">No data yet</p>
          )}
        </div>

        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-4">Platform Distribution</h2>
          {platformData && platformData.length > 0 ? (
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
                  {platformData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-dark-500 text-sm text-center py-12">No data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
