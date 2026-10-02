"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen, Search, Calendar, Tag, Heart, MessageCircle } from "lucide-react";
import { blogService } from "@/services/blog.service";
import { useI18n } from "@/i18n/I18nProvider";
import type { ArticleListItem } from "@/types/blog.types";
import type { Metadata } from "next";

export default function BlogPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["blog"],
    queryFn: () => blogService.list().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const allTags = Array.from(new Set(articles.flatMap((a) => a.tags_list)));

  const filtered = articles.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q);
    const matchTag = !activeTag || a.tags_list.includes(activeTag);
    return matchSearch && matchTag;
  });

  return (
    <div className="min-h-screen bg-page">
      {/* Hero */}
      <div className="bg-univers text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/25 rounded-full px-4 py-1.5 text-sm text-white mb-6">
            <BookOpen size={14} /> {t.nav.news}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t.blog.title}
          </h1>
          <p className="text-white/85 text-lg max-w-xl mx-auto">
            {t.blog.intro}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Barre de recherche */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              placeholder={t.blog.searchPlaceholder}
              aria-label={t.blog.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-surface"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setActiveTag("")}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                  !activeTag ? "bg-brand-blue text-white" : "bg-surface border border-line text-fg-soft hover:bg-surface-muted"
                }`}
              >
                {t.portfolio.all}
              </button>
              {allTags.slice(0, 6).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
                  className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                    activeTag === tag ? "bg-brand-blue text-white" : "bg-surface border border-line text-fg-soft hover:bg-surface-muted"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Articles */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-line-soft overflow-hidden animate-pulse">
                <div className="h-44 bg-surface-strong" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-surface-strong rounded w-3/4" />
                  <div className="h-3 bg-surface-strong rounded w-full" />
                  <div className="h-3 bg-surface-strong rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-fg-subtle">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-fg-muted">
              {search || activeTag ? t.blog.empty : t.blog.emptyNone}
            </p>
            {(search || activeTag) && (
              <button
                onClick={() => { setSearch(""); setActiveTag(""); }}
                className="mt-3 text-sm text-brand-blue hover:underline"
              >
                {t.blog.resetFilters}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Article vedette (premier) */}
            {!search && !activeTag && filtered.length > 0 && (
              <FeaturedArticle article={filtered[0]} />
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              {(search || activeTag ? filtered : filtered.slice(1)).map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FeaturedArticle({ article }: { article: ArticleListItem }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group block bg-surface rounded-2xl border border-line-soft overflow-hidden hover:shadow-lg hover:border-brand-blue/20 transition-all duration-200"
    >
      <div className="sm:flex">
        <div className="sm:w-2/5 bg-surface-strong h-56 sm:h-auto relative overflow-hidden">
          {article.cover_image ? (
            <img
              src={article.cover_image}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-univers flex items-center justify-center">
              <BookOpen size={48} className="text-white/20" />
            </div>
          )}
          <div className="absolute top-3 left-3 bg-brand-orange text-ink text-xs font-bold px-2 py-1 rounded-full">
            {t.blog.featured}
          </div>
        </div>
        <div className="sm:w-3/5 p-6 sm:p-8 flex flex-col justify-center">
          {article.category && (
            <span className="text-xs font-semibold text-brand-blue uppercase tracking-wide mb-2">
              {article.category.name}
            </span>
          )}
          <h2 className="text-xl sm:text-2xl font-bold text-fg group-hover:text-brand-blue transition-colors leading-snug mb-3">
            {article.title}
          </h2>
          {article.excerpt && (
            <p className="text-fg-muted text-sm leading-relaxed line-clamp-3 mb-4">{article.excerpt}</p>
          )}
          <ArticleMeta article={article} />
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({ article }: { article: ArticleListItem }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group bg-surface rounded-2xl border border-line-soft overflow-hidden hover:shadow-md hover:border-brand-blue/20 transition-all duration-200 flex flex-col"
    >
      <div className="h-44 bg-surface-strong overflow-hidden relative">
        {article.cover_image ? (
          <img
            src={article.cover_image}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-univers flex items-center justify-center">
            <BookOpen size={36} className="text-white/20" />
          </div>
        )}
        {article.category && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-brand-blue text-xs font-semibold px-2 py-1 rounded-full">
            {article.category.name}
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-fg group-hover:text-brand-blue transition-colors leading-snug line-clamp-2 mb-2">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-fg-muted text-sm leading-relaxed line-clamp-3 flex-1 mb-4">
            {article.excerpt}
          </p>
        )}
        <ArticleMeta article={article} />
      </div>
    </Link>
  );
}

function ArticleMeta({ article }: { article: ArticleListItem }) {
  const { fmt } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
      {article.published_at && (
        <span className="flex items-center gap-1">
          <Calendar size={11} /> {fmt.date(article.published_at)}
        </span>
      )}
      {article.tags_list.slice(0, 2).map((tag) => (
        <span key={tag} className="flex items-center gap-1 text-brand-blue">
          <Tag size={10} /> {tag}
        </span>
      ))}
      <span className="flex items-center gap-1 ml-auto">
        <Heart size={11} /> {article.likes_count}
      </span>
      <span className="flex items-center gap-1">
        <MessageCircle size={11} /> {article.comments_count}
      </span>
    </div>
  );
}
