import { useState, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Plus, Eye, Edit3, Trash2, Save, Upload, X, AlertTriangle,
  FileUp, Code, User, Briefcase, GraduationCap, Star, Layers, Sparkles
} from "lucide-react";
import { useResumes } from "@/hooks/useQueries";
import { createResume, updateResume, deleteResume, uploadResume, parseResumeFile, profileFromResume } from "@/api/client";
import { Button, Badge } from "@/components/ui";
import { LoadingSkeleton, CardSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { toast } from "@/components/common/Toast";
import { formatTimeAgo } from "@/lib/utils";
import type { ResumeVariant, ParsedResumeData } from "@/types";

const CATEGORIES = ["engineering", "data", "product", "devops", "design", "ml"] as const;

const CATEGORY_STYLES: Record<string, string> = {
  engineering: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  data: "bg-green-500/10 text-green-400 border-green-500/20",
  product: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  devops: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  design: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  ml: "bg-red-500/10 text-red-400 border-red-500/20",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? "bg-accent" : "bg-dark-700"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function ParsedDataSummary({ data }: { data: ParsedResumeData }) {
  const personal = data.personal || {};
  const skills = data.skills || {};
  const exp = data.experience || [];
  const edu = data.education?.highest || {};
  const projects = data.projects || [];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 text-dark-300">
        <User size={14} className="text-accent" />
        <span>{personal.full_name || "Unknown"}</span>
        {personal.email && <span className="text-dark-500">| {personal.email}</span>}
      </div>
      <div className="flex items-start gap-2 text-dark-300">
        <Code size={14} className="text-green-400 mt-0.5" />
        <div className="flex flex-wrap gap-1">
          {skills.primary?.slice(0, 8).map((s) => (
            <span key={s} className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">{s}</span>
          ))}
          {(skills.secondary?.length || 0) > 0 && (
            <span className="text-dark-500 text-xs">+{skills.secondary.length} more</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-1.5 text-dark-400">
          <Briefcase size={13} className="text-blue-400" />
          <span>{exp.length} experience{exp.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5 text-dark-400">
          <GraduationCap size={13} className="text-purple-400" />
          <span>{edu.degree || "N/A"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-dark-400">
          <Layers size={13} className="text-orange-400" />
          <span>{projects.length} projects</span>
        </div>
      </div>
    </div>
  );
}

export function Resumes() {
  const queryClient = useQueryClient();
  const { data: resumesData, isLoading } = useResumes();
  const resumes = resumesData?.items ?? [];

  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("engineering");
  const [uploadContent, setUploadContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [uploadMode, setUploadMode] = useState<"manual" | "pdf">("manual");
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResumeData | null>(null);
  const [showParsedPreview, setShowParsedPreview] = useState(false);

  const [previewTarget, setPreviewTarget] = useState<ResumeVariant | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [keywordsInput, setKeywordsInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const uploadTextareaRef = useRef<HTMLTextAreaElement>(null);

  const createMutation = useMutation({
    mutationFn: createResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      toast.getState().add("success", "Resume variant created");
      setShowUpload(false);
      resetUploadForm();
    },
    onError: () => toast.getState().add("error", "Failed to create resume variant"),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, name, category }: { file: File; name?: string; category?: string }) =>
      uploadResume(file, name, category),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      toast.getState().add("success", "Resume uploaded and parsed");
      setShowUpload(false);
      resetUploadForm();
    },
    onError: () => toast.getState().add("error", "Failed to upload resume"),
  });

  const profileFromResumeMutation = useMutation({
    mutationFn: (file: File) => profileFromResume(file),
    onSuccess: () => {
      toast.getState().add("success", "Profile updated from resume");
    },
    onError: () => toast.getState().add("error", "Failed to update profile from resume"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<ResumeVariant> }) =>
      updateResume(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      toast.getState().add("success", "Resume variant updated");
    },
    onError: () => toast.getState().add("error", "Failed to update resume variant"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteResume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      toast.getState().add("success", "Resume variant deleted");
      setConfirmDeleteId(null);
    },
    onError: () => toast.getState().add("error", "Failed to delete resume variant"),
  });

  function resetUploadForm() {
    setUploadName("");
    setUploadCategory("engineering");
    setUploadContent("");
    setFileName("");
    setDragOver(false);
    setUploadMode("manual");
    setParsedData(null);
    setShowParsedPreview(false);
  }

  async function handlePdfSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setParsedData(null);
    try {
      const result = await parseResumeFile(file);
      setParsedData(result.parsed_data);
      const name = result.parsed_data?.personal?.full_name || file.name.replace(/\.[^/.]+$/, "");
      setUploadName(name);
      toast.getState().add("success", "Resume parsed successfully");
    } catch (err) {
      toast.getState().add("error", "Failed to parse resume PDF");
    } finally {
      setParsing(false);
    }
  }

  async function handlePdfUpload() {
    const file = pdfInputRef.current?.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ file, name: uploadName || undefined, category: uploadCategory });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setFileName(file.name);
    if (file.name.endsWith(".pdf")) {
      setParsing(true);
      setParsedData(null);
      setUploadMode("pdf");
      parseResumeFile(file)
        .then((result) => {
          setParsedData(result.parsed_data);
          const name = result.parsed_data?.personal?.full_name || file.name.replace(/\.[^/.]+$/, "");
          setUploadName(name);
          toast.getState().add("success", "Resume parsed successfully");
        })
        .catch(() => toast.getState().add("error", "Failed to parse resume PDF"))
        .finally(() => setParsing(false));
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string ?? "";
        setUploadContent(text);
      };
      reader.readAsText(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.name.endsWith(".pdf")) {
      setParsing(true);
      setParsedData(null);
      setUploadMode("pdf");
      parseResumeFile(file)
        .then((result) => {
          setParsedData(result.parsed_data);
          const name = result.parsed_data?.personal?.full_name || file.name.replace(/\.[^/.]+$/, "");
          setUploadName(name);
          toast.getState().add("success", "Resume parsed successfully");
        })
        .catch(() => toast.getState().add("error", "Failed to parse resume PDF"))
        .finally(() => setParsing(false));
    } else {
      setUploadMode("manual");
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string ?? "";
        setUploadContent(text);
      };
      reader.readAsText(file);
    }
  }

  function handleCreate() {
    if (uploadMode === "pdf" && pdfInputRef.current?.files?.[0]) {
      handlePdfUpload();
      return;
    }
    if (!uploadName.trim() || !uploadContent.trim()) {
      toast.getState().add("warning", "Name and content are required");
      return;
    }
    createMutation.mutate({
      name: uploadName.trim(),
      category: uploadCategory,
      content: uploadContent,
      parsed_data: parsedData || undefined,
    });
  }

  function handleToggleActive(id: number, is_active: boolean) {
    updateMutation.mutate({ id, body: { is_active } });
  }

  function handleStartEdit(r: ResumeVariant) {
    setEditingId(r.id);
    setEditContent(r.content);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditContent("");
  }

  function handleSaveEdit(id: number) {
    if (!editContent.trim()) {
      toast.getState().add("warning", "Content cannot be empty");
      return;
    }
    updateMutation.mutate({ id, body: { content: editContent } });
    setEditingId(null);
  }

  const injectedPreview = useMemo(() => {
    if (!previewTarget) return "";
    const keywords = keywordsInput.split(",").map((k) => k.trim()).filter(Boolean);
    if (keywords.length === 0) return previewTarget.content;
    const joined = keywords.join(", ");
    return previewTarget.content.replace(/\{\{KEYWORDS\}\}/g, joined);
  }, [previewTarget, keywordsInput]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Resumes</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (resumes.length === 0 && !showUpload) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Resumes</h1>
          <Button onClick={() => setShowUpload(true)}><Plus size={16} /> New Variant</Button>
        </div>
        <EmptyState
          icon={FileText}
          title="No resume variants yet"
          description="Upload your PDF resume to auto-parse it, or create one manually"
          action={{ label: "Create Variant", onClick: () => setShowUpload(true) }}
        />
        {showUpload && renderUploadModal()}
      </div>
    );
  }

  function renderParsedPreview() {
    if (!parsedData) return null;
    return (
      <div className="border border-accent/20 bg-accent/5 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles size={14} className="text-accent" />
            Parsed Resume Data
          </h4>
          <button
            onClick={() => setShowParsedPreview(!showParsedPreview)}
            className="text-xs text-dark-400 hover:text-dark-300"
          >
            {showParsedPreview ? "Hide details" : "Show details"}
          </button>
        </div>
        <ParsedDataSummary data={parsedData} />
        {showParsedPreview && (
          <pre className="text-xs text-dark-400 font-mono max-h-60 overflow-y-auto bg-dark-900/50 rounded p-3 mt-2">
            {JSON.stringify(parsedData, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  function renderUploadModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowUpload(false)} />
        <div className="relative bg-surface rounded-xl border border-border w-full max-w-lg mx-4 p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Create Resume Variant</h2>
            <button onClick={() => setShowUpload(false)} className="p-1 rounded-lg hover:bg-dark-700 text-dark-400">
              <X size={18} />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setUploadMode("manual")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                uploadMode === "manual" ? "bg-accent text-white" : "bg-dark-800 text-dark-400 hover:text-dark-300"
              }`}
            >
              <Edit3 size={14} className="inline mr-1" /> Manual
            </button>
            <button
              onClick={() => setUploadMode("pdf")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                uploadMode === "pdf" ? "bg-accent text-white" : "bg-dark-800 text-dark-400 hover:text-dark-300"
              }`}
            >
              <FileUp size={14} className="inline mr-1" /> Upload PDF
            </button>
          </div>

          <div>
            <label className="block text-sm text-dark-400 mb-1.5">Name</label>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="e.g. Engineering v3"
              className="w-full px-3 py-2 bg-dark-800 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-dark-400 mb-1.5">Category</label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="w-full px-3 py-2 bg-dark-800 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-dark-400 mb-1.5">
              {uploadMode === "pdf" ? "Upload PDF Resume" : "Upload File"}
            </label>
            {uploadMode === "pdf" ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => pdfInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-accent bg-accent/5" : "border-border hover:border-dark-600"
                }`}
              >
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfSelect}
                />
                {parsing ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-dark-300">
                    <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full" />
                    Parsing resume...
                  </div>
                ) : fileName ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-dark-300">
                    <FileUp size={16} className="text-accent" />
                    {fileName}
                  </div>
                ) : (
                  <div className="text-sm text-dark-500">
                    <Upload size={24} className="mx-auto mb-2 text-dark-400" />
                    Drop PDF here or click to browse
                  </div>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-accent bg-accent/5" : "border-border hover:border-dark-600"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-dark-300">
                    <Upload size={16} className="text-accent" />
                    {fileName}
                  </div>
                ) : (
                  <div className="text-sm text-dark-500">
                    <Upload size={24} className="mx-auto mb-2 text-dark-400" />
                    Drop .txt or .pdf file here
                  </div>
                )}
              </div>
            )}
          </div>

          {parsedData && renderParsedPreview()}

          {uploadMode === "manual" && (
            <div>
              <label className="block text-sm text-dark-400 mb-1.5">Content</label>
              <textarea
                ref={uploadTextareaRef}
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                rows={10}
                placeholder="Paste resume content here..."
                className="w-full px-3 py-2 bg-dark-800 border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-accent resize-vertical"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={
                createMutation.isPending ||
                uploadMutation.isPending ||
                parsing ||
                (uploadMode === "pdf" ? !pdfInputRef.current?.files?.[0] : !uploadContent.trim())
              }
            >
              {createMutation.isPending || uploadMutation.isPending
                ? "Creating..."
                : uploadMode === "pdf"
                  ? "Upload & Parse"
                  : "Create Variant"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumes</h1>
          <p className="text-dark-400 text-sm mt-1">{resumes.length} variant{resumes.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowUpload(true)}><Plus size={16} /> New Variant</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resumes.map((r) => (
          <div key={r.id} className="bg-surface rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <Badge className={CATEGORY_STYLES[r.category] ?? ""}>{r.category}</Badge>
                <p className="text-sm font-medium mt-2 truncate">{r.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.parsed_data && <Sparkles size={12} className="text-accent" title="Has parsed data" />}
                <span className="text-[10px] text-dark-500">{wordCount(r.content)} words</span>
                <Toggle checked={r.is_active} onChange={(v) => handleToggleActive(r.id, v)} />
              </div>
            </div>

            {r.parsed_data && (
              <div className="bg-accent/5 rounded-lg p-2.5">
                <ParsedDataSummary data={r.parsed_data} />
              </div>
            )}

            {r.source_file && (
              <p className="text-[10px] text-dark-500 flex items-center gap-1">
                <FileUp size={10} /> {r.source_file}
              </p>
            )}

            <p className="text-[11px] text-dark-500">
              Updated {r.updated_at ? formatTimeAgo(r.updated_at) : formatTimeAgo(r.created_at)}
            </p>

            {editingId === r.id ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 bg-dark-800 border border-border rounded-lg text-xs font-mono focus:outline-none focus:border-accent resize-vertical"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit}><X size={14} /> Cancel</Button>
                  <Button size="sm" onClick={() => handleSaveEdit(r.id)}><Save size={14} /> Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setPreviewTarget(r)}>
                  <Eye size={14} /> Preview
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleStartEdit(r)}>
                  <Edit3 size={14} /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(r.id)} className="text-red-400 hover:text-red-300">
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            )}

            {confirmDeleteId === r.id && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <span className="text-xs text-dark-400 flex-1">Delete this variant?</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? "..." : "Delete"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {previewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setPreviewTarget(null); setKeywordsInput(""); }} />
          <div className="relative bg-surface rounded-xl border border-border w-full max-w-2xl mx-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold">{previewTarget.name}</h2>
                <Badge className={CATEGORY_STYLES[previewTarget.category] ?? ""}>{previewTarget.category}</Badge>
              </div>
              <button onClick={() => { setPreviewTarget(null); setKeywordsInput(""); }} className="p-1 rounded-lg hover:bg-dark-700 text-dark-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <pre className="text-sm font-mono whitespace-pre-wrap text-dark-300 leading-relaxed">{injectedPreview}</pre>
              <div className="border-t border-border pt-4 space-y-2">
                <label className="text-xs text-dark-500 font-medium">Keyword Injection Preview</label>
                <input
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  placeholder="Enter sample keywords, comma-separated..."
                  className="w-full px-3 py-2 bg-dark-800 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                />
                {keywordsInput.trim() && (
                  <p className="text-xs text-dark-400">
                    Keywords: <span className="text-accent">{keywordsInput.split(",").map((k) => k.trim()).filter(Boolean).join(", ")}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showUpload && renderUploadModal()}
    </div>
  );
}
