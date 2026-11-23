import { useMemo, useState } from "react";
import { ArrowUpDown, Layers, Search } from "lucide-react";
import { AppRecord } from "../../shared/types";
import {
  formatAccessModel,
  formatBuildability,
  formatMcpStatus,
  formatResearchStatus,
  formatVerificationStatus,
  StatusIndicator,
} from "../components/StatusLabel";

interface AppResearchPageProps {
  apps: AppRecord[];
  onSelectApp: (app: AppRecord) => void;
}

type SortKey = "index" | "app_name" | "category" | "buildability" | "research_status";

export function AppResearchPage({ apps, onSelectApp }: AppResearchPageProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [authFilter, setAuthFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [mcpFilter, setMcpFilter] = useState("all");
  const [buildFilter, setBuildFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verFilter, setVerFilter] = useState("all");
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("index");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const categories = useMemo(
    () => Array.from(new Set(apps.map((a) => a.category))),
    [apps]
  );

  const authOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of apps) {
      for (const m of a.authentication_methods) {
        if (m.trim()) set.add(m.trim());
      }
    }
    return Array.from(set).sort();
  }, [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps
      .filter((a) => {
        if (
          q &&
          !a.app_name.toLowerCase().includes(q) &&
          !a.category.toLowerCase().includes(q) &&
          !(a.description ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
        if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
        if (
          authFilter !== "all" &&
          !a.authentication_methods.includes(authFilter)
        ) {
          return false;
        }
        if (accessFilter !== "all" && a.api_access_model !== accessFilter)
          return false;
        if (mcpFilter !== "all" && a.mcp_status !== mcpFilter) return false;
        if (buildFilter !== "all" && a.buildability !== buildFilter) return false;
        if (statusFilter !== "all" && a.research_status !== statusFilter)
          return false;
        if (verFilter !== "all" && a.verification_status !== verFilter)
          return false;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "index") cmp = a.index - b.index;
        else if (sortKey === "app_name") cmp = a.app_name.localeCompare(b.app_name);
        else if (sortKey === "category") cmp = a.category.localeCompare(b.category);
        else if (sortKey === "buildability")
          cmp = a.buildability.localeCompare(b.buildability);
        else if (sortKey === "research_status")
          cmp = a.research_status.localeCompare(b.research_status);
        return sortAsc ? cmp : -cmp;
      });
  }, [
    apps,
    search,
    categoryFilter,
    authFilter,
    accessFilter,
    mcpFilter,
    buildFilter,
    statusFilter,
    verFilter,
    sortKey,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = groupByCategory
    ? filtered
    : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const grouped = useMemo(() => {
    if (!groupByCategory) return null;
    const map = new Map<string, AppRecord[]>();
    for (const app of paginated) {
      const list = map.get(app.category) ?? [];
      list.push(app);
      map.set(app.category, list);
    }
    return Array.from(map.entries());
  }, [groupByCategory, paginated]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setAuthFilter("all");
    setAccessFilter("all");
    setMcpFilter("all");
    setBuildFilter("all");
    setStatusFilter("all");
    setVerFilter("all");
    setPage(1);
  };

  const renderRow = (app: AppRecord) => {
    const res = formatResearchStatus(app.research_status);
    const ver = formatVerificationStatus(app.verification_status);
    const build = formatBuildability(app.buildability);
    return (
      <tr
        key={app.id}
        onClick={() => onSelectApp(app)}
        className="hover:bg-[#F8FAFC] cursor-pointer transition-colors border-b border-[#E5E7EB] last:border-b-0"
      >
        <td className="px-3 py-2.5 text-xs font-mono tabular-nums text-[#64748B]">
          {String(app.index).padStart(3, "0")}
        </td>
        <td className="px-3 py-2.5 text-xs font-medium text-[#172033] whitespace-nowrap">
          {app.app_name}
        </td>
        <td className="px-3 py-2.5 text-xs text-[#64748B] whitespace-nowrap">
          {app.category}
        </td>
        <td className="px-3 py-2.5 text-xs text-[#172033] max-w-[170px] truncate">
          {app.authentication_methods.length > 0
            ? app.authentication_methods.join(", ")
            : "—"}
        </td>
        <td className="px-3 py-2.5 text-xs text-[#172033] whitespace-nowrap">
          {app.research_status === "completed"
            ? formatAccessModel(app.api_access_model)
            : "—"}
        </td>
        <td className="px-3 py-2.5 text-xs text-[#172033] whitespace-nowrap">
          {app.research_status === "completed"
            ? formatMcpStatus(app.mcp_status)
            : "—"}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {app.research_status === "completed" ? (
            <StatusIndicator label={build.label} tone={build.tone} />
          ) : (
            <span className="text-xs text-[#64748B]">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <StatusIndicator
            label={res.label}
            tone={res.tone}
            spinning={res.spinning}
          />
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <StatusIndicator label={ver.label} tone={ver.tone} />
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#172033] tracking-tight">
            App Research Database
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Canonical registry of all 100 applications across 10 categories. Click
            any row to inspect evidence, scoring, and verification history.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setGroupByCategory(!groupByCategory)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              groupByCategory
                ? "bg-[#172033] text-white border-[#172033]"
                : "bg-white text-[#172033] border-[#E5E7EB] hover:bg-[#F8FAFC]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{groupByCategory ? "Grouped by Category" : "Group by Category"}</span>
          </button>
        </div>
      </div>

      {/* Airtable-inspired Filter & Search Toolbar */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search application name, category, or description..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#635BFF]"
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#172033] border border-[#E5E7EB] rounded-md whitespace-nowrap"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by authentication"
            value={authFilter}
            onChange={(e) => {
              setAuthFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
          >
            <option value="all">All Auth Methods</option>
            {authOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by API access"
            value={accessFilter}
            onChange={(e) => {
              setAccessFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
          >
            <option value="all">All API Access</option>
            <option value="self_serve">Self-serve</option>
            <option value="gated">Gated</option>
            <option value="mixed">Mixed</option>
            <option value="unknown">Unknown</option>
          </select>

          <select
            aria-label="Filter by MCP status"
            value={mcpFilter}
            onChange={(e) => {
              setMcpFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
          >
            <option value="all">All MCP Status</option>
            <option value="official">Official</option>
            <option value="third_party">Third-party</option>
            <option value="unavailable">Unavailable</option>
            <option value="unknown">Unknown</option>
          </select>

          <select
            aria-label="Filter by buildability"
            value={buildFilter}
            onChange={(e) => {
              setBuildFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
          >
            <option value="all">All Buildability</option>
            <option value="easy">Easy</option>
            <option value="moderate">Moderate</option>
            <option value="difficult">Difficult</option>
            <option value="unknown">Unknown</option>
          </select>

          <select
            aria-label="Filter by research status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
          >
            <option value="all">All Research Status</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <select
            aria-label="Filter by verification status"
            value={verFilter}
            onChange={(e) => {
              setVerFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
          >
            <option value="all">All Verification</option>
            <option value="unverified">Unverified</option>
            <option value="verified">Verified</option>
            <option value="needs_review">Needs Review</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort("index")}
                    className="inline-flex items-center gap-1 hover:text-[#172033]"
                  >
                    <span>#</span>
                    <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort("app_name")}
                    className="inline-flex items-center gap-1 hover:text-[#172033]"
                  >
                    <span>Application</span>
                    <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort("category")}
                    className="inline-flex items-center gap-1 hover:text-[#172033]"
                  >
                    <span>Category</span>
                    <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                  </button>
                </th>
                <th className="px-3 py-2.5">Authentication</th>
                <th className="px-3 py-2.5">API Access</th>
                <th className="px-3 py-2.5">MCP Status</th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort("buildability")}
                    className="inline-flex items-center gap-1 hover:text-[#172033]"
                  >
                    <span>Buildability</span>
                    <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort("research_status")}
                    className="inline-flex items-center gap-1 hover:text-[#172033]"
                  >
                    <span>Research</span>
                    <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                  </button>
                </th>
                <th className="px-3 py-2.5">Verification</th>
              </tr>
            </thead>
            {filtered.length === 0 ? (
              <tbody>
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-xs text-[#64748B]"
                  >
                    No applications match the active filters.
                  </td>
                </tr>
              </tbody>
            ) : grouped ? (
              grouped.map(([cat, list]) => (
                <tbody key={cat}>
                  <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                    <td
                      colSpan={9}
                      className="px-3 py-2 text-xs font-semibold text-[#172033]"
                    >
                      {cat}{" "}
                      <span className="font-mono font-normal text-[#64748B] ml-1">
                        ({list.length})
                      </span>
                    </td>
                  </tr>
                  {list.map(renderRow)}
                </tbody>
              ))
            ) : (
              <tbody>{paginated.map(renderRow)}</tbody>
            )}
          </table>
        </div>

        {/* Pagination Footer */}
        {!groupByCategory && (
          <div className="px-4 py-3 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B]">
            <div className="font-mono tabular-nums">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-3">
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-white border border-[#E5E7EB] rounded text-xs text-[#172033]"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  className="px-2.5 py-1 border border-[#E5E7EB] rounded text-xs text-[#172033] disabled:opacity-40 hover:bg-[#F8FAFC]"
                >
                  Prev
                </button>
                <span className="px-2 font-mono tabular-nums">
                  {safePage}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  className="px-2.5 py-1 border border-[#E5E7EB] rounded text-xs text-[#172033] disabled:opacity-40 hover:bg-[#F8FAFC]"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
