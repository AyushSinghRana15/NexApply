import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Briefcase, Globe, Eye, Target, GraduationCap,
  LogIn, Trash2, RefreshCw, CheckCircle, XCircle,
  Loader2, ExternalLink, Sparkles
} from "lucide-react";
import { fetchCookieStatus, captureCookies, clearCookies } from "@/api/client";
import { Button, Badge } from "@/components/ui";
import { toast } from "@/components/common/Toast";
import { cn } from "@/lib/utils";
import type { PlatformName, CookieStatus } from "@/types";

const PLATFORM_META: Record<PlatformName, {
  label: string;
  description: string;
  icon: typeof Briefcase;
  color: string;
  url: string;
}> = {
  naukri: {
    label: "Naukri",
    description: "India's top portal for experienced and fresh workers. Upload your resume and apply to thousands of jobs.",
    icon: Briefcase,
    color: "text-red-400",
    url: "https://www.naukri.com",
  },
  indeed: {
    label: "Indeed",
    description: "World's largest job search engine. Quickly upload your resume and apply to jobs across companies.",
    icon: Globe,
    color: "text-blue-400",
    url: "https://www.indeed.co.in",
  },
  glassdoor: {
    label: "Glassdoor",
    description: "Check salary estimates and read reviews from past employees before you apply anywhere.",
    icon: Eye,
    color: "text-green-400",
    url: "https://www.glassdoor.co.in",
  },
  foundit: {
    label: "Foundit",
    description: "Formerly Monster.com. Matches your skills to job openings across many industries in India.",
    icon: Target,
    color: "text-orange-400",
    url: "https://www.foundit.in",
  },
  internshala: {
    label: "Internshala",
    description: "Best for students and freshers looking for internships or entry-level jobs across India.",
    icon: GraduationCap,
    color: "text-teal-400",
    url: "https://internshala.com",
  },
};

const platforms: PlatformName[] = ["naukri", "indeed", "glassdoor", "foundit", "internshala"];

function PlatformCard({
  platform,
  status,
  onCapture,
  onClear,
  capturing,
}: {
  platform: PlatformName;
  status?: CookieStatus;
  onCapture: (p: PlatformName) => void;
  onClear: (p: PlatformName) => void;
  capturing: boolean;
}) {
  const meta = PLATFORM_META[platform];
  const Icon = meta.icon;
  const loaded = status?.loaded ?? false;

  return (
    <div className="bg-surface rounded-xl border border-border p-6 space-y-4 animate-fade-in hover:border-ink-600 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-lg bg-ink-750", meta.color)}>
            <Icon size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">{meta.label}</h3>
            <a
              href={meta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-accent transition-colors"
            >
              {meta.url.replace("https://www.", "")}
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loaded ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
              <CheckCircle size={12} />
              Cookies loaded
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-ink-700 text-ink-400">
              <XCircle size={12} />
              Not connected
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed">{meta.description}</p>

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-ink-400">
          {status?.last_captured ? (
            <span>Last captured: {new Date(status.last_captured).toLocaleDateString()}</span>
          ) : (
            <span>No session saved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClear(platform)}
            disabled={!loaded}
            className="text-ink-400 hover:text-danger"
          >
            <Trash2 size={14} />
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => onCapture(platform)}
            disabled={capturing}
            className="bg-ink-700 hover:bg-ink-600 text-text-primary border border-border"
          >
            {capturing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LogIn size={14} />
            )}
            {capturing ? "Opening..." : "Capture Cookies"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Apps() {
  const { data: cookieData, isLoading, refetch } = useQuery({
    queryKey: ["cookie-status"],
    queryFn: fetchCookieStatus,
    refetchInterval: 30_000,
  });

  const [capturingPlatform, setCapturingPlatform] = useState<PlatformName | null>(null);

  const captureMutation = useMutation({
    mutationFn: (platform: PlatformName) => captureCookies(platform),
    onSuccess: (data) => {
      if (data.success) {
        toast.add("success", data.message || "Cookies captured successfully");
        refetch();
      } else {
        toast.add("warning", data.message || "Failed to capture cookies");
      }
    },
    onError: () => {
      toast.add("error", "Failed to connect to browser automation");
    },
    onSettled: () => {
      setCapturingPlatform(null);
    },
  });

  const clearMutation = useMutation({
    mutationFn: (platform: PlatformName) => clearCookies(platform),
    onSuccess: (data) => {
      toast.add("success", data.message || "Cookies cleared");
      refetch();
    },
    onError: () => {
      toast.add("error", "Failed to clear cookies");
    },
  });

  function handleCapture(platform: PlatformName) {
    setCapturingPlatform(platform);
    captureMutation.mutate(platform);
  }

  function handleClear(platform: PlatformName) {
    clearMutation.mutate(platform);
  }

  const statusMap = new Map<PlatformName, CookieStatus>();
  cookieData?.items?.forEach((s) => statusMap.set(s.platform, s));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">App Login</h1>
          <p className="text-text-secondary text-sm mt-1">
            Log in to job platforms to capture session cookies for automated applications
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-ink-400">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platforms.map((platform) => (
          <PlatformCard
            key={platform}
            platform={platform}
            status={statusMap.get(platform)}
            onCapture={handleCapture}
            onClear={handleClear}
            capturing={capturingPlatform === platform}
          />
        ))}
      </div>

      <div className="bg-ink-800/50 rounded-xl border border-border p-5 space-y-3 animate-fade-in">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">How it works</h3>
        </div>
        <ol className="space-y-2 text-sm text-text-secondary ml-5 list-decimal">
          <li>Click <strong className="text-text-primary">Capture Cookies</strong> for a platform — a browser window will open</li>
          <li>Log in to your account manually in that window (the system waits for you)</li>
          <li>Once logged in, the session cookies are saved and the window closes</li>
          <li>Your cookies are stored locally and used only for automated applications</li>
          <li>You can <strong className="text-text-primary">Clear</strong> saved cookies at any time</li>
        </ol>
      </div>
    </div>
  );
}
