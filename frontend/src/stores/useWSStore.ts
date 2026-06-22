import { create } from "zustand";
import type { ReviewPayload } from "@/types";

interface WSState {
  ws: WebSocket | null;
  isConnected: boolean;
  pendingReviews: ReviewPayload[];
  activeReviewIndex: number;
  connect: () => void;
  disconnect: () => void;
  addReview: (r: ReviewPayload) => void;
  removeReview: (jobId: string) => void;
  nextReview: () => void;
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const RECONNECT_DELAY = 3000;

export const useWSStore = create<WSState>((set, get) => ({
  ws: null,
  isConnected: false,
  pendingReviews: [],
  activeReviewIndex: 0,

  connect: () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      set({ isConnected: true });
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "REVIEW_READY" && msg.payload) {
          set((s) => ({
            pendingReviews: [...s.pendingReviews, msg.payload],
          }));
        }
        if (msg.type === "REVIEW_CLEARED" && msg.job_id) {
          get().removeReview(msg.job_id);
        }
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      set({ isConnected: false, ws: null });
      reconnectTimer = setTimeout(() => get().connect(), RECONNECT_DELAY);
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
    set({ ws: null, isConnected: false });
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
}));
