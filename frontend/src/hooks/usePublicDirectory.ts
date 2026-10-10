"use client";

import { useQuery } from "@tanstack/react-query";
import { membersService } from "@/services/members.service";
import { DIRECTORY_MIN_PROFILES } from "@/lib/site";

/** Nombre de profils publics, et si l'annuaire est assez rempli pour être montré. */
export function usePublicDirectory() {
  const { data, isLoading } = useQuery({
    queryKey: ["members", "public-list"],
    queryFn: () => membersService.publicList().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
  const count: number = data?.count ?? data?.results?.length ?? 0;
  return { count, isLoading, isOpen: !isLoading && count >= DIRECTORY_MIN_PROFILES };
}
