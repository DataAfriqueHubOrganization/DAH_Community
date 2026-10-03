"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Heart, MessageCircle, Newspaper, Plus, Search } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { blogService } from "@/services/blog.service";
import { isBureau } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import type { ArticleAdmin } from "@/types/blog.types";
import { articleState, plainText, type ArticleTab } from "@/features/news/articleState";

type Tab = ArticleTab;

/** Actualités (bureau) : article à la une, puis les autres en cartes. */
export default function ActualitesManagePage() {
  const { data: user, isLoading: loadingUser } = useCurrentUser();
  const { t } = useI18n();
  const x = t.newsAdmin;
  const [tab, setTab] = useState<Tab>("published");
  const [category, setCategory] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["articles", "manage"],
    queryFn: () => blogService.manage.list().then((r) => r.data),
    enabled: isBureau(user),
  });

  if (!loadingUser && !isBureau(user)) return <p className="text-fg-muted">{t.manageNews.restricted}</p>;

  const articles: ArticleAdmin[] = Array.isArray(data) ? data : data?.results ?? [];
  const byTab: Record<Tab, ArticleAdmin[]> = { published: [], scheduled: [], draft: [] };
  articles.forEach((a) => byTab[articleState(a)].push(a));
  byTab.published.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  byTab.scheduled.sort((a, b) => (a.published_at ?? "").localeCompare(b.published_at ?? ""));

  const categories = [...new Map(articles.filter((a) => a.category).map((a) => [a.category as number, a.category_name ?? ""])).entries()];
  const q = query.trim().toLowerCase();
  const shown = byTab[tab]
    .filter((a) => category === null || a.category === category)
    .filter((a) => !q || a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q));
  const featured = tab === "published" && category === null && !q ? shown[0] : undefined;
  const rest = featured ? shown.slice(1) : shown;

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-fg">{t.sidebar.news}</h1>
          <p className="text-sm text-fg-muted mt-1">{x.subtitle(byTab.published.length, byTab.scheduled.length, byTab.draft.length)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative w-full sm:w-64">
            <span className="sr-only">{x.search}</span>
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={x.search}
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </label>
          <Link href="/manage/actualites/new"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep">
            <Plus size={16} /> {x.create}
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t.sidebar.news} className="inline-flex gap-1.5 bg-surface rounded-2xl p-1.5 shadow-sm">
          {(["published", "scheduled", "draft"] as Tab[]).map((key) => (
            <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? "page" : undefined}
              className={cn("inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors",
                tab === key ? "bg-fg text-surface font-semibold" : "text-fg-muted hover:text-fg font-medium")}>
              {x.tabs[key]}
              <span className={cn("text-[11px] font-bold rounded-full px-2 py-0.5",
                tab === key ? "bg-surface/20" : key === "scheduled" && byTab.scheduled.length ? "bg-brand-orange/15 text-orange-800 dark:text-orange-300" : "bg-surface-strong text-fg-soft")}>
                {byTab[key].length}
              </span>
            </button>
          ))}
        </nav>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[[null, x.allCategories] as [number | null, string], ...categories].map(([id, name]) => (
              <button key={id ?? "all"} onClick={() => setCategory(id)} aria-pressed={category === id}
                className={cn("h-9 px-3.5 rounded-full text-sm font-semibold transition-colors",
                  category === id ? "bg-fg text-surface" : "bg-surface text-fg-soft shadow-sm hover:text-fg")}>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-5 animate-pulse">
          <div className="h-64 bg-surface rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{[0, 1, 2].map((i) => <div key={i} className="h-72 bg-surface rounded-3xl" />)}</div>
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-surface rounded-3xl shadow-sm py-16 text-center">
          <Newspaper size={40} className="mx-auto text-fg-faint" />
          <p className="text-fg-muted mt-3">{x.empty[tab]}</p>
        </div>
      ) : (
        <>
          {featured && <FeaturedArticle article={featured} />}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {rest.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CoverImage({ article, className, children }: { article: ArticleAdmin; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden bg-univers-brand", className)}>
      {article.cover_image
        ? <img src={article.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <NetworkPattern className="opacity-70" />}
      {children}
    </div>
  );
}

function StateLine({ article }: { article: ArticleAdmin }) {
  const { t, fmt } = useI18n();
  const x = t.newsAdmin;
  const state = articleState(article);
  if (state === "scheduled") return <>{x.scheduledFor(fmt.dateTime(article.published_at as string))}</>;
  if (state === "draft") return <>{x.draftSince(fmt.date(article.created_at))}</>;
  return <>{x.publishedOn(fmt.date(article.published_at ?? article.created_at), article.author_name ?? "")}</>;
}

function Stats({ article }: { article: ArticleAdmin }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-4 text-xs text-fg-muted">
      <span className="inline-flex items-center gap-1"><Heart size={13} /> {article.likes_count}</span>
      <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {t.newsAdmin.comments(article.comments_count)}</span>
    </span>
  );
}

function FeaturedArticle({ article }: { article: ArticleAdmin }) {
  const { t } = useI18n();
  const x = t.newsAdmin;
  return (
    <section className="bg-surface rounded-3xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      <CoverImage article={article} className="min-h-[240px]">
        <span className="absolute top-4 left-4 text-xs font-bold rounded-full px-3 py-1 bg-brand-orange text-ink">{x.featured}</span>
      </CoverImage>
      <div className="p-7 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {article.category_name && <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-brand-blue/10 text-brand-deep">{article.category_name}</span>}
          <span className="text-xs text-fg-muted"><StateLine article={article} /></span>
        </div>
        <h2 className="font-display text-2xl font-extrabold text-fg leading-tight">{article.title}</h2>
        <p className="text-sm text-fg-muted leading-relaxed line-clamp-3">{article.excerpt || plainText(article.content)}</p>
        <div className="mt-auto pt-2"><Stats article={article} /></div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/manage/actualites/${article.id}/edit`} className="h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold inline-flex items-center hover:bg-brand-deep">{x.edit}</Link>
          <Link href={`/blog/${article.slug}`} target="_blank" className="h-11 px-5 rounded-xl border border-line text-sm font-semibold text-fg-soft inline-flex items-center hover:bg-surface-muted">{x.view} ↗</Link>
        </div>
      </div>
    </section>
  );
}

function ArticleCard({ article }: { article: ArticleAdmin }) {
  const { t } = useI18n();
  const x = t.newsAdmin;
  const state = articleState(article);
  return (
    <Link href={`/manage/actualites/${article.id}/edit`} className="group bg-surface rounded-3xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <CoverImage article={article} className="h-36">
        {state !== "published" && (
          <span className={cn("absolute top-3 right-3 text-xs font-semibold rounded-full px-2.5 py-1",
            state === "scheduled" ? "bg-brand-orange text-ink" : "bg-white text-fg-soft")}>
            {x.tabs[state === "draft" ? "draft" : "scheduled"]}
          </span>
        )}
      </CoverImage>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between gap-2">
          {article.category_name
            ? <span className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-brand-blue/10 text-brand-deep">{article.category_name}</span>
            : <span />}
        </div>
        <h3 className="font-display font-extrabold text-fg leading-snug group-hover:text-brand-blue transition-colors">{article.title}</h3>
        <p className="text-sm text-fg-muted leading-relaxed line-clamp-2">{article.excerpt || plainText(article.content)}</p>
        <p className="text-xs text-fg-subtle mt-auto pt-2"><StateLine article={article} /></p>
        <div className="border-t border-line-soft pt-3 flex items-center justify-between">
          <Stats article={article} />
          <span className="text-sm font-semibold text-brand-blue">{x.edit}</span>
        </div>
      </div>
    </Link>
  );
}
