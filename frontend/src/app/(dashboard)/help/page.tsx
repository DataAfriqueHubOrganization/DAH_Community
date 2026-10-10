"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, HeartHandshake, Info, LifeBuoy, Search } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { SECTIONS, hasSection, isContributor, type User } from "@/types/auth.types";
import { helpFr } from "@/features/help/content.fr";
import { helpEn } from "@/features/help/content.en";
import type { Audience, HelpBlock, HelpTopic } from "@/features/help/types";

const GROUP_ORDER: HelpTopic["group"][] = ["account", "member", "department", "management", "admin"];

/** Le sujet concerne-t-il ce compte ? */
function concerns(user: User, audience: Audience): boolean {
  const isMember = user.role !== "visiteur" && user.role !== "candidat";
  switch (audience) {
    case "everyone": return true;
    case "candidate": return !isMember;
    case "member": return isMember;
    case "contributor": return isContributor(user);
    case "projectManager": return !!user.capabilities?.manages_projects;
    case "lead": return !!user.capabilities?.leads_department;
    case "admin": return user.role === "admin";
    default: return hasSection(user, audience.slice("section:".length) as (typeof SECTIONS)[number]);
  }
}

/** Texte avec **gras**. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i} className="font-semibold text-fg">{part.slice(2, -2)}</strong>
          : <Fragment key={i}>{part}</Fragment>)}
    </>
  );
}

const plain = (b: HelpBlock) =>
  b.type === "table" ? [...b.head, ...b.rows.flat()].join(" ")
    : b.type === "callout" ? [b.title, b.text, ...(b.items ?? []), b.footer ?? ""].join(" ")
      : "items" in b ? b.items.join(" ") : b.text;

/** Aide : guide d'utilisation adapté au compte (rôle, département, sections). */
export default function HelpPage() {
  const { data: user, isLoading } = useCurrentUser();
  const { t, locale } = useI18n();
  const h = t.help;
  const [query, setQuery] = useState("");
  const content = locale === "en" ? helpEn : helpFr;

  const mine = useMemo(() => {
    if (!user) return { topics: [], faq: [] };
    return {
      topics: content.topics.filter((topic) => concerns(user, topic.audience)),
      faq: content.faq.filter((f) => concerns(user, f.audience)),
    };
  }, [user, content]);

  const q = query.trim().toLowerCase();
  const topics = q
    ? mine.topics.filter((topic) =>
      [topic.title, topic.summary, ...topic.blocks.map(plain)].join(" ").toLowerCase().includes(q))
    : mine.topics;
  const faq = q ? mine.faq.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(q)) : mine.faq;
  const groups = GROUP_ORDER
    .map((g) => ({ group: g, items: topics.filter((topic) => topic.group === g) }))
    .filter((g) => g.items.length > 0);

  if (isLoading || !user) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true">
        <div className="h-28 rounded-2xl bg-surface-strong" />
        <div className="h-64 rounded-2xl bg-surface" />
      </div>
    );
  }

  const isMember = user.role !== "visiteur" && user.role !== "candidat";
  const roleChips = [
    user.role === "admin" ? h.roles.admin : isMember ? h.roles.member : user.role === "candidat" ? h.roles.candidate : h.roles.visitor,
    user.capabilities?.leads_department && h.roles.lead,
    user.capabilities?.manages_projects && h.roles.projectManager,
  ].filter(Boolean) as string[];
  const sectionChips = user.role === "admin" ? [] : SECTIONS.filter((s) => hasSection(user, s)).map((s) => t.access.sections[s].label);

  return (
    <div className="space-y-6">
      {/* En-tête personnalisé */}
      <header className="relative overflow-hidden rounded-2xl bg-univers-brand text-white p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="hidden sm:flex w-12 h-12 rounded-xl bg-white/15 items-center justify-center shrink-0">
            <LifeBuoy size={24} aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-3">
            <div>
              <h1 className="font-display text-[28px] font-extrabold tracking-tight">{h.title}</h1>
              <p className="text-white/90 mt-1">{h.greeting(user.first_name)}</p>
              <p className="text-sm text-white/75 mt-1">{h.intro}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-white/70">{h.yourRoles} :</span>
              {roleChips.map((r) => <span key={r} className="px-2.5 py-1 rounded-full bg-white/15 font-semibold">{r}</span>)}
              {sectionChips.length > 0 && (
                <>
                  <span className="text-white/70 ml-1">{h.sectionsLabel} :</span>
                  {sectionChips.map((s) => <span key={s} className="px-2.5 py-1 rounded-full bg-white text-brand-deep font-semibold">{s}</span>)}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sommaire + recherche */}
        <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-6 space-y-4">
          <label className="relative block">
            <span className="sr-only">{h.search}</span>
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={h.search}
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </label>
          {groups.length > 0 && (
            <nav aria-label={h.contents} className="hidden lg:block bg-surface rounded-2xl border border-line-soft p-4 space-y-3">
              {groups.map(({ group, items }) => (
                <div key={group}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-1.5">{h.groups[group]}</p>
                  <ul className="space-y-0.5">
                    {items.map((topic) => (
                      <li key={topic.id}>
                        <a href={`#${topic.id}`} className="block px-2 py-1.5 rounded-lg text-sm text-fg-soft hover:bg-surface-muted hover:text-fg">{topic.title}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {faq.length > 0 && (
                <a href="#faq" className="block px-2 py-1.5 rounded-lg text-sm font-medium text-fg-soft hover:bg-surface-muted hover:text-fg">{h.faq}</a>
              )}
            </nav>
          )}
        </aside>

        {/* Sujets */}
        <div className="flex-1 min-w-0 space-y-8">
          {groups.length === 0 && faq.length === 0 && (
            <p className="bg-surface rounded-2xl border border-line-soft px-6 py-12 text-center text-sm text-fg-muted">{h.noResult}</p>
          )}

          {groups.map(({ group, items }) => (
            <section key={group} aria-labelledby={`g-${group}`} className="space-y-3">
              <h2 id={`g-${group}`} className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{h.groups[group]}</h2>
              {items.map((topic) => <TopicCard key={topic.id} topic={topic} />)}
            </section>
          ))}

          {faq.length > 0 && (
            <section id="faq" aria-labelledby="faq-title" className="space-y-3 scroll-mt-6">
              <h2 id="faq-title" className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{h.faq}</h2>
              <div className="bg-surface rounded-2xl border border-line-soft divide-y divide-line-soft">
                {faq.map((f) => (
                  <details key={f.q} className="group px-5 py-4">
                    <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm font-semibold text-fg">
                      {f.q}
                      <ChevronDown size={16} className="text-fg-subtle shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <p className="mt-2 text-sm text-fg-soft leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <Info size={16} className="shrink-0 mt-0.5" aria-hidden="true" /> {h.contact}
          </p>
        </div>
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: HelpTopic }) {
  return (
    <article id={topic.id} className="bg-surface rounded-2xl border border-line-soft p-5 sm:p-6 scroll-mt-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-fg">{topic.title}</h3>
          <p className="text-sm text-fg-muted mt-0.5">{topic.summary}</p>
        </div>
        {topic.link && (
          <Link href={topic.link.href}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-brand-blue/10 text-brand-deep text-sm font-semibold hover:bg-brand-blue/15 shrink-0 self-start">
            {topic.link.label} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-fg-soft">
        {topic.blocks.map((block, i) => <Block key={i} block={block} />)}
      </div>
    </article>
  );
}

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case "p":
      return <p><Rich text={block.text} /></p>;
    case "note":
      return <p className="rounded-xl bg-brand-orange/10 px-4 py-3 text-fg"><Rich text={block.text} /></p>;
    case "callout":
      return (
        <div className="rounded-xl border border-brand-blue/25 bg-brand-blue/[0.06] px-5 py-4 space-y-2.5">
          <p className="flex items-center gap-2 font-display font-bold text-fg">
            <HeartHandshake size={18} className="text-brand-blue shrink-0" aria-hidden="true" /> {block.title}
          </p>
          <p><Rich text={block.text} /></p>
          {block.items && (
            <ul className="space-y-1 pl-5 list-disc marker:text-brand-blue">
              {block.items.map((item, i) => <li key={i}><Rich text={item} /></li>)}
            </ul>
          )}
          {block.footer && <p className="text-fg"><Rich text={block.footer} /></p>}
        </div>
      );
    case "list":
      return (
        <ul className="space-y-1.5 pl-5 list-disc marker:text-brand-blue">
          {block.items.map((item, i) => <li key={i}><Rich text={item} /></li>)}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className="w-6 h-6 rounded-lg bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span><Rich text={item} /></span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-line-soft">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left">
              <tr>{block.head.map((cell, i) => <th key={i} scope="col" className="px-4 py-2.5 text-xs font-semibold text-fg-muted">{cell}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className={cn("border-t border-line-soft")}>
                  {row.map((cell, c) => <td key={c} className={cn("px-4 py-2.5", c === 0 ? "font-medium text-fg" : "")}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
