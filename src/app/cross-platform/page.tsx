import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { yen } from "@/lib/format";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";
import {
  getProductComparison,
  listComparableProducts,
  type ProductComparison
} from "@/lib/sales/cross-platform";
import { amazonSearchUrl } from "@/lib/sales/jan";

export const dynamic = "force-dynamic";

export default async function CrossPlatformPage({
  searchParams
}: {
  searchParams: Promise<{ productId?: string; product?: string }>;
}) {
  const { productId, product } = await searchParams;

  const [products, primary] = await Promise.all([
    listComparableProducts(DEMO_ORGANIZATION_ID),
    getProductComparison(DEMO_ORGANIZATION_ID, { productId, title: product })
  ]);

  const comparison =
    primary ??
    (products[0] ? await getProductComparison(DEMO_ORGANIZATION_ID, { productId: products[0].productId }) : null);

  return (
    <AppShell
      active="横断比較"
      title="マルチプラットフォーム横断比較"
      subtitle="同一商品の仕入れ価格と実売価格を販路ごとに比較し、最安の仕入れ先と販売差益を確認します。"
    >
      {comparison ? (
        <Comparison comparison={comparison} products={products} />
      ) : (
        <div className="empty">
          <strong>比較できる商品がまだありません</strong>
          <span>
            価格差チャンス画面で「実売価格を更新(Yahoo)」を実行すると、仕入れ(楽天)と実売(Yahoo)の比較がここに表示されます。
          </span>
          <Link className="button" href="/opportunities" style={{ marginTop: "var(--sp-3)" }}>
            価格差チャンスへ
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function Comparison({
  comparison,
  products
}: {
  comparison: ProductComparison;
  products: Array<{ productId: string; title: string }>;
}) {
  const { rows, cheapestBuy, bestSell, estimatedSpread } = comparison;
  const hasSell = rows.some((row) => row.role === "sell");
  const cheapestBuyRow =
    cheapestBuy != null ? rows.find((row) => row.role === "buy" && row.effectiveCost === cheapestBuy) : undefined;
  const bestSellRow =
    bestSell != null ? rows.find((row) => row.role === "sell" && row.price === bestSell) : undefined;
  const amazonHref = amazonSearchUrl(comparison.title);

  return (
    <>
      <div className="card spread" style={{ marginBottom: "var(--sp-4)", gap: "var(--sp-4)", flexWrap: "wrap" }}>
        <div className="row" style={{ gap: "var(--sp-3)", minWidth: 0 }}>
          {comparison.imageUrl ? <img className="product-db-thumb" src={comparison.imageUrl} alt="" /> : null}
          <div style={{ minWidth: 0 }}>
            <span className="muted tiny">比較中の商品</span>
            <div className="product-card-title" style={{ margin: "2px 0 0" }}>
              {comparison.title}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: "var(--sp-6)" }}>
          <div>
            <span
              className="muted tiny"
              title="楽天表示価格 + 送料 − ポイント還元(基本ポイント分のみ。SPU/キャンペーン/クーポンは画面の実質還元シミュレーションで上乗せ判定してください)"
            >
              仕入れ最安(実質)
            </span>
            <div className="strong num">
              {cheapestBuy == null ? (
                "未取得"
              ) : cheapestBuyRow?.sourceUrl ? (
                <a
                  className="amount-link"
                  href={cheapestBuyRow.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="楽天の商品ページを開く"
                >
                  {yen(cheapestBuy)}
                </a>
              ) : (
                yen(cheapestBuy)
              )}
            </div>
          </div>
          <div>
            <span className="muted tiny">Yahoo市場最安(競合の床)</span>
            <div className="strong num">
              {bestSell == null ? (
                "未取得"
              ) : bestSellRow?.sourceUrl ? (
                <a
                  className="amount-link"
                  href={bestSellRow.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Yahoo!ショッピングの該当出品を開く"
                >
                  {yen(bestSell)}
                </a>
              ) : (
                yen(bestSell)
              )}
              {bestSell != null ? (
                <span className="price-basis real" style={{ marginLeft: 6 }} title="Yahoo!ショッピングAPIから取得した実際の出品の最安値です。">
                  実売
                </span>
              ) : null}
            </div>
          </div>
          <div>
            <span className="muted tiny">Yahoo最安基準の差額(粗利・手数料別)</span>
            <div className="strong num" style={{ color: spreadColor(estimatedSpread) }}>
              {estimatedSpread == null ? "未算出" : yen(estimatedSpread)}
            </div>
          </div>
          {comparison.amazonEstimate ? (
            <>
              <div>
                <span className="muted tiny">Amazon想定売値</span>
                <div className="strong num">
                  <a
                    className="amount-link"
                    href={amazonHref}
                    target="_blank"
                    rel="noreferrer"
                    title="Amazon JP で商品名検索を開く"
                  >
                    {yen(comparison.amazonEstimate.expectedSellPrice)}
                  </a>
                  <span
                    className="price-basis estimate"
                    style={{ marginLeft: 6 }}
                    title="Amazon SP-API 未接続のため、楽天価格×1.35 の汎用係数による概算です。実出品は Amazon で別途確認してください。"
                  >
                    推定
                  </span>
                </div>
              </div>
              <div>
                <span className="muted tiny">Amazon想定の推定利益(手数料込)</span>
                <div
                  className="strong num"
                  style={{ color: spreadColor(comparison.amazonEstimate.estimatedProfit) }}
                  title="Amazon の出品手数料・FBA・梱包を差し引いた推定利益です。Yahoo の差額は手数料別なので、直接比較せず別物として読んでください。"
                >
                  {yen(comparison.amazonEstimate.estimatedProfit)}
                  <span className="price-basis estimate" style={{ marginLeft: 6 }}>
                    推定
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {products.length > 0 ? (
        <div className="toolbar">
          <span className="muted tiny">比較する商品:</span>
          {products.map((item) => (
            <Link
              key={item.productId}
              className={`button ${item.productId === comparison.productId ? "" : "secondary"}`}
              href={`/cross-platform?productId=${encodeURIComponent(item.productId)}`}
            >
              {truncate(item.title, 26)}
            </Link>
          ))}
        </div>
      ) : null}

      {!hasSell ? (
        <div className="alert warning" style={{ marginBottom: "var(--sp-4)" }}>
          <Icon name="warning" />
          <div>
            <div className="alert-title">実売(販売先)データが未取得です</div>
            <div className="alert-body">
              価格差チャンス画面で「実売価格を更新(Yahoo)」を実行すると、販売差益を比較できます。
            </div>
          </div>
        </div>
      ) : null}

      <div className="alert info" style={{ marginBottom: "var(--sp-4)" }}>
        <Icon name="info" />
        <div>
          <div className="alert-title">Amazon JP は推定値・メルカリ / ヤフオクは手動確認です</div>
          <div className="alert-body">
            自動取得しているのは楽天(仕入れ)と Yahoo!ショッピング(実売)のみです。
            <strong> Amazon JP の想定売値は楽天価格×1.35 の汎用係数による概算</strong>で、実際の出品有無は
            <a
              href={amazonSearchUrl(comparison.title)}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "underline", margin: "0 4px" }}
            >
              Amazon で別途確認
            </a>
            してください。メルカリ・ヤフオクは規約配慮で自動取得しません。
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>販路</th>
              <th>区分</th>
              <th className="num">価格</th>
              <th className="num">送料</th>
              <th className="num">ポイント</th>
              <th className="num">実質</th>
              <th>在庫</th>
              <th>取得日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isCheapestBuy = row.role === "buy" && cheapestBuy != null && row.effectiveCost === cheapestBuy;
              const isBestSell = row.role === "sell" && bestSell != null && row.price === bestSell;

              return (
                <tr key={`${row.channel}:${row.role}`}>
                  <td>
                    <span className="cell-main">{row.channel}</span>
                    {row.sellerName ? <span className="cell-sub">{row.sellerName}</span> : null}
                    {row.listingCount != null ? <span className="cell-sub">出品 {row.listingCount} 件</span> : null}
                  </td>
                  <td>
                    <span className={`badge ${row.role === "buy" ? "info" : "good"}`}>
                      {row.role === "buy" ? "仕入れ" : "販売"}
                    </span>
                  </td>
                  <td className="num">{yen(row.price)}</td>
                  <td className="num">{yen(row.shipping)}</td>
                  <td className="num">{row.role === "buy" ? yen(row.pointValue) : "—"}</td>
                  <td className="num strong">
                    {yen(row.effectiveCost)}
                    {isCheapestBuy ? <span className="badge good" style={{ marginLeft: 6 }}>仕入れ最安</span> : null}
                    {isBestSell ? <span className="badge info" style={{ marginLeft: 6 }}>Yahoo最安</span> : null}
                  </td>
                  <td>{stockLabel(row.inStock)}</td>
                  <td>
                    <span className="cell-sub">{formatDate(row.fetchedAt)}</span>
                  </td>
                  <td className="num">
                    {row.sourceUrl ? (
                      <a className="button ghost" href={row.sourceUrl} target="_blank" rel="noreferrer">
                        開く
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {comparison.amazonEstimate ? (
              <tr key="amazon_jp:estimate">
                <td>
                  <span className="cell-main">Amazon JP</span>
                  <span className="cell-sub">SP-API未接続のため概算値</span>
                </td>
                <td>
                  <span className="badge neutral" title="実出品は未確認の推定値">
                    販売(推定)
                  </span>
                </td>
                <td className="num">{yen(comparison.amazonEstimate.expectedSellPrice)}</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num strong">
                  {yen(comparison.amazonEstimate.expectedSellPrice)}
                  <span
                    className="price-basis estimate"
                    style={{ marginLeft: 6 }}
                    title="楽天価格×1.35 の汎用係数による推定。実際のAmazon相場はKeepa等で別途確認してください。"
                  >
                    推定
                  </span>
                </td>
                <td>
                  <span className="badge neutral" title="Amazonの実出品は未確認">
                    要確認
                  </span>
                </td>
                <td>
                  <span className="cell-sub">—</span>
                </td>
                <td className="num">
                  <a
                    className="button ghost"
                    href={amazonSearchUrl(comparison.title)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Amazon で確認 ↗
                  </a>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function spreadColor(amount: number | null) {
  if (amount == null) return "var(--c-text-muted)";
  if (amount <= 0) return "var(--c-danger)";

  return "var(--c-success)";
}

function stockLabel(inStock: boolean | null) {
  if (inStock == null) return <span className="badge neutral">不明</span>;

  return inStock ? <span className="badge good">あり</span> : <span className="badge risk">なし</span>;
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

