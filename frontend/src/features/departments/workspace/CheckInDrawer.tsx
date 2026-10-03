"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { CheckInManager } from "@/types/engagement.types";
import { CheckInReviewForm } from "@/features/engagement/CheckInReview";
import { checkinPeriod } from "@/features/engagement/period";
import { Avatar, CHECKIN_PILL, Pill } from "./shared";

/** Panneau latéral : lire et confirmer les points d'étape à la suite,
 *  sans quitter la liste. `queue` = la liste filtrée affichée derrière. */
export function CheckInDrawer({
  queue, startId, onClose,
}: {
  queue: CheckInManager[];
  startId: number;
  onClose: () => void;
}) {
  const { t, intl, fmt } = useI18n();
  const w = t.workspace;
  const x = t.checkins;
  // On fige l'ordre à l'ouverture : la liste derrière peut changer (filtre « À confirmer »).
  const [ids] = useState(() => queue.map((c) => c.id));
  const [current, setCurrent] = useState(startId);
  const latest = useRef(new Map<number, CheckInManager>());
  queue.forEach((c) => latest.current.set(c.id, c));
  const closeRef = useRef<HTMLButtonElement>(null);

  const index = ids.indexOf(current);
  const checkin = latest.current.get(current);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (delta: number) => {
    const next = ids[index + delta];
    if (next !== undefined) setCurrent(next);
  };

  /** Après confirmation : passe au prochain point d'étape encore à confirmer. */
  const onConfirmed = (updated: CheckInManager) => {
    latest.current.set(updated.id, updated);
    const next = ids.slice(index + 1).concat(ids.slice(0, index))
      .find((id) => latest.current.get(id)?.status === "submitted");
    if (next !== undefined) setCurrent(next);
  };

  const remaining = ids.filter((id) => latest.current.get(id)?.status === "submitted").length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={checkin ? w.drawerTitle(checkin.member_name) : x.pageTitle}
        className="relative w-full max-w-[540px] h-full bg-surface shadow-2xl flex flex-col"
      >
        {checkin && (
          <>
            <header className="px-6 py-5 border-b border-line-soft flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={checkin.member_name} size={44} />
                <div className="min-w-0">
                  <p className="font-display font-bold text-fg text-lg truncate">{checkin.member_name}</p>
                  <p className="text-xs text-fg-muted">
                    <span className="capitalize">{checkinPeriod(checkin, intl)}</span>
                    {checkin.submitted_at && ` · ${x.submittedOn(fmt.date(checkin.submitted_at))}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Pill className={CHECKIN_PILL[checkin.status]}>{x.status[checkin.status]}</Pill>
                <Link href={`/checkins/${checkin.id}`} className="p-2 text-fg-subtle hover:text-brand-blue rounded-lg" aria-label={x.open} title={x.open}>
                  <ExternalLink size={16} />
                </Link>
                <button ref={closeRef} onClick={onClose} className="p-2 text-fg-subtle hover:text-fg rounded-lg" aria-label={t.common.close}>
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {checkin.status === "pending" ? (
                <p className="text-sm text-fg-muted">{x.waitingMember}</p>
              ) : checkin.status === "cancelled" ? (
                <p className="text-sm text-fg-subtle">{x.cancelledText}</p>
              ) : (
                <CheckInReviewForm
                  key={`${checkin.id}-${checkin.status}`}
                  checkin={checkin}
                  compact
                  onConfirmed={onConfirmed}
                  submitLabel={w.confirmAndSend}
                />
              )}
            </div>

            <footer className="px-6 py-3 border-t border-line-soft flex items-center justify-between gap-3 text-sm">
              <button onClick={() => go(-1)} disabled={index <= 0}
                className="inline-flex items-center gap-1 text-fg-soft hover:text-brand-blue disabled:opacity-40">
                <ChevronLeft size={16} /> {w.previousOne}
              </button>
              <span className="text-xs text-fg-muted">
                {w.position(index + 1, ids.length)}
                {remaining > 0 ? ` · ${w.toConfirm(remaining)}` : ` · ${w.queueDone}`}
              </span>
              <button onClick={() => go(1)} disabled={index >= ids.length - 1}
                className="inline-flex items-center gap-1 text-fg-soft hover:text-brand-blue disabled:opacity-40">
                {w.nextOne} <ChevronRight size={16} />
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
