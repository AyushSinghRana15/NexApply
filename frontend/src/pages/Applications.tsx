import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Filter, Download, ChevronLeft, ChevronRight,
  ExternalLink, X, Eye, Clock, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { Badge, Button, ScoreBar } from "@/components/ui";
import { cn, formatTimeAgo, formatDate } from "@/lib/utils";
import { fetchApplications, fetchEmailHistory } from "@/api/client";
import { useApplication } from "@/hooks/useQueries";
import { TableSkeleton, EmptyState } from "@/components/common";
import type { Application } from "@/types";

const PER_PAGE = 25;

const PLATFORMS = ["all", "indeed", "naukri", "glassdoor", "foundit", "internshala"] as const;
const STATUSES = ["all", "APPLIED", "SKIPPED", "TIMEOUT", "FAILED", "PENDING_REVIEW"] as const;
const DATE_RANGES = [
  { label: "Last 7d", value: "7d" },
  { label: "Last 30d", value: "30d" },
  { label: "All time", value: "all" },
] as const;

const STATUS_STYLES: Record<string, string> = {
  APPLIED: "bg-green-500/10 text-green-400",
  SKIPPED: "bg-gray-200 text-gray-500",
  TIMEOUT: "bg-yellow-500/10 text-yellow-400",
  FAILED: "bg-red-500/10 text-red-400",
  PENDING_REVIEW: "bg-blue-500/10 text-blue-400",
};

const EMAIL_STYLES: Record<string, { className: string; pulse?: boolean }> = {
  CONFIRMATION: { className: "bg-blue-500/10 text-blue-400" },
  INTERVIEW: { className: "bg-green-500/10 text-green-400", pulse: true },
  REJECTION: { className: "bg-red-500/10 text-red-400" },
  FOLLOW_UP: { className: "bg-purple-500/10 text-purple-400" },
};

type SortField = "company" | "title" | "platform" | "match_score" | "status" | "created_at";
type SortDir = "asc" | "desc";

const SORTABLE_COLUMNS: { key: SortField; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "platform", label: "Platform" },
  { key: "match_score", label: "Score" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Time Ago" },
];

