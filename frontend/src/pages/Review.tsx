import { useState, useEffect, useCallback } from "react";
import { Check, X, Edit3, Clock, ExternalLink, ArrowLeft, ArrowRight } from "lucide-react";
import { useWSStore } from "@/stores/useWSStore";
import { Button, Badge, ScoreBar } from "@/components/ui";
import { submitDecision } from "@/api/client";
import { formatDate, matchScoreColor } from "@/lib/utils";
import type { ReviewPayload } from "@/types";

export function Review() {
  const { pendingReviews, removeReview } = useWSStore();
  const [index, setIndex] = useState(0);
  const [countdown, setCountdown] = useState(300);
  const [submitting, setSubmitting] = useState(false);

  const current = pendingReviews[index] as ReviewPayload | undefined;
  const timeout = 300;

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, pendingReviews.length - 1)));
  }, [pendingReviews.length]);

  useEffect(() => {
    setCountdown(timeout);
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

  const handleAction = useCallback(
    async (action: string) => {
      if (!current || submitting) return;
      setSubmitting(true);
      try {
        if (action !== "TIMEOUT") {
          await submitDecision(current.job_id as unknown as number, action);
        }
        removeReview(current.job_id);
      } catch {
        // fall through
      }
      setSubmitting(false);
    },
    [current, submitting]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "A") handleAction("APPROVE");
      if (e.key === "s" || e.key === "S") handleAction("SKIP");
      if (e.key === "e" || e.key === "E") handleAction("EDIT");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAction]);

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="relative mb-6">
          <div className="w-4 h-4 bg-green-500 rounded-full animate-ping absolute" />
          <div className="w-4 h-4 bg-green-500 rounded-full relative" />
        </div>
        <h2 className="text-lg font-semibold">Waiting for jobs</h2>
        <p className="text-dark-400 text-sm mt-2">The GuardAgent will push reviews here in real-time</p>
      </div>
    );
  }

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const countdownColor = countdown > 60 ? "text-dark-400" : countdown > 30 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Review</h1>
        <div className="flex items-center gap-2 text-sm">
          <Clock size={16} className={countdownColor} />
          <span className={countdownColor}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{current.title}</h2>
            <p className="text-dark-400 mt-1">{current.company}</p>
          </div>
          <span className={matchScoreColor(current.match_score)}>
            {current.match_score}%
          </span>
        </div>

        <ScoreBar score={current.match_score} size="lg" />

        <div className="flex flex-wrap gap-2">
          <Badge>{current.platform}</Badge>
          {current.keywords_injected.map((kw) => (
            <Badge key={kw} variant="success">{kw}</Badge>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-dark-500">Variant</p>
            <p className="font-medium">{current.resume_variant}</p>
          </div>
          <div>
            <p className="text-dark-500">Status</p>
            <Badge variant="warning">PENDING REVIEW</Badge>
          </div>
        </div>

        {current.screenshot_path && (
          <div>
            <p className="text-sm text-dark-500 mb-2">Form Preview</p>
            <img
              src={`/screenshots/${current.screenshot_path.split("/").pop()}`}
              alt="Form screenshot"
              className="rounded-lg border border-border w-full max-h-80 object-cover bg-dark-800"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="p-2 rounded-lg hover:bg-surface-hover text-dark-400 disabled:opacity-30"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="text-xs text-dark-500">
              {index + 1} / {pendingReviews.length}
            </span>
            <button
              onClick={() => setIndex((i) => Math.min(pendingReviews.length - 1, i + 1))}
              disabled={index >= pendingReviews.length - 1}
              className="p-2 rounded-lg hover:bg-surface-hover text-dark-400 disabled:opacity-30"
            >
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={() => handleAction("SKIP")} disabled={submitting}>
              <X size={16} /> Skip (S)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAction("EDIT")} disabled={submitting}>
              <Edit3 size={16} /> Edit (E)
            </Button>
            <Button variant="primary" size="sm" onClick={() => handleAction("APPROVE")} disabled={submitting}>
              <Check size={16} /> Approve (A)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
