export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function toDatetimeLocalValue(isoString?: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function avatarUrl(name: string, size = 80): string {
  const encoded = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${encoded}&size=${size}&background=2F6FE0&color=fff&bold=true&format=svg`;
}

export function qrCodeUrl(data: string, size = 120): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export function eventTypeBadgeVariant(type: string): "blue" | "orange" | "green" | "gray" | "yellow" {
  const variants: Record<string, "blue" | "orange" | "green" | "gray" | "yellow"> = {
    webinaire: "blue",
    conference: "orange",
    atelier: "green",
    hackathon: "orange",
    meetup: "blue",
    formation: "yellow",
    autre: "gray",
  };
  return variants[type] ?? "gray";
}

// Libellés métier (types d'événement, rôles, postes) et formats de date :
// voir useI18n() dans src/i18n/I18nProvider.tsx, qui suit la langue courante.
