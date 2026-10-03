"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { treasuryService } from "@/services/treasury.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { isTreasurer } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { todayIso } from "@/features/engagement/period";
import { ValidateTab } from "@/features/treasury/ValidateTab";
import { MembersTab } from "@/features/treasury/MembersTab";
import { CashTab } from "@/features/treasury/CashTab";
import { monthName } from "@/features/treasury/shared";

type Tab = "validate" | "members" | "cash";
const TABS: Tab[] = ["validate", "members", "cash"];

/** Trésorerie (trésorier, adjoint, admin), organisée autour de trois gestes :
 *  valider les déclarations, suivre les membres mois par mois, tenir la caisse. */
export default function TreasuryPage() {
  const { t, intl } = useI18n();
  const x = t.treasury;
  const v = x.v2;
  const { data: user, isLoading: loadingUser } = useCurrentUser();
  const allowed = isTreasurer(user);
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab") as Tab | null;
  const [chosen, setChosen] = useState<Tab | null>(requested && TABS.includes(requested) ? requested : null);
  const [year, setYear] = useState(() => new Date().getFullYear());

  const { data: declarations = [], isLoading: loadingDeclarations } = useQuery({
    queryKey: ["treasury", "declarations", "pending"],
    queryFn: () => treasuryService.declarations.list("pending").then((r) => r.data),
    enabled: allowed,
  });
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["treasury", "overview", year],
    queryFn: () => treasuryService.contributions.overview(year).then((r) => r.data),
    enabled: allowed,
  });

  // Par défaut : « À valider » s'il y a quelque chose à valider, sinon « Membres ».
  const tab: Tab = chosen ?? (loadingDeclarations ? "members" : declarations.length > 0 ? "validate" : "members");
  const select = (next: Tab) => {
    setChosen(next);
    window.history.replaceState(null, "", `?tab=${next}`);
  };

  if (loadingUser) return <div className="h-40 bg-surface rounded-3xl animate-pulse" />;
  if (!allowed) return <p className="text-fg-muted">{t.common.error}</p>;

  const month = monthName(`${todayIso().slice(0, 7)}-01`, intl);

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-fg">{x.title}</h1>
          <p className="text-sm text-fg-muted mt-1 capitalize-first">
            {declarations.length > 0 ? v.subtitleWaiting(month, declarations.length) : v.subtitleClear(month)}
          </p>
        </div>
        <nav aria-label={x.sectionsLabel} className="inline-flex self-start lg:self-auto gap-1.5 bg-surface rounded-2xl p-1.5 shadow-sm">
          {TABS.map((key) => (
            <button key={key} onClick={() => select(key)} aria-current={tab === key ? "page" : undefined}
              className={cn("inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors",
                tab === key ? "bg-fg text-surface font-semibold" : "text-fg-muted hover:text-fg font-medium")}>
              {key === "validate" && declarations.length > 0 && <span className="w-2 h-2 rounded-full bg-brand-orange" aria-hidden="true" />}
              {v.tabs[key]}
              {key === "validate" && declarations.length > 0 && (
                <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-brand-orange text-ink">{declarations.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {tab === "validate" && <ValidateTab declarations={declarations} isLoading={loadingDeclarations} />}
      {tab === "members" && <MembersTab data={overview} isLoading={loadingOverview} year={year} onYear={setYear} />}
      {tab === "cash" && <CashTab year={year} onYear={setYear} />}
    </div>
  );
}
