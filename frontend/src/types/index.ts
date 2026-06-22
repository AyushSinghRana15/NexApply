export interface Job {
  id: number;
  job_id: string;
  platform: string;
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string;
  posted_at: string;
  detected_at: string;
  created_at: string;
}

export interface Application {
  id: number;
  job_id: string;
  platform: string;
  title: string;
  company: string;
  match_score: number;
  resume_variant: string;
  keywords_injected: string[];
  screenshot_path: string;
  form_data: Record<string, string>;
  status: string;
  decision: string;
  decided_at: string;
  time_to_decide_seconds: number;
  created_at: string;
}

export interface StatsSummary {
  total_applied: number;
  total_skipped: number;
  total_pending: number;
  total_timeout: number;
  avg_match_score: number;
}

export interface TimelinePoint {
  date: string;
  applied: number;
  skipped: number;
}

export interface PlatformBreakdown {
  platform: string;
  total: number;
  applied: number;
  skipped: number;
}

export interface ResumeVariant {
  id: number;
  name: string;
  category: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

export interface ReviewPayload {
  job_id: string;
  platform: string;
  title: string;
  company: string;
  apply_url: string;
  match_score: number;
  keywords_injected: string[];
  resume_variant: string;
  screenshot_path: string;
  status: string;
}

export type WSMessage =
  | { type: "REVIEW_READY"; payload: ReviewPayload }
  | { type: "REVIEW_CLEARED"; job_id: string; decision: string }
  | { type: "JOB_DETECTED"; job: Job }
  | { type: "JOB_TAILORED"; job_id: string; match_score: number; keywords: string[]; llm_used: string }
  | { type: "APPLICATION_SUBMITTED"; job_id: string; company: string; platform: string }
  | { type: "APPLICATION_SKIPPED"; job_id: string; reason: string };
