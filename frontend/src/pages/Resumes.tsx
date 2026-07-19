import { useState, useMemo } from "react";
import { useResumes } from "@/hooks/useQueries";
import { FileText, Search, Download } from "lucide-react";
import { TableSkeleton } from "@/components/common";
import type { ResumeVariant } from "@/types";

const CATEGORY_COLORS = [
  "bg-blue-100 text-blue-600",
  "bg-green-100 text-green-600",
  "bg-purple-100 text-purple-600",
  "bg-amber-100 text-amber-600",
  "bg-pink-100 text-pink-600",
  "bg-cyan-100 text-cyan-600",
];

export function Resumes() {
  const { data: resumesData, isLoading } = useResumes();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const resumes = resumesData?.items ?? [];
  const categories = useMemo(() => ["all", ...new Set(resumes.map((r) => r.category))], [resumes]);

  const filtered = useMemo(() => {
    return resumes.filter((r) => {
      const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || r.category === filter;
      return matchSearch && matchFilter;
    });
  }, [resumes, search, filter]);

  const getCategoryColor = (category: string) => {
    const index = categories.filter((c) => c !== "all").indexOf(category);
    return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search resumes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors outline-none"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-border rounded-xl text-text-secondary outline-none focus:ring-2 focus:ring-accent/20"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "all" ? "All categories" : cat}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden soft-shadow">
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light bg-surface">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Category</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Source</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((resume: ResumeVariant) => (
                  <tr key={resume.name} className="border-b border-border-light last:border-0 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-xl">
                          <FileText size={14} className="text-text-muted" />
                        </div>
                        <div>
                          <p className="font-medium">{resume.name}</p>
                          <p className="text-xs text-text-muted">
                            {resume.source_file ?? "generated"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${getCategoryColor(resume.category)}`}>
                        {resume.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {resume.source_file ?? "---"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/api/resumes/${resume.id}/download`}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted hover:text-accent transition-colors"
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText size={32} className="text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm text-text-muted">No resumes found</p>
          </div>
        )}
      </div>
    </div>
  );
}
