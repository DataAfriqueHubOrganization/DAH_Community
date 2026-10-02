"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useAuth";
import { blogService } from "@/services/blog.service";
import { isBureau } from "@/types/auth.types";
import { toDatetimeLocalValue } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { Newspaper, Plus, Edit2, Trash2, X } from "lucide-react";
import type { ArticleAdmin, ArticleWritePayload, ArticleStatus } from "@/types/blog.types";

const emptyForm: ArticleWritePayload = {
  title: "", content: "", excerpt: "", category: null, tags: "", status: "draft", published_at: "",
};

// Libellés : t.manageNews.status[...]
const STATUS_OPTIONS: ArticleStatus[] = ["draft", "scheduled", "published"];

const STATUS_VARIANT: Record<ArticleStatus, "gray" | "orange" | "green"> = {
  draft: "gray",
  scheduled: "orange",
  published: "green",
};

export default function ActualitesManagePage() {
  const { data: user } = useCurrentUser();
  const { t, fmt } = useI18n();
  const x = t.manageNews;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleAdmin | null>(null);
  const [form, setForm] = useState<ArticleWritePayload>(emptyForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const canManage = isBureau(user);

  const { data, isLoading } = useQuery({
    queryKey: ["articles", "manage"],
    queryFn: () => blogService.manage.list().then((r) => r.data),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["article-categories"],
    queryFn: () => blogService.categories.list().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const createArticle = useMutation({
    mutationFn: (data: ArticleWritePayload | FormData) => blogService.manage.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["articles"] }); closeForm(); },
  });

  const updateArticle = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ArticleWritePayload> | FormData }) =>
      blogService.manage.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["articles"] }); closeForm(); },
  });

  const deleteArticle = useMutation({
    mutationFn: (id: number) => blogService.manage.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["articles"] }),
  });

  function closeForm() {
    setShowForm(false);
    setEditingArticle(null);
    setForm(emptyForm);
    setCoverFile(null);
  }

  function openCreateForm() {
    setEditingArticle(null);
    setForm(emptyForm);
    setCoverFile(null);
    setShowForm(true);
  }

  function openEditForm(article: ArticleAdmin) {
    setEditingArticle(article);
    setForm({
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      category: article.category,
      tags: article.tags,
      status: article.status,
      published_at: toDatetimeLocalValue(article.published_at),
      seo_title: article.seo_title,
      seo_description: article.seo_description,
    });
    setCoverFile(null);
    setShowForm(true);
  }

  function handleSubmit() {
    let payload: ArticleWritePayload | FormData = form;
    if (coverFile) {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") formData.append(key, String(value));
      });
      formData.append("cover_image", coverFile);
      payload = formData;
    }
    if (editingArticle) {
      updateArticle.mutate({ id: editingArticle.id, data: payload });
    } else {
      createArticle.mutate(payload);
    }
  }

  const categories = categoriesData ?? [];
  const articles: ArticleAdmin[] = Array.isArray(data) ? data : data?.results ?? [];

  if (!canManage) {
    return <p className="text-fg-muted">{x.restricted}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t.sidebar.news}</h1>
          <p className="text-fg-muted text-sm mt-1">{x.count(articles.length)}</p>
        </div>
        <button onClick={openCreateForm} className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">
          <Plus size={16} /> {x.newArticle}
        </button>
      </div>

      {showForm && (
        <div className="bg-surface rounded-2xl border border-brand-blue/20 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">
              {editingArticle ? t.manageEvents.editTitle(editingArticle.title) : x.newArticle}
            </h2>
            <button onClick={closeForm} aria-label={t.common.close} className="text-fg-subtle hover:text-fg-soft"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              placeholder={`${t.manageEvents.title} *`}
              aria-label={t.manageEvents.title}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="sm:col-span-2 border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
            <textarea
              placeholder={x.excerpt}
              aria-label={x.excerpt}
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              rows={2}
              className="sm:col-span-2 border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
            />
            <textarea
              placeholder={`${x.content} *`}
              aria-label={x.content}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={8}
              className="sm:col-span-2 border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
            />
            <div>
              <label className="block text-xs text-fg-muted mb-1">{x.category}</label>
              <select
                value={form.category ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value ? Number(e.target.value) : null }))}
                className="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface"
              >
                <option value="">{x.noCategory}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <input
              placeholder={x.tags}
              aria-label={x.tags}
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              className="border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t.common.status}</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ArticleStatus }))}
                className="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface"
              >
                {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{x.status[o]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{x.publishDate}</label>
              <input
                type="datetime-local"
                value={form.published_at ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))}
                className="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
              <p className="text-xs text-fg-subtle mt-1">{x.publishDateHint}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-fg-muted mb-1">{x.coverImage}</label>
              {editingArticle?.cover_image && !coverFile && (
                <img src={editingArticle.cover_image} alt={t.manageEvents.currentCover} className="w-full h-32 object-cover rounded-lg mb-2 border border-line" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-blue/10 file:text-brand-blue file:text-sm file:font-medium hover:file:bg-brand-blue/20 border border-line rounded-xl"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={createArticle.isPending || updateArticle.isPending || !form.title || !form.content}
                className="px-6 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createArticle.isPending || updateArticle.isPending
                  ? t.common.saving
                  : editingArticle ? t.manageEvents.saveChanges : x.createSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-surface rounded-xl border border-line-soft p-5 h-20 animate-pulse" />)}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper size={48} className="mx-auto text-fg-faint mb-4" />
          <p className="text-fg-muted font-medium">{x.none}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <div key={article.id} className="bg-surface rounded-xl border border-line-soft p-4 flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0 overflow-hidden">
                {article.cover_image ? (
                  <img src={article.cover_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Newspaper size={18} className="text-fg" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-fg text-sm truncate">{article.title}</p>
                <div className="flex items-center flex-wrap gap-2 mt-1">
                  <Badge variant={STATUS_VARIANT[article.status]}>{x.status[article.status]}</Badge>
                  {article.category_name && <span className="text-xs text-fg-subtle">{article.category_name}</span>}
                  {article.published_at && <span className="text-xs text-fg-subtle">{fmt.dateTime(article.published_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => openEditForm(article)} title={t.common.edit} aria-label={t.common.edit} className="p-2 text-fg-subtle hover:text-brand-blue rounded-lg hover:bg-surface-muted"><Edit2 size={16} /></button>
                <button
                  onClick={() => { if (confirm(x.confirmDelete(article.title))) deleteArticle.mutate(article.id); }}
                  title={t.common.delete}
                  aria-label={t.common.delete}
                  className="p-2 text-fg-subtle hover:text-red-500 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
