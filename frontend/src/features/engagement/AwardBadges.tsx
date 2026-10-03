"use client";

import { Award } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { AwardKind } from "@/types/engagement.types";

/** Badges « Membre du mois / de l'année » du profil public (sur fond de marque). */
export function AwardBadges({ awards }: { awards?: { kind: AwardKind; period_start: string }[] }) {
  const { t, intl } = useI18n();
  if (!awards?.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
      {awards.map((a) => {
        const start = new Date(`${a.period_start}T00:00:00`);
        const when = a.kind === "month"
          ? start.toLocaleDateString(intl, { month: "long", year: "numeric" })
          : String(start.getFullYear());
        return (
          <span key={`${a.kind}-${a.period_start}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange text-ink text-xs font-bold px-3 py-1">
            <Award size={13} aria-hidden="true" />
            {a.kind === "month" ? t.ranking.memberOfMonth : t.ranking.memberOfYear} · {when}
          </span>
        );
      })}
    </div>
  );
}
