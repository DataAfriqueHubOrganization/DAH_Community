/** Coordonnées officielles de Data Afrique Hub (pied de page, pages publiques). */
export const CONTACT_EMAIL = "dataafriquehub@gmail.com";

export const SOCIAL_LINKS = [
  { href: "https://www.facebook.com/profile.php?id=61555667883593", label: "f", title: "Facebook" },
  { href: "https://www.youtube.com/@dataafriquehub", label: "▶", title: "YouTube" },
  { href: "https://www.linkedin.com/company/dataafrique-hub/", label: "in", title: "LinkedIn" },
] as const;

/** L'annuaire public (menu « Membres », section de l'accueil) n'apparaît qu'à
 *  partir de ce nombre de profils visibles : jamais une page presque vide. */
export const DIRECTORY_MIN_PROFILES = 6;
