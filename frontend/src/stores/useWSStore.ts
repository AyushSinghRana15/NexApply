import { create } from "zustand";
import type { ReviewPayload, AgentStatus, ActivityEvent, WSMessage } from "@/types";

let eventCounter = 0;

interface WSState {
  ws: WebSocket | null;
  isConnected: boolean;
  reconnectAttempts: number;
  pendingReviews: ReviewPayload[];
  activeReviewIndex: number;
  agents: Record<string, AgentStatus>;
  activityFeed: ActivityEvent[];
  countdowns: Record<string, number>;

  connect: () => void;
  disconnect: () => void;
  addReview: (r: ReviewPayload) => void;
  removeReview: (jobId: string) => void;
  nextReview: () => void;
  setAgentStatus: (agent: string, status: string, jobs_today?: number, last_active?: string) => void;
  addActivity: (event: Omit<ActivityEvent, "id">) => void;
  updateCountdown: (jobId: string, seconds: number) => void;
  clearCountdown: (jobId: string) => void;
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useWSStore = create<WSState>((set, get) => ({
  ws: null,
  isConnected: false,
  reconnectAttempts: 0,
  pendingReviews: [],
  activeReviewIndex: 0,
  agents: {},
  activityFeed: [],
  countdowns: {},

  connect: () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      set({ isConnected: true, reconnectAttempts: 0 });
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        switch (msg.type) {
          case "REVIEW_READY":
          case "NEW_REVIEW": {
            const payload = "payload" in msg ? msg.payload : null;
            if (payload) {
              set((s) => ({
                pendingReviews: s.pendingReviews.some((r) => r.job_id === payload.job_id)
                  ? s.pendingReviews
                  : [...s.pendingReviews, payload],
              }));
            }
            break;
          }
          case "REVIEW_CLEARED":
          case "CLEARED": {
            const jobId = "job_id" in msg ? msg.job_id : "";
            if (jobId) get().removeReview(jobId);
            if ("job_id" in msg) get().clearCountdown(msg.job_id);
            break;
          }
          case "AGENT_STATUS": {
            set((s) => ({
              agents: {
                ...s.agents,
                [msg.agent]: {
                  agent: msg.agent as AgentStatus["agent"],
                  status: msg.status as AgentStatus["status"],
                  jobs_today: msg.jobs_today,
                  last_active: msg.last_active,
                },
              },
            }));
            break;
          }
          case "JOB_DETECTED": {
            const j = "job" in msg ? msg.job : null;
            if (j) {
              get().addActivity({
                type: "JOB_DETECTED",
                timestamp: new Date().toISOString(),
                message: `${j.title} @ ${j.company} (${j.platform})`,
                job_id: j.job_id,
                platform: j.platform,
              });
            }
            break;
          }
          case "JOB_TAILORED":
            get().addActivity({
              type: "JOB_TAILORED",
              timestamp: new Date().toISOString(),
              message: `Score: ${msg.match_score} — ${msg.keywords.slice(0, 3).join(", ")}`,
              job_id: msg.job_id,
            });
            break;
          case "JOB_FILLED":
            get().addActivity({
              type: "JOB_FILLED",
              timestamp: new Date().toISOString(),
              message: `Form filled on ${msg.platform}`,
              job_id: msg.job_id,
              platform: msg.platform,
            });
            break;
          case "APPLICATION_SUBMITTED":
            get().addActivity({
              type: "APPLICATION_SUBMITTED",
              timestamp: new Date().toISOString(),
              message: `${msg.company} on ${msg.platform}`,
              job_id: msg.job_id,
              platform: msg.platform,
            });
            break;
          case "APPLICATION_SKIPPED":
            get().addActivity({
              type: "APPLICATION_SKIPPED",
              timestamp: new Date().toISOString(),
              message: msg.reason,
              job_id: msg.job_id,
            });
            break;
          case "EMAIL_UPDATE":
            get().addActivity({
              type: "EMAIL_UPDATE",
              timestamp: new Date().toISOString(),
              message: `${msg.email_type} for job ${msg.job_id}`,
              job_id: msg.job_id,
            });
            break;
          case "COUNTDOWN":
            if ("job_id" in msg) {
              get().updateCountdown(msg.job_id, msg.seconds_remaining);
            }
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      set({ isConnected: false, ws: null });
      const attempts = get().reconnectAttempts;
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      set({ reconnectAttempts: attempts + 1 });
      reconnectTimer = setTimeout(() => get().connect(), delay);
    };

    socket.onerror = () => {
      socket.close();
    };

    set({ ws: socket });
  },

  disconnect: () => {
    const { ws } = get();
    ws?.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    set({ ws: null, isConnected: false, reconnectAttempts: 0 });
  },

  addReview: (r) => set((s) => ({ pendingReviews: [...s.pendingReviews, r] })),

  removeReview: (jobId) =>
    set((s) => ({
      pendingReviews: s.pendingReviews.filter((r) => r.job_id !== jobId),
      activeReviewIndex: Math.max(0, s.activeReviewIndex),
    })),

  nextReview: () =>
    set((s) => ({
      activeReviewIndex: Math.min(s.activeReviewIndex + 1, Math.max(0, s.pendingReviews.length - 1)),
    })),

  setAgentStatus: (agent, status, jobs_today, last_active) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [agent]: {
          agent: agent as AgentStatus["agent"],
          status: status as AgentStatus["status"],
          jobs_today,
          last_active,
        },
      },
    })),

  addActivity: (event) =>
    set((s) => {
      const next: ActivityEvent = { ...event, id: `evt-${++eventCounter}` };
      const feed = [next, ...s.activityFeed].slice(0, 100);
      return { activityFeed: feed };
    }),

  updateCountdown: (jobId, seconds) =>
    set((s) => ({ countdowns: { ...s.countdowns, [jobId]: seconds } })),

  clearCountdown: (jobId) =>
    set((s) => {
      const { [jobId]: _, ...rest } = s.countdowns;
      return { countdowns: rest };
    }),
}));
