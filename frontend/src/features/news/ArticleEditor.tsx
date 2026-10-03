"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { blogService } from "@/services/blog.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn, toDatetimeLocalValue } from "@/lib/utils";
import { RichTextEditor } from "@/components/RichTextEditor";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import { apiError } from "@/features/treasury/shared";
import type { ArticleAdmin, ArticleStatus } from "@/types/blog.types";
import { plainText } from "./articleState";

interface FormState {
  title: string;
  content: string;
  excerpt: string;
  category: number | null;
  tags: string[];
  status: ArticleStatus;
  published_at: string;
  seo_title: string;
  seo_description: string;
}

function initialState(a: ArticleAdmin | null): FormState {
  return {
    title: a?.title ?? "",
    content: a?.content ?? "",
    excerpt: a?.excerpt ?? "",
    category: a?.category ?? null,
    tags: a?.tags ? a.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
    status: a?.status ?? "draft",
    published_at: toDatetimeLocalValue(a?.published_at ?? null),
    seo_title: a?.seo_title ?? "",
    seo_description: a?.seo_description ?? "",
  };
}

/** Éditeur d'article centré sur l'écriture : couverture, grand titre, texte mis
 *  en forme comme sur le site ; réglages de publication sur la droite. */
export function ArticleEditor({ article }: { article: ArticleAdmin | null }) {
  const { t, intl } = useI18n();
  const x = t.newsAdmin;
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialState(article));
  const [cover, setCover] = useState<File | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [showSeo, setShowSeo] = useState(!!(article?.seo_title || article?.seo_description));
  const [preview, setPreview] = useState(false);

  const coverUrl = useMemo(() => (cover ? URL.createObjectURL(cover) : article?.cover_image ?? null), [cover, article]);
  useEffect(() => () => { if (cover && coverUrl) URL.revokeObjectURL(coverUrl); }, [cover, coverUrl]);

  const { data: categories = [] } = useQuery({
    queryKey: ["article-categories"],
    queryFn: () => blogService.categories.list().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const createCategory = useMutation({
    mutationFn: (name: string) => blogService.categories.create(name),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["article-categories"] });
      set("category", data.id);
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const data = new FormData();
      const values: Record<string, string> = {
        title: form.title,
        content: form.content,
        excerpt: form.excerpt,
        category: form.category ? String(form.category) : "",
        tags: form.tags.join(", "),
        status: form.status,
        // Brouillon : pas de date ; publié sans date : l'API met maintenant.
        published_at: form.status === "draft" ? "" : form.published_at,
        seo_title: form.seo_title,
        seo_description: form.seo_description,
      };
      Object.entries(values).forEach(([k, v]) => data.append(k, v));
      if (cover) data.append("cover_image", cover);
      return article ? blogService.manage.update(article.id, data) : blogService.manage.create(data);
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.setQueryData(["article-admin", String(data.id)], data);
      setForm((f) => ({ ...f, published_at: toDatetimeLocalValue(data.published_at) }));
      setCover(null);
      setDirty(false);
      setSavedAt(new Date());
      if (!article) router.replace(`/manage/actualites/${data.id}/edit`);
    },
  });

  const remove = useMutation({
    mutationFn: () => blogService.manage.delete(article!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["articles"] }); router.push("/manage/actualites"); },
  });

  const addTag = () => {
    const tag = tagDraft.trim().replace(/,$/, "");
    if (tag && !form.tags.includes(tag)) set("tags", [...form.tags, tag]);
    setTagDraft("");
  };

  const canSave = !!form.title.trim() && !!plainText(form.content) && (form.status !== "scheduled" || !!form.published_at);
  const wasPublished = article?.status === "published";
  const primary = form.status === "draft" ? x.saveDraft : form.status === "scheduled" ? x.schedule : wasPublished ? x.update : x.publish;
  const status = save.isPending ? t.common.saving : dirty ? x.unsaved
    : savedAt ? x.savedAt(savedAt.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })) : "";

  const seoTitle = form.seo_title || form.title || x.titlePlaceholder;
  const seoText = form.seo_description || form.excerpt || plainText(form.content).slice(0, 160);
  const slug = article?.slug ?? (form.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "…");

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link href="/manage/actualites" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-brand-blue">
          <ArrowLeft size={14} /> {x.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {status && <span className={cn("text-xs mr-1", dirty ? "text-orange-700 dark:text-orange-300" : "text-fg-muted")}>{status}</span>}
          <button onClick={() => setPreview(true)} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-soft hover:bg-surface-muted">
            <Eye size={15} /> {x.preview}
          </button>
          <button onClick={() => save.mutate()} disabled={!canSave || save.isPending}
            className={cn("h-11 px-5 rounded-xl text-sm font-bold disabled:opacity-50",
              form.status === "scheduled" ? "bg-brand-orange text-ink hover:brightness-95" : "bg-brand-blue text-white shadow-lg shadow-brand-blue/25 hover:bg-brand-deep")}>
            {primary}
          </button>
        </div>
      </header>
      {save.isError && <p className="text-sm text-red-600" role="alert">{apiError(save.error, x.missing)}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Écriture */}
        <article className="bg-surface rounded-3xl shadow-sm overflow-hidden">
          <CoverDrop url={coverUrl} onFile={(f) => { setCover(f); setDirty(true); }} label={coverUrl ? x.coverChange : x.coverAdd} />
          <div className="px-6 sm:px-11 pt-8 pb-10">
            <textarea
              value={form.title}
              onChange={(e) => set("title", e.target.value.replace(/\n/g, " "))}
              placeholder={x.titlePlaceholder}
              aria-label={x.titlePlaceholder}
              rows={1}
              onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
              className="w-full resize-none overflow-hidden bg-transparent font-display text-[32px] sm:text-[34px] leading-tight font-extrabold tracking-tight text-fg placeholder:text-fg-faint focus:outline-none"
            />
            <div className="mt-5">
              <RichTextEditor value={form.content} onChange={(html) => set("content", html)} placeholder={x.writePlaceholder}
                variant="document" minHeight={360} label={t.manageNews.content} />
            </div>
          </div>
        </article>

        {/* Réglages */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <Panel title={x.publication}>
            <div role="radiogroup" aria-label={x.publication} className="grid grid-cols-3 gap-1 bg-surface-muted rounded-xl p-1">
              {(["draft", "scheduled", "published"] as ArticleStatus[]).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={form.status === s} onClick={() => set("status", s)}
                  className={cn("h-9 rounded-lg text-[13px] transition-all",
                    form.status === s
                      ? cn("bg-surface shadow-sm font-bold", s === "scheduled" ? "text-orange-800 dark:text-orange-300" : s === "published" ? "text-green-700 dark:text-green-400" : "text-fg")
                      : "text-fg-muted hover:text-fg")}>
                  {x.modes[s]}
                </button>
              ))}
            </div>
            {form.status === "scheduled" && (
              <input type="datetime-local" value={form.published_at} onChange={(e) => set("published_at", e.target.value)} aria-label={x.schedule}
                className="w-full h-11 px-3.5 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            )}
            <p className="text-xs text-fg-muted">{form.status === "scheduled" ? x.scheduleHint : form.status === "published" ? x.publishHint : x.draftHint}</p>
          </Panel>

          <Panel title={x.category}>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button key={c.id} type="button" onClick={() => set("category", form.category === c.id ? null : c.id)} aria-pressed={form.category === c.id}
                  className={cn("h-8 px-3 rounded-full text-[13px] font-semibold transition-colors",
                    form.category === c.id ? "bg-brand-blue text-white" : "bg-surface-muted text-fg-soft hover:bg-surface-strong")}>
                  {c.name}
                </button>
              ))}
              <button type="button" onClick={() => { const name = window.prompt(x.newCategoryPrompt)?.trim(); if (name) createCategory.mutate(name); }}
                className="h-8 px-3 rounded-full text-[13px] font-semibold border border-dashed border-line text-fg-muted hover:text-fg inline-flex items-center gap-1">
                <Plus size={13} /> {x.newCategory}
              </button>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted pt-1">{x.tags}</p>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-line px-2 py-2 focus-within:ring-2 focus-within:ring-brand-blue/20">
              {form.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-brand-blue/10 text-brand-deep text-xs font-semibold">
                  {tag}
                  <button type="button" onClick={() => set("tags", form.tags.filter((t2) => t2 !== tag))} aria-label={x.removeTag(tag)}
                    className="w-5 h-5 rounded-full hover:bg-brand-blue/15 flex items-center justify-center"><X size={11} /></button>
                </span>
              ))}
              <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder={x.tagsPlaceholder} aria-label={x.tags}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
                  if (e.key === "Backspace" && !tagDraft && form.tags.length) set("tags", form.tags.slice(0, -1));
                }}
                onBlur={addTag}
                className="flex-1 min-w-[110px] h-7 px-1 bg-transparent text-sm focus:outline-none" />
            </div>
          </Panel>

          <Panel title={x.excerpt} aside={`${form.excerpt.length} / 500`}>
            <textarea value={form.excerpt} onChange={(e) => set("excerpt", e.target.value.slice(0, 500))} rows={3} aria-label={x.excerpt}
              placeholder={x.excerptHint}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </Panel>

          <Panel title={x.google}>
            <div className="space-y-1">
              <p className="text-xs text-green-700 dark:text-green-400 truncate">dataafriquehub · blog › {slug}</p>
              <p className="text-base text-brand-deep leading-snug line-clamp-2">{seoTitle.slice(0, 70)}</p>
              <p className="text-[13px] text-fg-muted leading-relaxed line-clamp-2">{seoText.slice(0, 160)}</p>
            </div>
            {showSeo ? (
              <div className="space-y-2 pt-1">
                <input value={form.seo_title} onChange={(e) => set("seo_title", e.target.value.slice(0, 70))} placeholder={x.seoTitle} aria-label={x.seoTitle}
                  className="w-full h-10 px-3 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                <textarea value={form.seo_description} onChange={(e) => set("seo_description", e.target.value.slice(0, 160))} rows={2}
                  placeholder={x.seoDescription} aria-label={x.seoDescription}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
              </div>
            ) : (
              <button type="button" onClick={() => setShowSeo(true)} className="text-xs font-semibold text-brand-blue hover:underline">{x.customizeSeo}</button>
            )}
          </Panel>

          {article && (
            <button onClick={() => { if (confirm(t.manageNews.confirmDelete(article.title))) remove.mutate(); }}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
              <Trash2 size={15} /> {x.deleteArticle}
            </button>
          )}
        </aside>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={x.preview}
          onClick={() => setPreview(false)}>
          <article className="bg-surface rounded-3xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-64 bg-univers-brand">
              {coverUrl ? <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <NetworkPattern className="opacity-70" />}
              <button onClick={() => setPreview(false)} autoFocus aria-label={t.common.close} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 text-ink flex items-center justify-center"><X size={18} /></button>
            </div>
            <div className="px-8 sm:px-12 py-10">
              <h1 className="font-display text-3xl font-extrabold text-fg leading-tight">{form.title || x.titlePlaceholder}</h1>
              {form.excerpt && <p className="text-lg text-fg-muted mt-3">{form.excerpt}</p>}
              <div className="rich-content text-[17px] mt-6" dangerouslySetInnerHTML={{ __html: form.content }} />
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

function Panel({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface rounded-3xl shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{title}</h2>
        {aside && <span className="text-xs text-fg-subtle">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function CoverDrop({ url, onFile, label }: { url: string | null; onFile: (f: File) => void; label: string }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) onFile(f); }}
      className={cn("relative block cursor-pointer overflow-hidden", url ? "h-60" : "h-40",
        !url && (dragging ? "bg-brand-blue/15" : "bg-surface-muted hover:bg-brand-blue/[0.06]"))}
    >
      {url ? (
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold text-fg-muted">
          <ImagePlus size={18} /> {label}
        </span>
      )}
      {url && (
        <span className="absolute bottom-4 right-4 h-9 px-3.5 rounded-xl bg-white/95 text-ink text-sm font-semibold inline-flex items-center gap-2 shadow-md">
          <ImagePlus size={15} /> {label}
        </span>
      )}
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </label>
  );
}
