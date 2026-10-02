import type { Metadata } from "next";
import { DashboardHome } from "@/features/dashboard/DashboardHome";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.sidebar.dashboard };
}

export default function DashboardPage() {
  return <DashboardHome />;
}
