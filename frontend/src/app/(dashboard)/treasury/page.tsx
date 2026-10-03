"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { treasuryService } from "@/services/treasury.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { isTreasurer } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { ContributionsTab } from "@/features/treasury/ContributionsTab";
import { CashTab } from "@/features/treasury/CashTab";
import { YearSelect, yearOptions } from "@/features/treasury/shared";

type Tab = "contributions" | "cash";

/** Trésorerie (trésorier, adjoint, admin) : cotisations et caisse. */
export default function TreasuryPage() {
  const { t } = useI18n();
  const x = t.treasury;
  const { data: user, isLoading: loadingUser } = useCurrentUser();
  const allowed = isTreasurer(user);
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "cash" ? "cash" : "contributions");
  const [year, setYear] = useState(() => new Date().getFullYear());

  const { data: overview, isLoading } = useQuery({
    queryKey: ["treasury", "overview", year],
    queryFn: () => treasuryService.contributions.overview(year).then((r) => r.data),
    enabled: allowed,
  });

  const select = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", `?tab=${next}`);
  };

  if (loadingUser) return <div className="h-40 bg-surface rounded-2xl border border-line-soft animate-pulse" />;
  if (!allowed) return <p className="text-fg-muted">{t.common.error}</p>;

  return (
    <div className="space-y-6">
      <header className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 bg-surface border-b border-line-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-fg">{x.title}</h1>
            <Badge variant="orange">{x.roleBadge}</Badge>
          </div>
          <YearSelect value={year} onChange={setYear} years={yearOptions()} />
        </div>
        <nav aria-label={x.sectionsLabel} className="flex gap-6 mt-3 -mb-px">
          {(["contributions", "cash"] as Tab[]).map((key) => (
            <button key={key} onClick={() => select(key)} aria-current={tab === key ? "page" : undefined}
              className={cn("inline-flex items-center gap-2 py-3 text-sm border-b-[3px] transition-colors",
                tab === key ? "border-brand-orange text-fg font-semibold" : "border-transparent text-fg-muted hover:text-fg font-medium")}>
              {x.tabs[key]}
              {key === "contributions" && overview && overview.late_count > 0 && (
                <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-brand-orange/15 text-orange-800 dark:text-orange-300">
                  {x.nLate(overview.late_count)}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {tab === "contributions" ? <ContributionsTab data={overview} isLoading={isLoading} /> : <CashTab year={year} />}
    </div>
  );
}
