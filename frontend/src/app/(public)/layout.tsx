import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="pt-[72px] sm:pt-[88px]">{children}</main>
      <PublicFooter />
    </>
  );
}
