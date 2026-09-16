import { create } from "zustand";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastStore {
  toasts: ToastItem[];
  add: (type: ToastType, message: string) => void;
  remove: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = useToast;
