"use client";

import { useCurrentUser } from "@/hooks/useAuth";
import { isBureau } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { ArticleEditor } from "@/features/news/ArticleEditor";

export default function NewArticlePage() {
  const { data: user, isLoading } = useCurrentUser();
  const { t } = useI18n();
  if (isLoading) return <div className="h-40 bg-surface rounded-3xl animate-pulse" />;
  if (!isBureau(user)) return <p className="text-fg-muted">{t.manageNews.restricted}</p>;
  return <ArticleEditor article={null} />;
}
