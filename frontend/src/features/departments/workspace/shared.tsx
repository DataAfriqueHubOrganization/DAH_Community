"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { avatarUrl, cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import type { CheckInStatus } from "@/types/engagement.types";
import type { ProjectTask } from "@/types/projects.types";
import { todayIso } from "@/features/engagement/period";

export type WorkspaceTab = "today" | "projects" | "team" | "tasks";
export type ViewerMode = "manager" | "membre" | "visiteur";
export interface Assignee { id: number; name: string }

/** Statuts encore « ouverts » côté assigné (ni rendus, ni validés). */
export const OPEN_STATUSES: ProjectTask["status"][] = ["todo", "in_progress", "blocked"];

export function isLate(task: ProjectTask): boolean {
  return !!task.due_date && OPEN_STATUSES.includes(task.status) && task.due_date < todayIso();
}

/** 1er du mois courant (YYYY-MM-01). */
export function currentMonthStart(): string {
  return `${todayIso().slice(0, 7)}-01`;
}

export const CHECKIN_PILL: Record<CheckInStatus, string> = {
  pending: "bg-surface-strong text-fg-soft",
  submitted: "bg-brand-orange/15 text-orange-800 dark:text-orange-300",
  confirmed: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  cancelled: "bg-surface-strong text-fg-subtle line-through",
};

export function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center text-xs font-medium rounded-full px-2.5 py-1 whitespace-nowrap", className)}>{children}</span>;
}

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  return (
    <img
      src={src || avatarUrl(name, size * 2)}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-full shrink-0 object-cover"
    />
  );
}

/** Puce-filtre avec compteur (Tous · 100, À confirmer · 24…). */
export function FilterChip({
  active, onClick, children, tone = "default",
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; tone?: "default" | "orange";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-fg text-surface border-fg"
          : tone === "orange"
            ? "border-brand-orange/50 text-fg-soft hover:bg-brand-orange/10"
            : "border-line text-fg-soft hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

export function Pagination({
  page, pageSize, total, onChange,
}: {
  page: number; pageSize: number; total: number; onChange: (page: number) => void;
}) {
  const { t } = useI18n();
  const w = t.workspace;
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  // Fenêtre de numéros : 1 … p-1 p p+1 … n
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const btn = "h-8 min-w-8 px-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line-soft text-sm">
      <span className="text-fg-muted text-xs">{w.pageOf(from, to, total)}</span>
      <div className="flex items-center gap-1">
        <button className={cn(btn, "border-line text-fg-soft hover:bg-surface-muted")} disabled={page === 1}
          onClick={() => onChange(page - 1)} aria-label={w.previous}>
          <ChevronLeft size={14} className="mx-auto" />
        </button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="text-fg-subtle px-1">…</span>}
            <button onClick={() => onChange(n)} aria-current={n === page ? "page" : undefined}
              className={cn(btn, n === page ? "bg-fg text-surface border-fg" : "border-line text-fg-soft hover:bg-surface-muted")}>
              {n}
            </button>
          </span>
        ))}
        <button className={cn(btn, "border-line text-fg-soft hover:bg-surface-muted")} disabled={page === pages}
          onClick={() => onChange(page + 1)} aria-label={w.next}>
          <ChevronRight size={14} className="mx-auto" />
        </button>
      </div>
    </div>
  );
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

/** Titre de section en petites capitales, avec compteur. */
export function GroupTitle({ children, count, tone = "default" }: { children: React.ReactNode; count?: number; tone?: "default" | "orange" }) {
  return (
    <h3 className={cn(
      "text-[11px] font-bold uppercase tracking-wider flex items-center gap-2",
      tone === "orange" ? "text-orange-800 dark:text-orange-300" : "text-fg-muted",
    )}>
      {children}
      {count !== undefined && (
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal",
          tone === "orange" ? "bg-brand-orange/15" : "bg-surface-strong text-fg-soft",
        )}>{count}</span>
      )}
    </h3>
  );
}

export const inputClass =
  "border border-line rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand-blue/20";
