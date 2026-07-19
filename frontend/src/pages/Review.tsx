import { useEffect, useState, useCallback, useMemo } from "react";
import { Check, X, Edit3, ArrowLeft, ArrowRight, FileText, Image } from "lucide-react";
import { useWSStore } from "@/stores/useWSStore";
import { Button, Badge, ScoreBar } from "@/components/ui";
import { useResumes } from "@/hooks/useQueries";
import { submitDecision } from "@/api/client";
import { useToast } from "@/components/common/Toast";
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

export function Review() {
  const { pendingReviews, removeReview } = useWSStore();
  const { data: resumesData } = useResumes();
  const [index, setIndex] = useState(0);
  const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [tab, setTab] = useState<"screenshot" | "resume">("screenshot");

  const current = pendingReviews[index] as ReviewPayload | undefined;
  const queueRemaining = pendingReviews.length - index - 1;

  useEffect(() => {
    if (index >= pendingReviews.length && pendingReviews.length > 0) {
      setIndex(pendingReviews.length - 1);
    }
  }, [pendingReviews.length, index]);

  useEffect(() => {
    setCountdown(TIMEOUT_SECONDS);
    setTab("screenshot");
    if (!current) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { handleAction("TIMEOUT"); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [current?.job_id]);

  const currentResume = useMemo(() => {
    if (!resumesData?.items || !current) return null;
    return resumesData.items.find((r) => r.name === current.resume_variant);
  }, [resumesData, current]);

  const handleAction = useCallback(async (action: string) => {
    if (!current || submitting) return;
    setSubmitting(action);
    try {
      if (action !== "TIMEOUT") {
        const idx = pendingReviews.indexOf(current);
        await submitDecision(idx >= 0 ? idx : 0, action);
        useToast.getState().add(
          action === "APPROVE" ? "success" : action === "SKIP" ? "error" : "info",
          action === "APPROVE" ? "Approved & submitted" : action === "SKIP" ? "Skipped" : "Marked for edit"
        );
      }
      removeReview(current.job_id);
      if (index >= pendingReviews.length - 1 && index > 0) setIndex((i) => i - 1);
    } catch { useToast.getState().add("error", "Failed to submit"); }
    setSubmitting(null);
  }, [current, submitting, index, pendingReviews]);

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
      </div>

      <div
        key={current.job_id}
        className="bg-white rounded-2xl border border-border overflow-hidden soft-shadow animate-fade-in"
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-border">
          <div className="lg:col-span-3 p-6 space-y-4">
            <Badge>{current.platform}</Badge>

            <div>
              <h2 className="text-xl font-bold leading-tight">{current.title}</h2>
              <p className="text-text-secondary mt-1">
                {current.company}
                {current.location && <span className="text-text-muted"> &middot; {current.location}</span>}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Match Score</span>
                <span className={cn("text-sm font-semibold", matchScoreColor(current.match_score))}>
                  {current.match_score}%
                </span>
              </div>
              <ScoreBar score={current.match_score} size="lg" />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {current.keywords_injected.map((kw: string) => (
                <span
                  key={kw}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-text-secondary"
                >
                  {kw}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{current.resume_variant}</Badge>
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
                current.screenshot_path ? (
                  <a
                    href={`/screenshots/${current.screenshot_path.split("/").pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={`/screenshots/${current.screenshot_path.split("/").pop()}`}
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
                  {currentResume?.content ?? `Resume: ${current.resume_variant}\nKeywords: ${current.keywords_injected.join(", ")}\nScore: ${current.match_score}%`}
                </pre>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="p-2 rounded-xl hover:bg-surface-hover text-text-muted disabled:opacity-30 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs text-text-muted tabular-nums min-w-[3rem] text-center">
                {index + 1}/{pendingReviews.length}
              </span>
              <button
                onClick={() => setIndex((i) => Math.min(pendingReviews.length - 1, i + 1))}
                disabled={index >= pendingReviews.length - 1}
                className="p-2 rounded-xl hover:bg-surface-hover text-text-muted disabled:opacity-30 transition-colors"
              >
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="danger" size="sm" onClick={() => handleAction("SKIP")} disabled={!!submitting}>
                <X size={14} /> Skip (S)
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleAction("EDIT")} disabled={!!submitting}>
                <Edit3 size={14} /> Edit (E)
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleAction("APPROVE")} disabled={!!submitting}>
                <Check size={14} /> Approve (A)
              </Button>
            </div>
          </div>
          <CountdownBar timeLeft={countdown} total={TIMEOUT_SECONDS} />
        </div>
      </div>
    </div>
  );
}
