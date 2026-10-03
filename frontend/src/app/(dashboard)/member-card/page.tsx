"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useAuth";
import { membersService } from "@/services/members.service";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Download, Share2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import { engagementService } from "@/services/engagement.service";
import { Award as AwardIcon } from "lucide-react";

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

  // Dernière distinction « meilleur général » (membre du mois / de l'année).
  const { data: myPoints } = useQuery({
    queryKey: ["my-points", "month", "member-card"],
    queryFn: () => engagementService.myPoints({ period: "month" }).then((r) => r.data),
    enabled: !!user,
  });
  const latestAward = myPoints?.awards?.[0] ?? null;

  const fullName = user ? `${user.first_name} ${user.last_name}` : "";
  const avatar = user?.avatar ?? avatarUrl(fullName, 120);
  const memberSince = profile?.created_at ? fmt.date(profile.created_at) : "—";
  const memberNumber = profile?.member_number ?? null;
  const publicUrl = profile?.slug ? `/portfolio/${profile.slug}` : null;

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
          @page { margin: 12mm; }
          body * { visibility: hidden; }
          #member-card, #member-card * {
            visibility: visible;
            /* Sans ça, le navigateur supprime les fonds : texte blanc sur blanc. */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #member-card { position: fixed; top: 0; left: 50%; transform: translateX(-50%); width: 440px; max-width: none; }
          #member-card .card-face { box-shadow: none; border: 1px solid #E4E4E7; }
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
            publicUrl={publicUrl}
            award={latestAward}
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

function MemberCard({ fullName, avatar, role, poste, email, memberNumber, memberSince, publicUrl, award }: {
  fullName: string; avatar: string; role: string; poste: string | null; email: string;
  memberNumber: string | null; memberSince: string; publicUrl: string | null;
  award: { kind: "month" | "year"; period_start: string } | null;
}) {
  const { t, label, intl } = useI18n();
  const m = t.memberCard;
  // La carte est un objet physique : couleurs fixes (pas de tokens de thème),
  // identiques en clair, en sombre et à l'impression.
  return (
    <div id="member-card" className="w-full max-w-[440px] select-none">
      <div
        className="card-face relative rounded-3xl overflow-hidden bg-white text-[#111114] shadow-2xl ring-1 ring-black/5 flex flex-col"
        style={{ aspectRatio: "1.586/1" }}
      >
        {/* Bandeau marque */}
        <div className="relative h-[34%] shrink-0 bg-univers-brand px-6 flex items-center justify-between">
          <NetworkPattern className="opacity-60" />
          <Logo variant="dah" tone="white" height={38} className="relative" />
          <div className="relative text-right text-white">
            <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-white/80">{m.cardLabel}</p>
            {memberNumber ? (
              <p className="font-mono font-bold text-[15px] leading-tight">{memberNumber}</p>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-xs mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" aria-hidden="true" />
                {m.pending}
              </p>
            )}
          </div>
        </div>

        {/* Identité */}
        <div className="relative flex-1 px-6 flex gap-4">
          <div className="-mt-9 shrink-0">
            <div className="w-[84px] h-[84px] rounded-2xl overflow-hidden border-[3px] border-white bg-[#EEF0F3] shadow-md">
              <img src={avatar} alt={fullName} className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <h2 className="font-display text-[19px] font-bold leading-tight truncate">{fullName}</h2>
            <p className="text-[13px] font-semibold text-[#1E4FAF] mt-0.5 truncate">{label.position({ role, poste })}</p>
            <p className="text-[11px] text-[#71717A] mt-0.5 truncate">{email}</p>
            {award && (
              <p className="inline-flex items-center gap-1 mt-2 rounded-full bg-brand-orange text-[#111114] text-[10.5px] font-bold px-2 py-0.5">
                <AwardIcon size={11} aria-hidden="true" />
                {award.kind === "month" ? t.ranking.memberOfMonth : t.ranking.memberOfYear} ·{" "}
                {award.kind === "month"
                  ? new Date(`${award.period_start}T00:00:00`).toLocaleDateString(intl, { month: "long", year: "numeric" })
                  : award.period_start.slice(0, 4)}
              </p>
            )}
          </div>
        </div>

        {/* Pied : infos clés */}
        <div className="px-6 pb-4 grid grid-cols-2 gap-4 text-[11px]">
          <div className="min-w-0">
            <p className="text-[9.5px] font-semibold tracking-[0.12em] uppercase text-[#71717A]">{m.memberSince}</p>
            <p className="font-semibold mt-0.5 truncate">{memberSince}</p>
          </div>
          {publicUrl && (
            <div className="min-w-0 text-right">
              <p className="text-[9.5px] font-semibold tracking-[0.12em] uppercase text-[#71717A]">{m.profileLabel}</p>
              <p className="font-mono font-semibold text-[#1E4FAF] mt-0.5 truncate">dataafrique.hub{publicUrl}</p>
            </div>
          )}
        </div>

        {/* Liseré charte : orange + bleu */}
        <div className="h-1.5 shrink-0 flex" aria-hidden="true">
          <span className="w-1/3 bg-brand-orange" />
          <span className="flex-1 bg-[#1E4FAF]" />
        </div>
      </div>

      <p className="text-xs text-fg-subtle mt-4 text-center max-w-[340px] mx-auto print:text-[#71717A]">
        {m.attestation}
      </p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-surface-strong rounded-xl animate-pulse" />
      <div className="flex justify-center">
        <div className="w-full max-w-[440px] rounded-3xl bg-surface-strong animate-pulse" style={{ aspectRatio: "1.586/1" }} />
      </div>
    </div>
  );
}
