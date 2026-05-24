import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { comparisonByProduct, opportunities } from "@/lib/mock-data";
import { yen, gradeClass, gradeMeaning } from "@/lib/format";

function sourceTag(source: string) {
  if (source.includes("api")) return { cls: "api", label: "API" };
  if (source.includes("manual")) return { cls: "manual", label: "手動" };
  return { cls: "", label: source };
}

function demandBadge(demand: string) {
  if (demand === "高") return "good";
  if (demand === "低") return "watch";
  return "neutral";
}

export default async function CrossPlatformPage({
  searchParams
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const products = Object.keys(comparisonByProduct);
  const active = product && comparisonByProduct[product] ? product : products[0];
  const rows = comparisonByProduct[active];
  const opportunity = opportunities.find((item) => item.product === active);
  const cheapest = Math.min(...rows.map((r) => r.price + r.shipping));

  return (
    <AppShell
      active="横断比較"
      title="マルチプラットフォーム横断比較"
      subtitle="Amazon・メルカリ・ヤフオク・楽天・Yahoo を 1 画面で比較し、最安の仕入れ先を見つけます。"
    >
      <div className="card spread" style={{ marginBottom: "var(--sp-4)" }}>
        <div>
          <span className="muted tiny">比較中の商品</span>
          <div className="product-card-title" style={{ margin: "2px 0 0" }}>
            {active}
          </div>
        </div>
        {opportunity ? (
          <div className="row" style={{ gap: "var(--sp-6)" }}>
            <div>
              <span className="muted tiny">推奨ルート</span>
              <div className="strong">
                {opportunity.buyChannel} <span className="muted">→</span> {opportunity.sellChannel}
              </div>
            </div>
            <div>
              <span className="muted tiny">想定利益</span>
              <div className="strong" style={{ color: "var(--c-success)" }}>
                {yen(opportunity.estimatedProfit)}
              </div>
            </div>
            <span
              className={`grade ${gradeClass(opportunity.judgement)}`}
              title={gradeMeaning[opportunity.judgement]}
            >
              {opportunity.judgement}
            </span>
          </div>
        ) : null}
      </div>

      <div className="toolbar">
        <span className="muted tiny">比較する商品:</span>
        {products.map((name) => (
          <Link
            key={name}
            className={`button ${name === active ? "" : "secondary"}`}
            href={`/cross-platform?product=${encodeURIComponent(name)}`}
          >
            {name}
          </Link>
        ))}
      </div>

      <div className="alert info" style={{ marginBottom: "var(--sp-4)" }}>
        <Icon name="info" />
        <div>
          <div className="alert-title">メルカリ / ヤフオクは手動確認です</div>
          <div className="alert-body">
            規約に配慮し自動取得は行いません。価格は URL 入力 / CSV / 手動補完で登録します。
          </div>
        </div>
      </div>

      <div className="toolbar">
        <span className="search">
          <Icon name="search" />
          <input className="input" defaultValue={active} placeholder="商品名・JAN・ASIN" />
        </span>
        <button className="button" type="button">
          <Icon name="compare" />
          再比較
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>販路</th>
              <th className="num">価格</th>
              <th className="num">送料</th>
              <th className="num">手数料</th>
              <th className="num">実質コスト</th>
              <th>在庫</th>
              <th>売れ行き</th>
              <th>取得元</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const total = row.price + row.shipping;
              const isCheapest = total === cheapest;
              const tag = sourceTag(row.source);
              return (
                <tr key={row.platform}>
                  <td>
                    <span className="cell-main">{row.platform}</span>
                    {isCheapest ? (
                      <span className="badge good" style={{ marginLeft: 8 }}>
                        最安
                      </span>
                    ) : null}
                  </td>
                  <td className="num">{yen(row.price)}</td>
                  <td className="num">{yen(row.shipping)}</td>
                  <td className="num">{yen(row.fee)}</td>
                  <td className="num strong">{yen(total)}</td>
                  <td>{row.stock}</td>
                  <td>
                    <span className={`badge ${demandBadge(row.demand)}`}>{row.demand}</span>
                  </td>
                  <td>
                    <span className={`src-tag ${tag.cls}`}>{tag.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
