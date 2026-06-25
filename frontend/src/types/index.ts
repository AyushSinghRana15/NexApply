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
  location?: string;
  match_score: number;
  resume_variant: string;
  keywords_injected: string[];
  screenshot_path: string;
  form_data: Record<string, string>;
  status: string;
  decision: string;
  decided_at: string;
  time_to_decide_seconds: number;
  email_status?: string;
  email_received_at?: string;
  email_subject?: string;
  created_at: string;
}

export interface StatsSummary {
  total_applied: number;
  total_skipped: number;
  total_pending: number;
  total_timeout: number;
  avg_match_score: number;
}

export interface EmailTrackingStats {
  confirmed: number;
  interviews: number;
  rejections: number;
  follow_ups: number;
  response_rate: number;
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
  parsed_data?: ParsedResumeData | null;
  source_file?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ParsedResumeData {
  personal: {
    full_name?: string;
    email?: string;
    phone?: string;
    linkedin_url?: string;
    github_url?: string;
    location?: { city?: string; state?: string };
  };
  summary: string;
  skills: {
    primary: string[];
    secondary: string[];
    tools: string[];
    frameworks: string[];
    databases: string[];
    cloud: string[];
    soft_skills: string[];
  };
  experience: Array<{
    title: string;
    company: string;
    type: string;
    start_date: string;
    end_date: string;
    description: string;
    achievements: string[];
  }>;
  education: {
    highest: Record<string, string>;
    secondary: Record<string, string>;
    high_school: Record<string, string>;
  };
  projects: Array<{
    name: string;
    description: string;
    tech_stack: string[];
    url: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    issue_date: string;
  }>;
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
  filled_at?: string;
  posted_ago?: string;
  location?: string;
}

export interface AgentStatus {
  agent: "radar" | "tailor" | "fleet" | "guard";
  status: "online" | "offline" | "error";
  jobs_today?: number;
  last_active?: string;
  details?: string;
}

export interface ActivityEvent {
  id: string;
  type: "JOB_DETECTED" | "JOB_TAILORED" | "JOB_FILLED" | "APPLICATION_SUBMITTED" | "APPLICATION_SKIPPED" | "REVIEW_TIMEOUT" | "EMAIL_UPDATE" | "AGENT_STATUS" | "RESUME_SUGGESTION";
  timestamp: string;
  message: string;
  icon?: string;
  job_id?: string;
  platform?: string;
}

export interface ActivityLogEntry {
  id: number;
  type: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export type WSMessage =
  | { type: "REVIEW_READY"; payload: ReviewPayload }
  | { type: "REVIEW_CLEARED"; job_id: string; decision: string }
  | { type: "JOB_DETECTED"; job: Job }
  | { type: "JOB_TAILORED"; job_id: string; match_score: number; keywords: string[]; llm_used: string }
  | { type: "JOB_FILLED"; job_id: string; platform: string; screenshot_url: string }
  | { type: "APPLICATION_SUBMITTED"; job_id: string; company: string; platform: string }
  | { type: "APPLICATION_SKIPPED"; job_id: string; reason: string }
  | { type: "AGENT_STATUS"; agent: string; status: string; jobs_today?: number; last_active?: string }
  | { type: "EMAIL_UPDATE"; job_id: string; email_type: string; received_at: string }
  | { type: "RESUME_SUGGESTION"; variant: string; avg_score: number; suggestions: string[] }
  | { type: "COUNTDOWN"; job_id: string; seconds_remaining: number }
  | { type: "CLEARED"; job_id: string }
  | { type: "NEW_REVIEW"; payload: ReviewPayload };
