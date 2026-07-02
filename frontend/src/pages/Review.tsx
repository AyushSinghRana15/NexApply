import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check, X, Edit3, ArrowLeft, ArrowRight,
  FileText, Image
} from "lucide-react";
import { useWSStore } from "@/stores/useWSStore";
import { Button, Badge, ScoreBar } from "@/components/ui";
import { useResumes } from "@/hooks/useQueries";
import { submitDecision } from "@/api/client";
import { matchScoreColor, cn } from "@/lib/utils";
import { toast } from "@/components/common/Toast";
import type { ReviewPayload } from "@/types";

const TIMEOUT_SECONDS = 300;

const platformAccent = (platform: string) => {
  const p = platform.toLowerCase();
  if (p === "indeed") return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  if (p === "naukri") return "border-red-500/30 bg-red-500/10 text-red-400";
  if (p === "glassdoor") return "border-green-500/30 bg-green-500/10 text-green-400";
  if (p === "foundit") return "border-orange-500/30 bg-orange-500/10 text-orange-400";
  if (p === "internshala") return "border-teal-500/30 bg-teal-500/10 text-teal-400";
  return "border-gray-300 bg-gray-200 text-gray-600";
};

function CountdownBar({ timeLeft, total }: { timeLeft: number; total: number }) {
  const fraction = total > 0 ? timeLeft / total : 0;
  const isUrgent = timeLeft <= 60;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            isUrgent ? "bg-red-500" : "bg-accent"
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span className={cn(
        "text-xs font-medium tabular-nums shrink-0 w-20 text-right",
        isUrgent ? "text-red-400" : "text-gray-500"
      )}>
        {minutes}:{seconds.toString().padStart(2, "0")} remaining
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
        if (c <= 1) {
          handleAction("TIMEOUT");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [current?.job_id]);

  const currentResume = useMemo(() => {
    if (!resumesData?.items || !current) return null;
    return resumesData.items.find((r) => r.name === current.resume_variant);
  }, [resumesData, current]);

  const handleAction = useCallback(
    async (action: string) => {
      if (!current || submitting) return;
      setSubmitting(action);
      try {
        if (action !== "TIMEOUT") {
          const idx = pendingReviews.indexOf(current);
          await submitDecision(idx >= 0 ? idx : 0, action);
          toast.add(
            action === "APPROVE" ? "success"
              : action === "SKIP" ? "error"
                : "info",
            action === "APPROVE" ? "Application approved and submitted"
              : action === "SKIP" ? "Application skipped"
                : "Application marked for edit"
          );
        }
        removeReview(current.job_id);
        if (index >= pendingReviews.length - 1 && index > 0) {
          setIndex((i) => i - 1);
        }
      } catch {
        toast.add("error", "Failed to submit decision");
      }
      setSubmitting(null);
    },
    [current, submitting, index, pendingReviews]
  );

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
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <div className="relative mb-6">
          <div className="w-5 h-5 bg-green-500 rounded-full animate-ping absolute inset-0" />
          <div className="w-5 h-5 bg-green-500 rounded-full relative" />
        </div>
        <h2 className="text-lg font-semibold">Watching for jobs...</h2>
        <p className="text-gray-500 text-sm mt-2 max-w-sm">
          The GuardAgent will push new review requests here as soon as forms are filled
        </p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <p className="text-gray-400 text-sm">No review selected</p>
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
            <span className="text-sm text-gray-500">{queueRemaining} more in queue</span>
          )}
        </div>
      </div>

      <div
        key={current.job_id}
        className="bg-surface rounded-xl border border-border overflow-hidden animate-fade-in"
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-border">
          <div className="lg:col-span-3 p-6 space-y-5">
            <div>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border",
                platformAccent(current.platform)
              )}>
                {current.platform}
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold leading-tight">{current.title}</h2>
              <p className="text-gray-500 mt-1">
                {current.company}
                {current.location && <span className="text-gray-400"> &middot; {current.location}</span>}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Match Score</span>
                <span className={cn("text-sm font-semibold", matchScoreColor(current.match_score))}>
                  {current.match_score}%
                </span>
              </div>
              <div className="relative">
                <ScoreBar score={current.match_score} size="lg" />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {current.keywords_injected.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-200 text-gray-600"
                >
                  {kw}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{current.resume_variant}</Badge>
              <Badge variant="default">LLM: groq/llama-3.3-70b</Badge>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col">
            <div className="flex border-b border-border">
              <button
                onClick={() => setTab("screenshot")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  tab === "screenshot"
                    ? "text-accent border-b-2 border-accent"
                    : "text-gray-500 hover:text-gray-600"
                )}
              >
                <Image size={14} /> Screenshot
              </button>
              <button
                onClick={() => setTab("resume")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  tab === "resume"
                    ? "text-accent border-b-2 border-accent"
                    : "text-gray-500 hover:text-gray-600"
                )}
              >
                <FileText size={14} /> Resume
              </button>
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
                      alt="Application form screenshot"
                      className="rounded-lg border border-border w-full object-cover bg-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  </a>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    No screenshot available
                  </div>
                )
              ) : (
                <pre className="text-sm text-gray-600 font-mono whitespace-pre-wrap leading-relaxed">
                  {currentResume?.content ?? (
                    `Resume Variant: ${current.resume_variant}
────────────────────────────────
Injected Keywords:
${current.keywords_injected.map((kw) => `  • ${kw}`).join("\n")}

Match Score: ${current.match_score}%
Status: PENDING_REVIEW`
                  )}
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
                className="p-2 rounded-lg hover:bg-surface-hover text-gray-500 disabled:opacity-30 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs text-gray-400 tabular-nums min-w-[3rem] text-center">
                {index + 1} / {pendingReviews.length}
              </span>
              <button
                onClick={() => setIndex((i) => Math.min(pendingReviews.length - 1, i + 1))}
                disabled={index >= pendingReviews.length - 1}
                className="p-2 rounded-lg hover:bg-surface-hover text-gray-500 disabled:opacity-30 transition-colors"
              >
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleAction("SKIP")}
                disabled={!!submitting}
              >
                <X size={14} /> Skip (S)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAction("EDIT")}
                disabled={!!submitting}
              >
                <Edit3 size={14} /> Edit (E)
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleAction("APPROVE")}
                disabled={!!submitting}
              >
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
