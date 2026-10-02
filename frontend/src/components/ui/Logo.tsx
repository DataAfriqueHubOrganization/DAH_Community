import { cn } from "@/lib/utils";

type LogoVariant = "full" | "dah" | "symbol";
type LogoTone = "color" | "white" | "black";

// Fichiers recadrés depuis public/DAH_Logo (charte graphique)
//  full   : symbole + « Data Afrique Hub »
//  dah    : symbole + « DAH » + baseline Former · Innover · Transformer
//  symbol : Afrique + anneau seuls — à utiliser quand le logo ferait moins de 160 px de large
const RATIOS: Record<LogoVariant, number> = { full: 900 / 364, dah: 999 / 303, symbol: 600 / 587 };

interface LogoProps {
  variant?: LogoVariant;
  /** "color" bascule automatiquement sur la version blanche en mode sombre
   *  (la charte réserve le logo couleur aux fonds clairs). */
  tone?: LogoTone;
  /** Hauteur en px ; la largeur suit le ratio du fichier. */
  height?: number;
  className?: string;
}

export function Logo({ variant = "full", tone = "color", height = 44, className }: LogoProps) {
  const img = (t: LogoTone, extra?: string) => (
    <img
      src={`/brand/${variant}-${t}.png`}
      alt="Data Afrique Hub"
      width={Math.round(height * RATIOS[variant])}
      height={height}
      style={{ height, width: "auto" }}
      className={cn("select-none", extra)}
      draggable={false}
    />
  );

  return (
    // Pas de classe display par défaut : les appelants passent hidden / sm:block, etc.
    <span className={cn("shrink-0 leading-none", className)}>
      {tone === "color" ? (
        <>
          {img("color", "block dark:hidden")}
          {img("white", "hidden dark:block")}
        </>
      ) : (
        img(tone, "block")
      )}
    </span>
  );
}
