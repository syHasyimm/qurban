import { notFound } from "next/navigation";
import { QurbanPage } from "@/components/qurban/page-content";
import { menuItems } from "@/lib/qurban-demo";
import { requireAdmin } from "@/lib/session";

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; detail?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { section, detail = [] } = await params;
  const item = menuItems.find((item) => item.slug === section);
  if (
    !item ||
    detail.length > 1 ||
    (detail.length && !["peserta", "kelompok", "iuran"].includes(section))
  )
    notFound();
  const search = await searchParams;
  return (
    <QurbanPage
      key={`${section}/${detail.join("/")}:${search.baru === "1"}:${search.peserta ?? ""}:${search.filter ?? ""}:${search.jenis ?? ""}`}
      section={item.slug}
      id={detail[0]}
      initiallyOpen={search.baru === "1"}
    />
  );
}
