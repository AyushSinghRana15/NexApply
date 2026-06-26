import { useQuery } from "@tanstack/react-query";
import { fetchJobs, fetchApplications, fetchApplication, fetchStatsSummary, fetchStatsTimeline, fetchStatsPlatforms, fetchResumes, fetchConfig } from "@/api/client";

const STALE = 30_000;
const LONG = 120_000;

export function useJobs(page = 1) {
  return useQuery({
    queryKey: ["jobs", page],
    queryFn: () => fetchJobs(page),
    staleTime: STALE,
    refetchInterval: LONG,
    refetchOnWindowFocus: false,
  });
}

export function useApplications(params?: { page?: number; platform?: string; status?: string }) {
  return useQuery({
    queryKey: ["applications", params],
    queryFn: () => fetchApplications(params),
    staleTime: STALE,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useApplication(id: number) {
  return useQuery({
    queryKey: ["application", id],
    queryFn: () => fetchApplication(id),
    enabled: !!id,
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

export function useStatsSummary() {
  return useQuery({
    queryKey: ["stats", "summary"],
    queryFn: fetchStatsSummary,
    staleTime: STALE,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useStatsTimeline() {
  return useQuery({
    queryKey: ["stats", "timeline"],
    queryFn: fetchStatsTimeline,
    staleTime: STALE,
    refetchInterval: LONG,
    refetchOnWindowFocus: false,
  });
}

export function useStatsPlatforms() {
  return useQuery({
    queryKey: ["stats", "platforms"],
    queryFn: fetchStatsPlatforms,
    staleTime: STALE,
    refetchInterval: LONG,
    refetchOnWindowFocus: false,
  });
}

export function useResumes() {
  return useQuery({
    queryKey: ["resumes"],
    queryFn: fetchResumes,
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: fetchConfig,
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}
