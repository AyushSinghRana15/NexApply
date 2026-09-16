import { useEffect, useState, useCallback, useMemo } from "react";
import { Check, X, Edit3, ArrowLeft, ArrowRight, FileText, Image } from "lucide-react";
import { useWSStore } from "@/stores/useWSStore";
import { Button, Badge, ScoreBar } from "@/components/ui";
import { useResumes } from "@/hooks/useQueries";
import { useToast } from "@/stores/toast";
import { matchScoreColor, cn } from "@/lib/utils";
import type { ReviewPayload } from "@/types";

const TIMEOUT_SECONDS = 300;

function CountdownBar({ timeLeft, total }: { timeLeft: number; total: number }) {
  const fraction = total > 0 ? timeLeft / total : 0;
  const isUrgent = timeLeft <= 60;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            isUrgent ? "bg-red-400" : "bg-accent"
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span className={cn(
        "text-xs font-medium tabular-nums shrink-0 w-20 text-right",
        isUrgent ? "text-red-500" : "text-text-muted"
      )}>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}

function ReviewCard({
  review,
  serverCountdown,
  submitting,
  onAction,
}: {
  review: ReviewPayload;
  serverCountdown?: number;
  submitting: string | null;
  onAction: (action: string) => void;
}) {
  const { data: resumesData } = useResumes();
  const [localCountdown, setLocalCountdown] = useState(TIMEOUT_SECONDS);
  const [tab, setTab] = useState<"screenshot" | "resume">("screenshot");

  const countdown = serverCountdown ?? localCountdown;

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentResume = useMemo(() => {
    if (!resumesData?.items) return null;
    return resumesData.items.find((r) => r.name === review.resume_variant);
  }, [resumesData, review.resume_variant]);

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden soft-shadow animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-border">
        <div className="lg:col-span-3 p-6 space-y-4">
          <Badge>{review.platform}</Badge>

          <div>
            <h2 className="text-xl font-bold leading-tight">{review.title}</h2>
            <p className="text-text-secondary mt-1">
              {review.company}
              {review.location && <span className="text-text-muted"> &middot; {review.location}</span>}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Match Score</span>
              <span className={cn("text-sm font-semibold", matchScoreColor(review.match_score))}>
                {review.match_score}%
              </span>
            </div>
            <ScoreBar score={review.match_score} size="lg" />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(review.keywords_injected ?? []).map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-text-secondary"
              >
                {kw}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{review.resume_variant}</Badge>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <div className="flex border-b border-border">
            {(["screenshot", "resume"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  tab === t
                    ? "text-accent border-b-2 border-accent"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {t === "screenshot" ? <Image size={14} /> : <FileText size={14} />}
                {t === "screenshot" ? "Screenshot" : "Resume"}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-[300px] max-h-[500px] overflow-auto p-4">
            {tab === "screenshot" ? (
              review.screenshot_path ? (
                <a
                  href={`/screenshots/${review.screenshot_path.split("/").pop()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={`/screenshots/${review.screenshot_path.split("/").pop()}`}
                    alt="Form screenshot"
                    className="rounded-xl border border-border w-full object-cover bg-gray-100 hover:opacity-90 transition-opacity"
                  />
                </a>
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  No screenshot
                </div>
              )
            ) : (
              <pre className="text-sm text-text-secondary font-mono whitespace-pre-wrap leading-relaxed">
                {currentResume?.content ?? `Resume: ${review.resume_variant}\nKeywords: ${(review.keywords_injected ?? []).join(", ")}\nScore: ${review.match_score}%`}
              </pre>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAction("PREV")}
              className="p-2 rounded-xl hover:bg-surface-hover text-text-muted disabled:opacity-30 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-xs text-text-muted tabular-nums min-w-[3rem] text-center"></span>
            <button
              onClick={() => onAction("NEXT")}
              className="p-2 rounded-xl hover:bg-surface-hover text-text-muted disabled:opacity-30 transition-colors"
            >
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={() => onAction("SKIP")} disabled={!!submitting}>
              <X size={14} /> Skip (S)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onAction("EDIT")} disabled={!!submitting}>
              <Edit3 size={14} /> Edit (E)
            </Button>
            <Button variant="primary" size="sm" onClick={() => onAction("APPROVE")} disabled={!!submitting}>
              <Check size={14} /> Approve (A)
            </Button>
          </div>
        </div>
        <CountdownBar timeLeft={countdown} total={TIMEOUT_SECONDS} />
      </div>
    </div>
  );
}

export function Review() {
  const { pendingReviews, removeReview, countdowns, sendDecision } = useWSStore();
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const safeIndex = pendingReviews.length === 0 ? -1 : Math.min(index, pendingReviews.length - 1);
  const current = safeIndex >= 0 ? pendingReviews[safeIndex] : undefined;
  const queueRemaining = pendingReviews.length - safeIndex - 1;

  const handleAction = useCallback(async (action: string) => {
    if (!current || submitting) return;
    if (action === "PREV" || action === "NEXT") {
      setIndex((i) =>
        action === "PREV" ? Math.max(0, i - 1) : Math.min(pendingReviews.length - 1, i + 1)
      );
      return;
    }
    setSubmitting(action);
    try {
      const ok = sendDecision(current.job_id, action);
      if (ok) {
        useToast.getState().add(
          action === "APPROVE" ? "success" : action === "SKIP" ? "error" : "info",
          action === "APPROVE" ? "Approved & submitted" : action === "SKIP" ? "Skipped" : "Marked for edit"
        );
        removeReview(current.job_id);
        setIndex((i) => Math.min(i, Math.max(0, pendingReviews.length - 2)));
      } else {
        useToast.getState().add("error", "Not connected — decision not sent");
      }
    } catch { useToast.getState().add("error", "Failed to submit"); }
    setSubmitting(null);
  }, [current, submitting, pendingReviews.length, sendDecision, removeReview]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "a" || e.key === "A") handleAction("APPROVE");
      if (e.key === "s" || e.key === "S") handleAction("SKIP");
      if (e.key === "e" || e.key === "E") handleAction("EDIT");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAction]);

  if (pendingReviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center animate-fade-in">
        <div className="relative mb-6">
          <div className="w-4 h-4 bg-green-500 rounded-full animate-ping absolute inset-0" />
          <div className="w-4 h-4 bg-green-500 rounded-full relative" />
        </div>
        <h2 className="text-lg font-semibold">Watching for jobs...</h2>
        <p className="text-text-secondary text-sm mt-2 max-w-sm">
          Reviews will appear here as forms are filled
        </p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <p className="text-text-muted text-sm">No review selected</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Review</h1>
          <Badge variant="warning">{pendingReviews.length} pending</Badge>
          {queueRemaining > 0 && (
            <span className="text-sm text-text-muted">{queueRemaining} more</span>
          )}
        </div>
        <span className="text-xs text-text-muted tabular-nums">
          {safeIndex + 1}/{pendingReviews.length}
        </span>
      </div>

      <ReviewCard
        key={current.job_id}
        review={current}
        serverCountdown={countdowns[current.job_id]}
        submitting={submitting}
        onAction={handleAction}
      />
    </div>
  );
}