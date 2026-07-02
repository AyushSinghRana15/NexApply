import axios from "axios";
import type { Application, CookieStatus, EmailTrackingStats, Job, ParsedResumeData, PlatformBreakdown, ResumeVariant, StatsSummary, TimelinePoint, ActivityLogEntry } from "@/types";

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
  search?: string;
  min_score?: number;
  date_range?: string;
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

export async function fetchEmailHistory(id: number): Promise<{ items: unknown[] }> {
  const { data } = await api.get(`/applications/${id}/email-history`);
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

export async function fetchEmailTrackingStats(): Promise<EmailTrackingStats> {
  const { data } = await api.get("/stats/email-tracking");
  return data;
}

export async function fetchResumes(): Promise<{ items: ResumeVariant[] }> {
  const { data } = await api.get("/resumes");
  return data;
}

export async function createResume(body: { name: string; category: string; content: string; parsed_data?: unknown }): Promise<ResumeVariant> {
  const { data } = await api.post("/resumes", body);
  return data;
}

export async function uploadResume(file: File, name?: string, category?: string): Promise<ResumeVariant> {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  if (category) form.append("category", category);
  const { data } = await api.post("/resumes/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function parseResumeFile(file: File): Promise<{ parsed_data: ParsedResumeData }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/resumes/parse", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function profileFromResume(file: File): Promise<{ message: string; parsed_data: ParsedResumeData }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/resumes/profile-from-resume", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateResume(id: number, body: Partial<ResumeVariant>): Promise<ResumeVariant> {
  const { data } = await api.patch(`/resumes/${id}`, body);
  return data;
}

export async function deleteResume(id: number): Promise<void> {
  await api.delete(`/resumes/${id}`);
}

export async function previewResume(body: { variant_id: number; sample_keywords: string[] }): Promise<{ injected: string }> {
  const { data } = await api.post("/resumes/preview", body);
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

export async function fetchActivityLog(): Promise<{ items: ActivityLogEntry[] }> {
  const { data } = await api.get("/logs/activity");
  return data;
}

export async function fetchHealth(): Promise<Record<string, unknown>> {
  const { data } = await api.get("/health");
  return data;
}

export async function clearApplications(): Promise<void> {
  await api.delete("/applications");
}

export async function fetchCookieStatus(): Promise<{ items: CookieStatus[] }> {
  const { data } = await api.get("/cookies/status");
  return data;
}

export async function captureCookies(platform: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post("/cookies/capture", { platform });
  return data;
}

export async function clearCookies(platform: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post("/cookies/clear", { platform });
  return data;
}

export default api;
