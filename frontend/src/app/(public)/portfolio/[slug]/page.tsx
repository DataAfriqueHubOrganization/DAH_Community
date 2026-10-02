"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { membersService } from "@/services/members.service";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Logo } from "@/components/ui/Logo";
import { ExternalLink, MapPin, Award, Briefcase, Calendar } from "lucide-react";
import Link from "next/link";
import type { PublicProfile, MemberExperience, MemberCertification } from "@/types/members.types";

export default function PortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { t, fmt, label } = useI18n();
  const { slug } = use(params);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["public-profile", slug],
    queryFn: () => membersService.publicProfile(slug).then((r) => r.data),
  });

  if (isLoading) return <PortfolioSkeleton />;
  if (isError || !profile) return <NotFound />;

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const avatar = profile.avatar ?? avatarUrl(fullName, 120);
  const currentJob = profile.experiences?.find((e: MemberExperience) => e.is_current);

  return (
    <div className="min-h-screen bg-page">
      {/* Hero banner */}
      <div className="bg-univers text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
            <div className="relative shrink-0">
              <img
                src={avatar}
                alt={fullName}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-white/20 object-cover shadow-2xl"
              />
              <div className="absolute -bottom-2 -right-2 bg-brand-orange text-ink text-xs font-bold px-2 py-0.5 rounded-full shadow">
                {label.position(profile)}
              </div>
            </div>
            <div className="text-center sm:text-left pb-1">
              <h1 className="text-3xl sm:text-4xl font-bold">{fullName}</h1>
              {currentJob && (
                <p className="text-white/90 mt-1 text-lg">
                  {currentJob.title}
                  {currentJob.company && <span className="text-brand-orange"> @ {currentJob.company}</span>}
                </p>
              )}
              <p className="text-white/80 text-sm mt-1 flex items-center justify-center sm:justify-start gap-1">
                <MapPin size={13} /> Data Afrique Hub
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                {profile.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
                    <span className="font-mono text-xs">&#123;&#125;</span> GitHub
                  </a>
                )}
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A66C2]/80 hover:bg-[#0A66C2] rounded-lg text-sm font-medium transition-colors">
                    <span className="font-bold text-xs">in</span> LinkedIn
                  </a>
                )}
                {profile.website_url && (
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
                    <ExternalLink size={13} /> {t.profile.website}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Bio */}
        {profile.bio && (
          <section className="bg-surface rounded-2xl border border-line-soft p-6">
            <h2 className="text-sm font-semibold text-fg-subtle uppercase tracking-widest mb-3">{t.profile.about}</h2>
            <p className="text-fg leading-relaxed">{profile.bio}</p>
          </section>
        )}

        {/* Compétences */}
        {profile.skills && profile.skills.length > 0 && (
          <section className="bg-surface rounded-2xl border border-line-soft p-6">
            <h2 className="text-sm font-semibold text-fg-subtle uppercase tracking-widest mb-4">{t.profile.skills}</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill: string) => (
                <span key={skill}
                  className="px-3 py-1.5 bg-brand-blue/8 text-brand-blue text-sm font-medium rounded-full border border-brand-blue/20">
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Expériences */}
        {profile.experiences && profile.experiences.length > 0 && (
          <section className="bg-surface rounded-2xl border border-line-soft p-6">
            <h2 className="text-sm font-semibold text-fg-subtle uppercase tracking-widest mb-6">
              <Briefcase size={14} className="inline mr-2 mb-0.5" />{t.profile.experiences}
            </h2>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-px bg-surface-strong" />
              <div className="space-y-6">
                {profile.experiences.map((exp: MemberExperience) => (
                  <div key={exp.id} className="flex gap-5 relative">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                      exp.is_current ? "bg-brand-blue border-brand-blue" : "bg-surface border-line"
                    }`}>
                      <Briefcase size={13} className={exp.is_current ? "text-white" : "text-fg-subtle"} />
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-fg">{exp.title}</p>
                          <p className="text-brand-orange text-sm font-medium">{exp.company}</p>
                        </div>
                        <span className="text-xs text-fg-subtle flex items-center gap-1 whitespace-nowrap">
                          <Calendar size={11} />
                          {fmt.date(exp.start_date)} — {exp.is_current ? t.profile.present : exp.end_date ? fmt.date(exp.end_date) : ""}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="text-sm text-fg-muted mt-2 leading-relaxed">{exp.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Certifications */}
        {profile.certifications && profile.certifications.length > 0 && (
          <section className="bg-surface rounded-2xl border border-line-soft p-6">
            <h2 className="text-sm font-semibold text-fg-subtle uppercase tracking-widest mb-4">
              <Award size={14} className="inline mr-2 mb-0.5" />{t.profile.certifications}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {profile.certifications.map((cert: MemberCertification) => (
                <div key={cert.id}
                  className="flex items-start gap-3 p-4 rounded-xl border border-line-soft hover:border-brand-blue/30 hover:bg-brand-blue/5 transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
                    <Award size={16} className="text-brand-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-fg text-sm leading-tight">{cert.title}</p>
                    <p className="text-xs text-fg-muted mt-0.5">{cert.issuer}</p>
                    {cert.issued_date && (
                      <p className="text-xs text-fg-subtle mt-1">{fmt.date(cert.issued_date)}</p>
                    )}
                    {cert.credential_url && (
                      <a href={cert.credential_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-brand-blue flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink size={10} /> {t.profile.viewCertificate}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer DAH */}
        <div className="text-center pt-4 pb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-fg-subtle hover:text-brand-blue text-sm transition-colors">
            <Logo variant="symbol" height={22} />
            {t.profile.verified}
          </Link>
        </div>
      </div>
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="min-h-screen bg-page">
      <div className="bg-panel h-52 animate-pulse" />
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl border border-line-soft p-6 h-32 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-fg-faint mb-4">404</p>
        <p className="text-fg-muted mb-6">{t.profile.notPublic}</p>
        <Link href="/" className="px-6 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          {t.profile.backHome}
        </Link>
      </div>
    </div>
  );
}
