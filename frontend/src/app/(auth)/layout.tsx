import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import { PreferencesToggle } from "@/components/PreferencesToggle";
import { getT } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <div className="min-h-screen flex">
      {/* Left panel - Brand */}
      <div className="hidden lg:flex lg:w-[45%] bg-univers relative overflow-hidden flex-col justify-between p-12 text-white">
        <NetworkPattern />

        <Link href="/" className="relative z-10 self-start" aria-label={t.nav.homeAria}>
          <Logo variant="dah" tone="white" height={64} />
        </Link>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <p className="inline-flex items-center gap-3 font-display text-sm font-semibold tracking-[0.16em] uppercase">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-brand-orange" />
            {t.authLayout.badge}
          </p>
          <h2 className="text-4xl font-bold leading-tight">
            {t.authLayout.title}
          </h2>
          <p className="text-white/90 text-[17px] leading-relaxed max-w-md">
            {t.authLayout.text}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 max-w-md">
            {[["30+", t.authLayout.stats[0]], ["10+", t.authLayout.stats[1]], ["50+", t.authLayout.stats[2]]].map(([val, lbl]) => (
              <div key={lbl} className="p-3 bg-white/10 rounded-xl border border-white/20">
                <p className="font-display text-2xl font-bold">{val}</p>
                <p className="text-white/85 text-xs mt-0.5">{lbl}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <figure className="relative z-10 bg-white/10 border border-white/20 rounded-2xl p-5">
          <blockquote className="text-white/90 text-sm leading-relaxed">
            &ldquo;{t.authLayout.quote}&rdquo;
          </blockquote>
          <figcaption className="flex items-center gap-3 mt-4">
            <img src="https://ui-avatars.com/api/?name=Alice+Mensah&background=FB7C2C&color=111114&bold=true&format=svg" alt="Alice" className="w-9 h-9 rounded-[10px]" />
            <div>
              <p className="font-display text-sm font-semibold">Alice Mensah</p>
              <p className="text-white/75 text-xs">Data Scientist</p>
            </div>
          </figcaption>
        </figure>
      </div>

      {/* Right panel - Form */}
      <div className="relative flex-1 flex flex-col justify-center items-center p-6 sm:p-12 bg-page">
        <PreferencesToggle className="absolute top-4 right-4 sm:top-6 sm:right-6" />
        {/* Mobile logo */}
        <Link href="/" className="lg:hidden mb-10" aria-label={t.nav.homeAria}>
          <Logo variant="full" height={66} />
        </Link>

        <div className="w-full max-w-[420px]">
          <div className="bg-surface rounded-2xl shadow-sm border border-line p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
