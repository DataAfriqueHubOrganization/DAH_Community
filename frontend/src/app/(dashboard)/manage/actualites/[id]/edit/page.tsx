"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { blogService } from "@/services/blog.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { hasSection } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { ArticleEditor } from "@/features/news/ArticleEditor";

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: user, isLoading: loadingUser } = useCurrentUser();
  const { t } = useI18n();
  const { data: article, isLoading, isError } = useQuery({
    queryKey: ["article-admin", id],
    queryFn: () => blogService.manage.get(Number(id)).then((r) => r.data),
    enabled: hasSection(user, "news"),
  });

  if (loadingUser || isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 animate-pulse">
        <div className="h-[600px] bg-surface rounded-3xl" />
        <div className="h-96 bg-surface rounded-3xl" />
      </div>
    );
  }
  if (!hasSection(user, "news")) return <p className="text-fg-muted">{t.manageNews.restricted}</p>;
  if (isError || !article) return <p className="text-fg-muted">{t.common.error}</p>;
  return <ArticleEditor key={article.id} article={article} />;
}
