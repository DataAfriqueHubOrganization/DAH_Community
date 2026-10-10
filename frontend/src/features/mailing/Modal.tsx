"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fenêtre modale simple (Échap ou clic à l'extérieur pour fermer). */
export function Modal({ children, onClose, labelledBy, wide = false }: {
  children: ReactNode;
  onClose: () => void;
  labelledBy: string;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} onMouseDown={(e) => e.stopPropagation()}
        className={cn("bg-surface rounded-2xl shadow-2xl w-full overflow-hidden", wide ? "max-w-3xl" : "max-w-lg")}>
        {children}
      </div>
    </div>
  );
}
