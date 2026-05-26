import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/db";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const [productCount, candidateCount, rakutenPriceCount, yahooPriceCount, jobRunCount] = await Promise.all([
    prisma.products.count({ where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null } }),
    prisma.sourcing_candidates.count({ where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null } }),
    prisma.market_prices.count({
      where: { organization_id: DEMO_ORGANIZATION_ID, source_channel: "rakuten" }
    }),
    prisma.market_prices.count({
      where: { organization_id: DEMO_ORGANIZATION_ID, source_channel: "yahoo_shopping" }
    }),
    prisma.job_runs.count({ where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null } })
  ]);

  const cards: Array<{ label: string; value: number | null; foot: string }> = [
    { label: "商品(取り込み済み)", value: productCount, foot: "products テーブル" },
    { label: "仕入れ候補", value: candidateCount, foot: "アクティブ含む全件" },
    { label: "楽天価格スナップ", value: rakutenPriceCount, foot: "market_prices(rakuten)" },
    { label: "Yahoo実売取得", value: yahooPriceCount, foot: "market_prices(yahoo_shopping)" },
    { label: "ジョブ実行履歴", value: jobRunCount, foot: "job_runs" },
    { label: "プラン", value: null, foot: "MVP / 課金未接続" }
  ];

  return (
    <AppShell
      active="利用量/課金"
      title="利用量 / 課金"
      subtitle="API取得・候補生成の利用状況をテナント単位で把握します。"
    >
      <section className="grid columns-3">
        {cards.map((item) => (
          <div className="card" key={item.label}>
            <p className="card-title">{item.label}</p>
            <p className="metric">{item.value == null ? "MVP" : item.value.toLocaleString("ja-JP")}</p>
            <p className="metric-foot">{item.foot}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
