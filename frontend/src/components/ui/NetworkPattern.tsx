import { cn } from "@/lib/utils";

// Motif signature dérivé du symbole DAH : points carrés reliés par des filets fins.
// Décoratif, posé en fond des sections bleues — jamais sur le logo.
const LINES = [
  "M0 120 L220 60 L420 160 L640 90 L900 180 L1180 70 L1440 150",
  "M220 60 L300 330 L520 420 L640 90",
  "M900 180 L980 470 L1240 520 L1180 70",
  "M0 420 L300 330",
  "M520 420 L700 600 L980 470",
];
const WHITE_DOTS: [number, number][] = [[220, 60], [640, 90], [300, 330], [1180, 70], [1240, 520], [980, 470]];
const ORANGE_DOTS: [number, number][] = [[420, 160], [900, 180], [520, 420]];

export function NetworkPattern({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 640"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <g stroke="#fff" strokeOpacity={0.14} strokeWidth={1.5} fill="none">
        {LINES.map((d) => <path key={d} d={d} />)}
      </g>
      <g fill="#fff" fillOpacity={0.3}>
        {WHITE_DOTS.map(([x, y]) => <rect key={`${x}-${y}`} x={x - 6} y={y - 6} width={12} height={12} rx={2} />)}
      </g>
      <g fill="#FB7C2C" fillOpacity={0.85}>
        {ORANGE_DOTS.map(([x, y]) => <rect key={`${x}-${y}`} x={x - 6} y={y - 6} width={12} height={12} rx={2} />)}
      </g>
    </svg>
  );
}
