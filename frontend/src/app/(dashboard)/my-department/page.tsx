"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { departmentsService } from "@/services/departments.service";
import { Building2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export default function MyDepartmentPage() {
  const router = useRouter();
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["departments", "mine"],
    queryFn: () => departmentsService.mine().then((r) => r.data),
  });

  useEffect(() => {
    if (data?.department) {
      // On garde ?tab=… (lien « Voir mes tâches » des emails, page Aide).
      router.replace(`/manage/departments/${data.department.id}${window.location.search}`);
    }
  }, [data, router]);

  if (isLoading || data?.department) {
    return <div className="h-40 bg-surface rounded-2xl border border-line-soft animate-pulse" />;
  }

  return (
    <div className="text-center py-16">
      <Building2 size={48} className="mx-auto text-fg-faint mb-4" />
      <p className="text-fg-muted font-medium">{t.myDepartment.none}</p>
    </div>
  );
}
