import { useState, useEffect } from "react";
import { Search, Briefcase, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useApplications } from "@/hooks/useQueries";
import { Button, Badge } from "@/components/ui";
import { TableSkeleton } from "@/components/common";
import { formatTimeAgo } from "@/lib/utils";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  APPLIED: <CheckCircle size={13} className="text-green-500" />,
  PENDING_REVIEW: <Clock size={13} className="text-amber-500" />,
  FAILED: <XCircle size={13} className="text-red-500" />,
  ERROR: <AlertCircle size={13} className="text-red-400" />,
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  APPLIED: "success",
  PENDING_REVIEW: "warning",
  FAILED: "danger",
  ERROR: "danger",
};

export function Applications() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;
  const debouncedSearch = useDebouncedValue(search, 400);

  const { data, isLoading, isError, error } = useApplications({
    page,
    per_page: perPage,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasMore = page < totalPages;
  const hasPrev = page > 1;

  return (
    <div className="space-y-4 max-w-[1100px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search applications..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors outline-none"
          />
        </div>
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          {[
            { value: "", label: "All" },
            { value: "APPLIED", label: "Applied" },
            { value: "PENDING_REVIEW", label: "Pending" },
            { value: "FAILED", label: "Failed" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === opt.value ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden soft-shadow">
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-red-500">
              {(error as Error)?.message?.includes("503")
                ? "Backend unavailable"
                : "Failed to load"}
            </p>
            <p className="text-xs text-text-muted mt-1">Retrying in the background...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light bg-surface">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Company</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Title</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Platform</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Score</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((app) => (
                    <tr key={app.id} className="border-b border-border-light last:border-0 hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3 font-medium">{app.company}</td>
                      <td className="px-4 py-3 text-text-secondary truncate max-w-[200px]">{app.title}</td>
                      <td className="px-4 py-3">
                        <Badge variant="default">{app.platform}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {STATUS_ICONS[app.status]}
                          <Badge variant={STATUS_VARIANT[app.status] ?? "default"}>
                            {app.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{app.match_score ?? "---"}</td>
                      <td className="px-4 py-3 text-right text-text-muted text-xs tabular-nums">
                        {formatTimeAgo(app.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {items.length === 0 && (
              <div className="text-center py-12">
                <Briefcase size={32} className="text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-muted">
                  {search || statusFilter ? "No matching applications" : "No applications yet"}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between px-4 py-3 border-t border-border-light bg-surface/50">
              <span className="text-xs text-text-muted">
                {total} result{total !== 1 && "s"} &middot; page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => p - 1)} disabled={!hasPrev}>
                  Previous
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
