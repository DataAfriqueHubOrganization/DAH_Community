import type { ArticleAdmin } from "@/types/blog.types";

export type ArticleTab = "published" | "scheduled" | "draft";

/** Un article programmé dont la date est passée est en ligne (voir Article.objects.live()). */
export function articleState(a: Pick<ArticleAdmin, "status" | "published_at">): ArticleTab {
  if (a.status === "draft") return "draft";
  if (a.status === "scheduled" && a.published_at && new Date(a.published_at) > new Date()) return "scheduled";
  return "published";
}

/** Texte brut d'un contenu HTML (extraits, compteurs). */
export function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
