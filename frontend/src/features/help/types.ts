import type { Section } from "@/types/auth.types";

/** À qui s'adresse un sujet d'aide. */
export type Audience =
  | "everyone"          // tout compte connecté
  | "candidate"         // visiteur ou candidat (adhésion pas encore acceptée)
  | "member"            // membre actif (membre, responsable, bureau, admin)
  | "contributor"       // soumis à cotisation
  | "projectManager"    // gestionnaire de projets d'un département
  | "lead"              // responsable ou co-responsable d'un département
  | "admin"
  | `section:${Section}`;

/** Texte : **gras** pris en charge. */
export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "list"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "note"; text: string };

export interface HelpTopic {
  id: string;
  audience: Audience;
  /** Groupe d'affichage (sommaire). */
  group: "account" | "member" | "department" | "management" | "admin";
  title: string;
  summary: string;
  /** Page du tableau de bord concernée. */
  link?: { href: string; label: string };
  blocks: HelpBlock[];
}

export interface HelpFaq {
  audience: Audience;
  q: string;
  a: string;
}

export interface HelpContent {
  topics: HelpTopic[];
  faq: HelpFaq[];
}
