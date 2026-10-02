"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Briefcase, Code2, ExternalLink, Search, Star } from "lucide-react";
import { portfolioService } from "@/services/portfolio.service";
import { avatarUrl } from "@/lib/utils";
import type { PortfolioProject } from "@/types/portfolio.types";

export default function PortfolioPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [activeTech, setActiveTech] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => portfolioService.list().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const allTechs = Array.from(new Set(projects.flatMap((p) => p.tech_stack_list))).slice(0, 10);

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(q) ||
      p.member_name.toLowerCase().includes(q) ||
      p.tech_stack_list.some((t) => t.toLowerCase().includes(q));
    const matchTech = !activeTech || p.tech_stack_list.includes(activeTech);
    return matchSearch && matchTech;
  });

  const featured = filtered.filter((p) => p.is_featured);
  const regular = filtered.filter((p) => !p.is_featured);

  return (
    <div className="min-h-screen bg-page">
      {/* Hero */}
      <div className="bg-univers text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/25 rounded-full px-4 py-1.5 text-sm text-white mb-6">
            <Briefcase size={14} /> Portfolios
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t.portfolio.title}
          </h1>
          <p className="text-white/85 text-lg max-w-xl mx-auto">
            {t.portfolio.intro}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Outils */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              placeholder={t.portfolio.searchPlaceholder}
              aria-label={t.portfolio.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-surface"
            />
          </div>
          {allTechs.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setActiveTech("")}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                  !activeTech ? "bg-brand-blue text-white" : "bg-surface border border-line text-fg-soft hover:bg-surface-muted"
                }`}
              >
                {t.portfolio.all}
              </button>
              {allTechs.map((tech) => (
                <button
                  key={tech}
                  onClick={() => setActiveTech(activeTech === tech ? "" : tech)}
                  className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                    activeTech === tech ? "bg-brand-blue text-white" : "bg-surface border border-line text-fg-soft hover:bg-surface-muted"
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-line-soft h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-fg-subtle">
            <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
            <p>{search || activeTech ? t.portfolio.empty : t.portfolio.emptyNone}</p>
            {(search || activeTech) && (
              <button onClick={() => { setSearch(""); setActiveTech(""); }} className="mt-3 text-sm text-brand-blue hover:underline">
                {t.portfolio.reset}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {/* Projets mis en avant */}
            {featured.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Star size={15} className="text-brand-orange fill-brand-orange" />
                  <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide">{t.portfolio.featured}</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featured.map((p) => <ProjectCard key={p.id} project={p} featured />)}
                </div>
              </section>
            )}

            {/* Tous les projets */}
            {regular.length > 0 && (
              <section>
                {featured.length > 0 && (
                  <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-4">
                    {t.portfolio.others}
                  </h2>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regular.map((p) => <ProjectCard key={p.id} project={p} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project: p, featured = false }: { project: PortfolioProject; featured?: boolean }) {
  const { t } = useI18n();
  const avatar = p.member_avatar ?? avatarUrl(p.member_name, 40);

  return (
    <div className={`bg-surface rounded-2xl border overflow-hidden flex flex-col group transition-all duration-200 hover:shadow-md ${
      featured ? "border-brand-orange/30 hover:border-brand-orange/50" : "border-line-soft hover:border-brand-blue/20"
    }`}>
      {/* Image ou placeholder */}
      <div className="h-40 overflow-hidden relative bg-univers">
        {p.image ? (
          <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Briefcase size={40} className="text-white/20" />
          </div>
        )}
        {featured && (
          <div className="absolute top-3 right-3 bg-brand-orange text-ink text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Star size={10} className="fill-white" /> Vedette
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-fg group-hover:text-brand-blue transition-colors leading-tight mb-2">
          {p.title}
        </h3>
        <p className="text-sm text-fg-muted leading-relaxed line-clamp-2 flex-1 mb-3">
          {p.description}
        </p>

        {/* Stack */}
        {p.tech_stack_list.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {p.tech_stack_list.slice(0, 4).map((tech) => (
              <span key={tech} className="px-2 py-0.5 bg-surface-strong text-fg-soft text-xs font-medium rounded-full">
                {tech}
              </span>
            ))}
            {p.tech_stack_list.length > 4 && (
              <span className="px-2 py-0.5 bg-surface-strong text-fg-subtle text-xs rounded-full">
                +{p.tech_stack_list.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Auteur + liens */}
        <div className="flex items-center justify-between pt-3 border-t border-line-soft">
          <Link
            href={`/portfolio/${p.member_slug}`}
            className="flex items-center gap-2 hover:text-brand-blue transition-colors group/author"
          >
            <img src={avatar} alt={p.member_name} className="w-7 h-7 rounded-full border border-line-soft" />
            <span className="text-xs text-fg-muted group-hover/author:text-brand-blue font-medium">
              {p.member_name}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {p.repo_url && (
              <a href={p.repo_url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 text-fg-subtle hover:text-fg rounded-lg hover:bg-surface-muted transition-colors"
                onClick={(e) => e.stopPropagation()} title={t.portfolio.viewCode} aria-label={t.portfolio.viewCode}>
                <Code2 size={14} />
              </a>
            )}
            {p.demo_url && (
              <a href={p.demo_url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 text-fg-subtle hover:text-brand-blue rounded-lg hover:bg-blue-50 transition-colors"
                onClick={(e) => e.stopPropagation()} title={t.portfolio.viewDemo} aria-label={t.portfolio.viewDemo}>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
