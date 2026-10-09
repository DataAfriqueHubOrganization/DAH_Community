"use client";

import { useState } from "react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { isAdmin } from "@/types/auth.types";
import { cn } from "@/lib/utils";
import { Composer } from "@/features/mailing/Composer";
import { History } from "@/features/mailing/History";

type Tab = "compose" | "history";

/** Emails aux membres (admin) : rédaction et historique des envois. */
export default function MemberEmailsPage() {
  const { data: user, isLoading } = useCurrentUser();
  const { t } = useI18n();
  const x = t.mailing;
  const [tab, setTab] = useState<Tab>("compose");
  const [notice, setNotice] = useState<string | null>(null);

  if (!isLoading && !(user && isAdmin(user.role))) return <p className="text-fg-muted">{x.restricted}</p>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-fg">{x.title}</h1>
          <p className="text-sm text-fg-muted mt-1">{x.subtitle}</p>
        </div>
        <div role="tablist" aria-label={x.title} className="inline-flex gap-1 bg-surface-strong rounded-xl p-1 self-start lg:self-auto">
          {(["compose", "history"] as Tab[]).map((key) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={cn("h-10 px-4 rounded-lg text-sm transition-all",
                tab === key ? "bg-surface shadow-sm font-semibold text-fg" : "text-fg-soft hover:text-fg")}>
              {x.tabs[key]}
            </button>
          ))}
        </div>
      </header>

      {notice && (
        <p role="status" className="rounded-xl bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-4 py-3 text-sm">{notice}</p>
      )}

      {tab === "compose"
        ? <Composer onSent={(message) => { setNotice(message); setTab("history"); }} />
        : <History />}
    </div>
  );
}
