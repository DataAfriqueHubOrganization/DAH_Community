export interface ArticleCategory {
  id: number;
  name: string;
  slug: string;
}

export interface ArticleListItem {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  cover_image: string | null;
  category: ArticleCategory | null;
  tags_list: string[];
  published_at: string | null;
  comments_count: number;
  likes_count: number;
  is_liked_by_me: boolean;
}

export interface ArticleDetail extends ArticleListItem {
  content: string;
  seo_title: string;
  seo_description: string;
}

export interface ArticleComment {
  id: number;
  content: string;
  author_name: string | null;
  author_avatar: string | null;
  created_at: string;
  can_delete: boolean;
}

export interface LikeToggleResult {
  liked: boolean;
  likes_count: number;
}

export type ArticleStatus = "draft" | "scheduled" | "published";

export interface ArticleAdmin {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  cover_image: string | null;
  author_name: string | null;
  category: number | null;
  category_name: string | null;
  tags: string;
  status: ArticleStatus;
  published_at: string | null;
  seo_title: string;
  seo_description: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export interface ArticleWritePayload {
  title: string;
  content: string;
  excerpt?: string;
  category?: number | null;
  tags?: string;
  status: ArticleStatus;
  published_at?: string | null;
  seo_title?: string;
  seo_description?: string;
}