export function Applications() {
  const [page, setPage] = useState(1);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [minScore, setMinScore] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [emailHistory, setEmailHistory] = useState<unknown[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const queryParams = useMemo(() => {
    const p: Record<string, unknown> = { page, per_page: PER_PAGE };
    if (platformFilter !== "all") p.platform = platformFilter;
    if (statusFilter !== "all") p.status = statusFilter;
    if (dateRange !== "all") p.date_range = dateRange;
    if (minScore > 0) p.min_score = minScore;
    if (searchTerm.trim()) p.search = searchTerm.trim();
    return p;
  }, [page, platformFilter, statusFilter, dateRange, minScore, searchTerm]);

  const { data, isLoading } = useQuery({
    queryKey: ["applications", queryParams],
    queryFn: () => fetchApplications(queryParams as Record<string, unknown>),
    refetchInterval: 10_000,
  });

  const { data: selectedApp } = useApplication(selectedAppId ?? 0);

  useEffect(() => {
    if (!selectedAppId) {
      setEmailHistory([]);
      return;
    }
    fetchEmailHistory(selectedAppId)
      .then((res) => setEmailHistory(res.items ?? []))
      .catch(() => setEmailHistory([]));
  }, [selectedAppId]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pageStart = (page - 1) * PER_PAGE + 1;
  const pageEnd = Math.min(page * PER_PAGE, total);

  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    const sorted = [...data.items].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "company":
          cmp = a.company.localeCompare(b.company);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "platform":
          cmp = a.platform.localeCompare(b.platform);
          break;
        case "match_score":
          cmp = a.match_score - b.match_score;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "created_at":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data?.items, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleRowClick = (app: Application) => {
    setSelectedAppId((prev) => (prev === app.id ? null : app.id));
  };

  const emailStatusBadge = (app: Application) => {
    if (!app.email_status) return null;
    const style = EMAIL_STYLES[app.email_status];
    if (!style) return null;
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", style.className, style.pulse && "animate-pulse")}>
        {app.email_status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} />
            Filters
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open("/api/applications.jsonl")}>
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Platform:</span>
              <div className="flex gap-1">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPlatformFilter(p); setPage(1); }}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg font-medium transition-colors capitalize",
                      platformFilter === p
                        ? "bg-accent text-white"
                        : "bg-gray-100 text-gray-500 hover:text-text-primary"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Status:</span>
              <div className="flex gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg font-medium transition-colors",
                      statusFilter === s
                        ? "bg-accent text-white"
                        : "bg-gray-100 text-gray-500 hover:text-text-primary"
                    )}
                  >
                    {s === "all" ? "All" : s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Date:</span>
              <div className="flex gap-1">
                {DATE_RANGES.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => { setDateRange(d.value); setPage(1); }}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg font-medium transition-colors",
                      dateRange === d.value
                        ? "bg-accent text-white"
                        : "bg-gray-100 text-gray-500 hover:text-text-primary"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Min Score: {minScore}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => { setMinScore(Number(e.target.value)); setPage(1); }}
                className="w-32 accent-accent"
              />
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search company..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-100 border border-border rounded-lg text-text-primary placeholder:text-gray-400 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : sortedItems.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No applications found"
          description="Try adjusting your filters or wait for new jobs to be detected."
        />
      ) : (
        <div className="flex gap-0">
          <div className="flex-1 min-w-0 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-border">
                  {SORTABLE_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-text-primary transition-colors select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortField === col.key && (
                          <span className="text-[10px]">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Time Ago</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => handleRowClick(app)}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors cursor-pointer",
                      selectedAppId === app.id ? "bg-accent/5" : "hover:bg-surface-hover"
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{app.company}</td>
                    <td className="px-4 py-3 text-gray-600">{app.title}</td>
                    <td className="px-4 py-3">
                      <Badge>{app.platform}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ScoreBar score={app.match_score} size="sm" />
                        <span className="text-xs text-gray-500 w-8">{app.match_score}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", STATUS_STYLES[app.status] ?? "bg-gray-200 text-gray-500")}>
                        {app.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {emailStatusBadge(app)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatTimeAgo(app.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedAppId && selectedApp && (
            <div className="fixed right-0 top-0 h-full w-96 z-50 bg-surface border-l border-border shadow-2xl translate-x-0 transition-transform overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-sm font-semibold">Application Details</h3>
                <button
                  onClick={() => setSelectedAppId(null)}
                  className="p-1.5 rounded-lg hover:bg-surface-hover text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div>
                  <h2 className="text-lg font-bold">{selectedApp.title}</h2>
                  <p className="text-gray-500 mt-0.5">{selectedApp.company}</p>
                  {selectedApp.location && (
                    <p className="text-xs text-gray-400 mt-0.5">{selectedApp.location}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge>{selectedApp.platform}</Badge>
                  <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", STATUS_STYLES[selectedApp.status])}>
                    {selectedApp.status.replace("_", " ")}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1">Match Score</p>
                  <ScoreBar score={selectedApp.match_score} size="lg" />
                  <p className="text-right text-sm font-medium mt-1">{selectedApp.match_score}%</p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-2">Keywords Injected</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedApp.keywords_injected.map((kw) => (
                      <Badge key={kw} variant="success">{kw}</Badge>
                    ))}
                  </div>
                </div>

                {selectedApp.screenshot_path && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Screenshot</p>
                    <a
                      href={`/screenshots/${selectedApp.screenshot_path.split("/").pop()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={`/screenshots/${selectedApp.screenshot_path.split("/").pop()}`}
                        alt="Application screenshot"
                        className="rounded-lg border border-border w-full max-h-40 object-cover bg-gray-100 hover:opacity-80 transition-opacity"
                      />
                    </a>
                  </div>
                )}

                {selectedApp.apply_url && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Apply URL</p>
                    <a
                      href={selectedApp.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                    >
                      <ExternalLink size={14} />
                      Open application page
                    </a>
                  </div>
                )}

                {selectedApp.time_to_decide_seconds != null && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Time to Decide</p>
                    <div className="flex items-center gap-2 text-sm text-text-primary">
                      <Clock size={14} className="text-gray-500" />
                      {selectedApp.time_to_decide_seconds < 60
                        ? `${selectedApp.time_to_decide_seconds}s`
                        : `${Math.floor(selectedApp.time_to_decide_seconds / 60)}m ${selectedApp.time_to_decide_seconds % 60}s`}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-400 mb-1">Tailored Resume</p>
                  <pre className="text-xs text-gray-600 bg-gray-100 rounded-lg p-3 max-h-60 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                    {selectedApp.tailored_resume ?? "No resume data available"}
                  </pre>
                </div>

                {emailHistory.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Email History</p>
                    <div className="space-y-2">
                      {emailHistory.map((entry: Record<string, unknown>, i) => (
                        <div key={i} className="bg-gray-100 rounded-lg p-3 text-xs space-y-1">
                          {entry.subject && <p className="font-medium text-text-primary">{entry.subject as string}</p>}
                          {entry.received_at && <p className="text-gray-400">{formatDate(entry.received_at as string)}</p>}
                          {entry.type && (
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", EMAIL_STYLES[entry.type as string]?.className ?? "bg-gray-200 text-gray-500")}>
                              {entry.type as string}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-gray-400">
                  Created: {formatDate(selectedApp.created_at)}
                  {selectedApp.decided_at && <> &middot; Decided: {formatDate(selectedApp.decided_at)}</>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {total > PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {total === 0 ? 0 : pageStart}&ndash;{Math.min(pageEnd, total)} of {total} total
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
