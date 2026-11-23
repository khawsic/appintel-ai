import {
  AlertTriangle,
  Check,
  CircleDashed,
  Loader2,
  XCircle,
} from "lucide-react";

type Tone = "neutral" | "accent" | "success" | "warning" | "error";

export function StatusIndicator({
  label,
  tone = "neutral",
  spinning = false,
}: {
  label: string;
  tone?: Tone;
  spinning?: boolean;
}) {
  const toneColor: Record<Tone, string> = {
    neutral: "text-[#64748B]",
    accent: "text-[#635BFF]",
    success: "text-[#15803D]",
    warning: "text-[#D97706]",
    error: "text-[#DC2626]",
  };

  const Icon = spinning
    ? Loader2
    : tone === "success"
    ? Check
    : tone === "warning"
    ? AlertTriangle
    : tone === "error"
    ? XCircle
    : CircleDashed;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneColor[tone]}`}
    >
      <Icon
        className={`w-3.5 h-3.5 shrink-0 ${spinning ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

export function formatResearchStatus(status: string): {
  label: string;
  tone: Tone;
  spinning?: boolean;
} {
  switch (status) {
    case "completed":
      return { label: "Completed", tone: "success" };
    case "running":
      return { label: "Running", tone: "accent", spinning: true };
    case "failed":
      return { label: "Failed", tone: "error" };
    default:
      return { label: "Pending", tone: "neutral" };
  }
}

export function formatVerificationStatus(status: string): {
  label: string;
  tone: Tone;
} {
  switch (status) {
    case "verified":
      return { label: "Verified", tone: "success" };
    case "needs_review":
      return { label: "Needs Review", tone: "warning" };
    default:
      return { label: "Unverified", tone: "neutral" };
  }
}

export function formatAccessModel(model: string): string {
  switch (model) {
    case "self_serve":
      return "Self-serve";
    case "gated":
      return "Gated";
    case "mixed":
      return "Mixed";
    default:
      return "Unknown";
  }
}

export function formatMcpStatus(status: string): string {
  switch (status) {
    case "official":
      return "Official";
    case "third_party":
      return "Third-party";
    case "unavailable":
      return "Unavailable";
    default:
      return "Unknown";
  }
}

export function formatBuildability(verdict: string): {
  label: string;
  tone: Tone;
} {
  switch (verdict) {
    case "easy":
      return { label: "Easy", tone: "success" };
    case "moderate":
      return { label: "Moderate", tone: "accent" };
    case "difficult":
      return { label: "Difficult", tone: "error" };
    default:
      return { label: "Unknown", tone: "neutral" };
  }
}
