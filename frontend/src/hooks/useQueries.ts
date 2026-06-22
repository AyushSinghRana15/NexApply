import { useQuery } from "@tanstack/react-query";
import { fetchJobs, fetchApplications, fetchApplication, fetchStatsSummary, fetchStatsTimeline, fetchStatsPlatforms, fetchResumes, fetchConfig } from "@/api/client";

export function useJobs(page = 1) {
  return useQuery({
    queryKey: ["jobs", page],
    queryFn: () => fetchJobs(page),
    refetchInterval: 30_000,
  });
}

export function useApplications(params?: { page?: number; platform?: string; status?: string }) {
  return useQuery({
    queryKey: ["applications", params],
    queryFn: () => fetchApplications(params),
    refetchInterval: 10_000,
  });
}

export function useApplication(id: number) {
  return useQuery({
    queryKey: ["application", id],
    queryFn: () => fetchApplication(id),
    enabled: !!id,
  });
}

export function useStatsSummary() {
  return useQuery({
    queryKey: ["stats", "summary"],
    queryFn: fetchStatsSummary,
    refetchInterval: 15_000,
  });
}

export function useStatsTimeline() {
  return useQuery({
    queryKey: ["stats", "timeline"],
    queryFn: fetchStatsTimeline,
    refetchInterval: 30_000,
  });
}

export function useStatsPlatforms() {
  return useQuery({
    queryKey: ["stats", "platforms"],
    queryFn: fetchStatsPlatforms,
    refetchInterval: 30_000,
  });
}

export function useResumes() {
  return useQuery({
    queryKey: ["resumes"],
    queryFn: fetchResumes,
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: fetchConfig,
  });
}
