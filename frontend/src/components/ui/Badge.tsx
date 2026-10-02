"use client";

import { cn } from "@/lib/utils";

type Variant = "blue" | "orange" | "green" | "red" | "gray" | "yellow";

const variantClasses: Record<Variant, string> = {
  blue: "bg-brand-blue/10 text-brand-deep border-brand-blue/20",
  orange: "bg-brand-orange/15 text-orange-800 border-brand-orange/30",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-red-50 text-red-700 border-red-200",
  gray: "bg-ink/[0.06] text-fg border-ink/10",
  yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
