import { useState } from "react";
import { useApplications } from "@/hooks/useQueries";
import { Badge, Button, ScoreBar } from "@/components/ui";
import { formatTimeAgo } from "@/lib/utils";

export function Applications() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data } = useApplications({ page, status: statusFilter });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-dark-400 text-sm mt-1">All applications processed by the pipeline</p>
        </div>
        <div className="flex gap-2">
          {["ALL", "APPLIED", "SKIPPED", "PENDING_REVIEW", "TIMEOUT"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === "ALL" ? undefined : s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                (s === "ALL" && !statusFilter) || statusFilter === s
                  ? "bg-accent text-white"
                  : "bg-surface text-dark-400 hover:text-text-primary"
              }`}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-dark-800 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-dark-400">Job</th>
              <th className="text-left px-4 py-3 font-medium text-dark-400">Company</th>
              <th className="text-left px-4 py-3 font-medium text-dark-400">Platform</th>
              <th className="text-left px-4 py-3 font-medium text-dark-400">Score</th>
              <th className="text-left px-4 py-3 font-medium text-dark-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-dark-400">Keywords</th>
              <th className="text-left px-4 py-3 font-medium text-dark-400">Time</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((app) => (
              <tr key={app.id} className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
                <td className="px-4 py-3 font-medium">{app.title}</td>
                <td className="px-4 py-3">{app.company}</td>
                <td className="px-4 py-3 capitalize">{app.platform}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ScoreBar score={app.match_score} size="sm" />
                    <span className="text-xs text-dark-400">{app.match_score}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {app.keywords_injected.slice(0, 3).map((kw) => (
                      <Badge key={kw}>{kw}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-dark-500 text-xs">
                  {formatTimeAgo(app.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 20 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">
            {data.total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page * 20 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
