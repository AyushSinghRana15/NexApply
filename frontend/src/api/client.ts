import axios from "axios";
import type { Application, Job, PlatformBreakdown, ResumeVariant, StatsSummary, TimelinePoint } from "@/types";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export async function fetchJobs(page = 1, perPage = 20): Promise<{ items: Job[]; total: number }> {
  const { data } = await api.get("/jobs", { params: { page, per_page: perPage } });
  return data;
}

export async function fetchApplications(params?: {
  page?: number;
  per_page?: number;
  platform?: string;
  status?: string;
}): Promise<{ items: Application[]; total: number }> {
  const { data } = await api.get("/applications", { params });
  return data;
}

export async function fetchApplication(id: number): Promise<Application> {
  const { data } = await api.get(`/applications/${id}`);
  return data;
}

export async function submitDecision(id: number, action: string): Promise<Application> {
  const { data } = await api.patch(`/applications/${id}/decision`, { action });
  return data;
}

export async function fetchStatsSummary(): Promise<StatsSummary> {
  const { data } = await api.get("/stats/summary");
  return data;
}

export async function fetchStatsTimeline(): Promise<{ days: TimelinePoint[] }> {
  const { data } = await api.get("/stats/timeline");
  return data;
}

export async function fetchStatsPlatforms(): Promise<{ platforms: PlatformBreakdown[] }> {
  const { data } = await api.get("/stats/platforms");
  return data;
}

export async function fetchResumes(): Promise<{ items: ResumeVariant[] }> {
  const { data } = await api.get("/resumes");
  return data;
}

export async function fetchConfig(): Promise<Record<string, unknown>> {
  const { data } = await api.get("/config");
  return data;
}

export async function updateConfig(cfg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data } = await api.patch("/config", cfg);
  return data;
}

export default api;
