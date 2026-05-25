import { AppShell } from "@/components/app-shell";
import { OpportunitiesTable } from "@/components/opportunities-table";
import { DEMO_ORGANIZATION_ID, listOpportunityRows } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, opportunities] = await Promise.all([
    searchParams,
    listOpportunityRows(DEMO_ORGANIZATION_ID)
  ]);

  return (
    <AppShell
      active="価格差チャンス"
      title="価格差チャンス一覧"
      subtitle="DBに保存された仕入れ候補を、利益・ROI・リスクで確認します。楽天検索で保存した商品もここに表示されます。"
    >
      <OpportunitiesTable rows={opportunities} initialQuery={q ?? ""} />
    </AppShell>
  );
}
