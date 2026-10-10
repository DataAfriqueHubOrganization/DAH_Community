import { api } from "@/lib/axios";

export interface PublicStats {
  members: number;
  participants: number;
  countries: number;
}

/** Chiffres publics de la page d'accueil, calculés par le serveur. */
export const statsService = {
  get: () => api.get<PublicStats>("/stats/"),
};
