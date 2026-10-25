import { notFound, redirect } from "next/navigation";
import { QurbanPage } from "@/components/qurban/page-content";
import { menuItems } from "@/lib/qurban-demo";
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path = [] } = await params;
  if (!path.length) redirect("/preview/dashboard");
  const item = menuItems.find((item) => item.slug === path[0]);
  if (
    !item ||
    path.length > 2 ||
    (path.length === 2 && !["peserta", "kelompok", "iuran"].includes(item.slug))
  )
    notFound();
  const search = await searchParams;
  return (
    <QurbanPage
      key={`${path.join("/")}:${search.baru === "1"}:${search.peserta ?? ""}:${search.filter ?? ""}:${search.jenis ?? ""}`}
      section={item.slug}
      id={path[1]}
      initiallyOpen={search.baru === "1"}
    />
  );
}
