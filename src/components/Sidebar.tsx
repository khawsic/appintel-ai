import {
  BarChart3,
  BookOpen,
  Bot,
  Database,
  ExternalLink,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  X,
} from "lucide-react";

export type NavPage =
  | "overview"
  | "research"
  | "insights"
  | "agent"
  | "verification"
  | "methodology";

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  researchedCount: number;
  verifiedCount: number;
  batchActive: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavPage;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "research", label: "App Research", icon: Database },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "agent", label: "Research Agent", icon: Bot },
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "methodology", label: "Methodology", icon: BookOpen },
];

export function Sidebar({
  activePage,
  onNavigate,
  researchedCount,
  verifiedCount,
  batchActive,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex flex-col h-full bg-[#FFFFFF] border-r border-[#E5E7EB] w-[248px] select-none">
      {/* Brand Header */}
      <div className="px-4 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-[#172033] flex items-center justify-center shrink-0">
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="5" height="5" rx="1" fill="#FFFFFF" />
              <rect x="9" y="2" width="5" height="5" rx="1" fill="#635BFF" />
              <rect x="2" y="9" width="5" height="5" rx="1" fill="#94A3B8" />
              <rect x="9" y="9" width="5" height="5" rx="1" fill="#FFFFFF" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm tracking-tight text-[#172033] leading-tight truncate">
              AppIntel AI
            </div>
            <div className="text-[11px] text-[#64748B] truncate">
              Composio Ecosystem Audit
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1 text-[#64748B] hover:text-[#172033]"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#F1F5F9] text-[#172033]"
                  : "text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  active ? "text-[#635BFF]" : "text-[#64748B]"
                }`}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Progress & Deliverables Footer */}
      <div className="px-4 py-3.5 border-t border-[#E5E7EB] space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#64748B]">Dataset Coverage</span>
            <span className="font-mono tabular-nums text-[#172033] font-medium">
              {researchedCount}/100
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#F1F5F9] rounded-sm overflow-hidden">
            <div
              className="h-full bg-[#635BFF] transition-all duration-300"
              style={{ width: `${researchedCount}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#64748B]">
            <span className="tabular-nums">{verifiedCount} verified</span>
            <span>{batchActive ? "Agent active" : "Idle"}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-[#E5E7EB] space-y-1">
          <a
            href="/report.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-xs text-[#64748B] hover:text-[#172033] py-1 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>HTML Report</span>
            </span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="/api/export/json"
            className="flex items-center justify-between text-xs text-[#64748B] hover:text-[#172033] py-1 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export JSON</span>
            </span>
            <span className="font-mono text-[10px] text-[#64748B]">.json</span>
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#172033]/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
}
