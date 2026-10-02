"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useAuth";
import { membersService } from "@/services/members.service";
import { avatarUrl, qrCodeUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Download, Share2, ExternalLink, Shield, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NetworkPattern } from "@/components/ui/NetworkPattern";

export default function MemberCardPage() {
  const { data: user } = useCurrentUser();
  const { t, fmt } = useI18n();
  const m = t.memberCard;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => membersService.myProfile().then((r) => r.data),
    enabled: !!user,
    retry: false,
  });

  const fullName = user ? `${user.first_name} ${user.last_name}` : "";
  const avatar = user?.avatar ?? avatarUrl(fullName, 120);
  const memberSince = profile?.created_at ? fmt.date(profile.created_at) : "—";
  const memberNumber = profile?.member_number ?? null;
  const publicUrl = profile?.slug ? `/portfolio/${profile.slug}` : null;
  const absolutePublicUrl = publicUrl && typeof window !== "undefined" ? window.location.origin + publicUrl : null;

  const handlePrint = () => window.print();

  const handleShare = async () => {
    if (publicUrl && navigator.share) {
      await navigator.share({
        title: `${fullName} — Data Afrique Hub`,
        url: window.location.origin + publicUrl,
      });
    } else if (publicUrl) {
      await navigator.clipboard.writeText(window.location.origin + publicUrl);
      alert(m.linkCopied);
    }
  };

  if (isLoading || !user) return <CardSkeleton />;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #member-card, #member-card * { visibility: visible; }
          #member-card { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-fg">{m.title}</h1>
          <div className="hidden md:flex gap-2 no-print shrink-0">
            {publicUrl && (
              <Link href={publicUrl} target="_blank"
                className="flex items-center gap-2 px-4 py-2 text-sm border border-line rounded-xl text-fg-soft hover:bg-surface-muted transition-colors">
                <ExternalLink size={15} /> {m.myPortfolio}
              </Link>
            )}
            <button onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-line rounded-xl text-fg-soft hover:bg-surface-muted transition-colors">
              <Share2 size={15} /> {m.share}
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-blue text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">
              <Download size={15} /> {m.download}
            </button>
          </div>
        </div>

        {/* Card preview */}
        <div className="flex justify-center">
          <MemberCard
            fullName={fullName}
            avatar={avatar}
            role={user.role}
            poste={user.poste}
            email={user.email}
            memberNumber={memberNumber}
            memberSince={memberSince}
            skills={profile?.skills ?? []}
            publicUrl={publicUrl}
            absolutePublicUrl={absolutePublicUrl}
          />
        </div>

        {/* Info box */}
        {!memberNumber && (
          <div className="max-w-lg mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-700 no-print">
            <p className="font-medium mb-1">{m.noNumberTitle}</p>
            <p className="text-amber-600">{m.noNumberText}</p>
          </div>
        )}

        {/* Mobile actions */}
        <div className="flex gap-3 justify-center no-print md:hidden">
          {publicUrl && (
            <Link href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3 text-sm border border-line rounded-xl text-fg-soft">
              <ExternalLink size={15} /> {m.portfolio}
            </Link>
          )}
          <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 py-3 text-sm bg-brand-blue text-white rounded-xl font-medium">
            <Download size={15} /> {m.download}
          </button>
        </div>
      </div>
    </>
  );
}

function MemberCard({ fullName, avatar, role, poste, email, memberNumber, memberSince, skills, publicUrl, absolutePublicUrl }: {
  fullName: string; avatar: string; role: string; poste: string | null; email: string;
  memberNumber: string | null; memberSince: string; skills: string[];
  publicUrl: string | null; absolutePublicUrl: string | null;
}) {
  const { t, label } = useI18n();
  return (
    <div id="member-card" className="w-full max-w-[420px] select-none">
      {/* Front */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-univers-brand text-white"
        style={{ aspectRatio: "1.586/1" }}>

        {/* Motif réseau de la charte */}
        <NetworkPattern className="opacity-70" />

        <div className="relative h-full p-7 flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <Logo variant="dah" tone="white" height={49} />
            </div>
            <div className="text-right">
              {memberNumber ? (
                <div>
                  <p className="text-white/80 text-[10px] font-semibold tracking-[0.14em] uppercase">{t.memberCard.cardLabel}</p>
                  <p className="font-mono font-bold text-white text-sm">{memberNumber}</p>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
                  <p className="text-xs text-white/85">{t.memberCard.pending}</p>
                </div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex items-end gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl border-2 border-white overflow-hidden bg-white/20 shadow-lg">
                <img src={avatar} alt={fullName} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-brand-orange rounded-[6px] border-2 border-white flex items-center justify-center shadow">
                <Shield size={11} className="text-fg" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-xl font-bold leading-tight truncate">{fullName}</h2>
              <p className="text-white font-semibold text-sm mt-0.5">{label.position({ role, poste })}</p>
              <p className="text-white/80 text-xs mt-1 truncate">{email}</p>

              {/* Skills preview */}
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {skills.slice(0, 3).map((s) => (
                    <span key={s} className="text-xs bg-white/15 px-2 py-0.5 rounded-full text-white/90">
                      {s}
                    </span>
                  ))}
                  {skills.length > 3 && (
                    <span className="text-xs bg-white/15 px-2 py-0.5 rounded-full text-white/80">
                      +{skills.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-white/85 text-xs">
                <CalendarDays size={11} />
                <span>{t.memberCard.memberSince} {memberSince}</span>
              </div>
              {publicUrl && (
                <p className="text-white/90 text-xs font-mono mt-1">dataafrique.hub{publicUrl}</p>
              )}
            </div>
            {absolutePublicUrl && (
              <div className="shrink-0 bg-white rounded-lg p-1.5">
                <img src={qrCodeUrl(absolutePublicUrl, 64)} alt={t.memberCard.qrAlt} className="w-14 h-14 block" />
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-fg-subtle mt-4 text-center max-w-[340px] mx-auto">
        {t.memberCard.attestation}
      </p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-surface-strong rounded-xl animate-pulse" />
      <div className="flex justify-center">
        <div className="w-full max-w-[420px] rounded-3xl bg-surface-strong animate-pulse" style={{ aspectRatio: "1.586/1" }} />
      </div>
    </div>
  );
}
