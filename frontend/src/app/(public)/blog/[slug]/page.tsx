"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Calendar, Tag, BookOpen, Heart, MessageCircle, Trash2 } from "lucide-react";
import { blogService } from "@/services/blog.service";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { useCurrentUser } from "@/hooks/useAuth";
import type { User as AuthUser } from "@/types/auth.types";

function extractErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { t, fmt } = useI18n();
  const { data: currentUser } = useCurrentUser();

  const { data: article, isLoading, isError } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => blogService.get(slug).then((r) => r.data),
  });

  if (isLoading) return <ArticleSkeleton />;

  if (isError || !article) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-6xl font-bold text-fg-faint mb-4">404</p>
          <p className="text-fg-muted mb-6">{t.article.notFound}</p>
          <Link href="/blog" className="px-6 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            ← {t.article.backToBlog}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Cover */}
      {article.cover_image ? (
        <div className="w-full h-72 sm:h-96 overflow-hidden">
          <img
            src={article.cover_image}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-48 bg-univers" />
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-8 pb-16">
        {/* Card article */}
        <div className="bg-surface rounded-2xl shadow-sm border border-line-soft overflow-hidden">
          <div className="p-6 sm:p-10">
            {/* Back + Category */}
            <div className="flex items-center gap-3 mb-6">
              <Link
                href="/blog"
                className="flex items-center gap-1.5 text-sm text-fg-subtle hover:text-brand-blue transition-colors"
              >
                <ArrowLeft size={14} /> {t.nav.news}
              </Link>
              {article.category && (
                <>
                  <span className="text-fg-faint">/</span>
                  <span className="text-sm font-semibold text-brand-blue">{article.category.name}</span>
                </>
              )}
            </div>

            {/* Titre */}
            <h1 className="text-3xl sm:text-4xl font-bold text-fg leading-tight mb-5">
              {article.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-subtle pb-6 border-b border-line-soft mb-8">
              {article.published_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} /> {fmt.date(article.published_at)}
                </span>
              )}
              {article.tags_list.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag size={13} className="text-brand-blue" />
                  {article.tags_list.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-brand-blue/8 text-brand-blue text-xs font-medium rounded-full border border-brand-blue/15">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Extrait */}
            {article.excerpt && (
              <p className="text-lg text-fg-soft leading-relaxed mb-8 font-medium border-l-4 border-brand-orange pl-4">
                {article.excerpt}
              </p>
            )}

            {/* Contenu */}
            <div
              className="rich-content text-[17px]"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* Like + compteur commentaires */}
            <div className="flex items-center gap-4 mt-10 pt-6 border-t border-line-soft">
              <LikeButton slug={slug} isLiked={article.is_liked_by_me} likesCount={article.likes_count} isAuthenticated={!!currentUser} />
              <span className="flex items-center gap-1.5 text-sm text-fg-subtle">
                <MessageCircle size={16} /> {t.article.comments(article.comments_count)}
              </span>
            </div>
          </div>
        </div>

        {/* Commentaires */}
        <div className="bg-surface rounded-2xl shadow-sm border border-line-soft p-6 sm:p-10 mt-6">
          <CommentsSection slug={slug} currentUser={currentUser} />
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-surface border border-line text-fg-soft rounded-xl text-sm font-medium hover:bg-surface-muted hover:border-brand-blue/30 transition-all"
          >
            <BookOpen size={15} /> {t.article.allArticles}
          </Link>
        </div>
      </div>
    </div>
  );
}

function LikeButton({
  slug, isLiked, likesCount, isAuthenticated,
}: {
  slug: string;
  isLiked: boolean;
  likesCount: number;
  isAuthenticated: boolean;
}) {
  const qc = useQueryClient();
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: () => blogService.likes.toggle(slug).then((r) => r.data),
    onSuccess: (result) => {
      qc.setQueryData(["article", slug], (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        return { ...prev, is_liked_by_me: result.liked, likes_count: result.likes_count };
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-fg-subtle">
        <Heart size={16} /> {t.article.likes(likesCount)}
      </span>
    );
  }

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
        isLiked
          ? "bg-red-50 border-red-200 text-red-500"
          : "bg-surface border-line text-fg-muted hover:border-red-200 hover:text-red-500"
      }`}
    >
      <Heart size={16} className={isLiked ? "fill-red-500" : ""} /> {likesCount}
    </button>
  );
}

function CommentsSection({
  slug, currentUser,
}: {
  slug: string;
  currentUser: AuthUser | undefined;
}) {
  const qc = useQueryClient();
  const { t, fmt } = useI18n();
  const [content, setContent] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["article-comments", slug],
    queryFn: () => blogService.comments.list(slug).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (text: string) => blogService.comments.create(slug, text).then((r) => r.data),
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["article-comments", slug] });
      qc.invalidateQueries({ queryKey: ["article", slug] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => blogService.comments.delete(slug, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["article-comments", slug] });
      qc.invalidateQueries({ queryKey: ["article", slug] });
    },
  });

  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-bold text-fg mb-6">
        <MessageCircle size={19} /> {t.article.commentsTitle}
      </h2>

      {currentUser ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (content.trim()) createMutation.mutate(content.trim());
          }}
          className="flex gap-3 mb-8"
        >
          <img
            src={currentUser.avatar ?? avatarUrl(currentUser.full_name, 40)}
            alt={currentUser.full_name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
              placeholder={t.article.commentPlaceholder}
              aria-label={t.article.commentPlaceholder}
              className="w-full border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none"
            />
            {createMutation.isError && (
              <p className="text-red-500 text-xs mt-1">{extractErrorMessage(createMutation.error, t.common.error)}</p>
            )}
            <button
              type="submit"
              disabled={createMutation.isPending || !content.trim()}
              className="mt-2 px-4 py-1.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? t.common.sending : t.article.publish}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-fg-subtle mb-8">
          <Link href="/login" className="text-brand-blue hover:underline">{t.article.loginLink}</Link> {t.article.loginToComment}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-fg-subtle">{t.article.loadingComments}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-fg-subtle">{t.article.noComments}</p>
      ) : (
        <div className="space-y-5">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <img
                src={comment.author_avatar ?? avatarUrl(comment.author_name ?? "?", 40)}
                alt={comment.author_name ?? ""}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1 bg-surface-muted rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">{comment.author_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fg-subtle">{fmt.dateTime(comment.created_at)}</span>
                    {comment.can_delete && (
                      <button
                        onClick={() => deleteMutation.mutate(comment.id)}
                        disabled={deleteMutation.isPending}
                        className="text-fg-faint hover:text-red-500 transition-colors"
                        title={t.common.delete}
                        aria-label={t.common.delete}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-fg-soft mt-1 whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleSkeleton() {
  return (
    <div className="min-h-screen bg-page">
      <div className="w-full h-72 bg-surface-strong animate-pulse" />
      <div className="max-w-3xl mx-auto px-4 -mt-8 pb-16">
        <div className="bg-surface rounded-2xl shadow-sm border border-line-soft p-10 space-y-5 animate-pulse">
          <div className="h-4 bg-surface-strong rounded w-32" />
          <div className="h-10 bg-surface-strong rounded w-4/5" />
          <div className="h-4 bg-surface-strong rounded w-56" />
          <div className="h-px bg-surface-strong" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 bg-surface-strong rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
