import { useState } from "react";
import { useResumes } from "@/hooks/useQueries";
import { Button, Badge } from "@/components/ui";
import { FileText, Plus, Eye, Edit3 } from "lucide-react";

export function Resumes() {
  const { data } = useResumes();
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumes</h1>
          <p className="text-dark-400 text-sm mt-1">Manage resume variants and templates</p>
        </div>
        <Button variant="primary" size="sm">
          <Plus size={16} /> New Variant
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.items.map((r) => (
          <div
            key={r.id}
            className="bg-surface rounded-xl border border-border p-5 hover:border-dark-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-dark-700 text-accent">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-dark-500 capitalize">{r.category}</p>
                </div>
              </div>
              <Badge variant={r.is_active ? "success" : "default"}>
                {r.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-dark-400 line-clamp-3 mb-3 font-mono">
              {r.content.slice(0, 200)}...
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPreview({ name: r.name, content: r.content })}
              >
                <Eye size={14} /> Preview
              </Button>
              <Button variant="ghost" size="sm">
                <Edit3 size={14} />
              </Button>
            </div>
          </div>
        ))}
        {(!data?.items || data.items.length === 0) && (
          <div className="col-span-full text-center py-12 text-dark-500">
            <FileText size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No resume variants yet</p>
            <p className="text-xs mt-1">Create one to get started</p>
          </div>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-dark-800 rounded-xl border border-border max-w-2xl w-full max-h-[80vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{preview.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
            <pre className="text-sm text-dark-300 font-mono whitespace-pre-wrap">{preview.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
