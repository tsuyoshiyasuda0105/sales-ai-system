import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { gradeClass } from "@/lib/format";
import { DEMO_ORGANIZATION_ID, listProductRows } from "@/lib/sales/products";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listProductRows(DEMO_ORGANIZATION_ID);

  return (
    <AppShell
      active="商品/AI判定"
      title="商品 / AI判定"
      subtitle="DBに保存された商品を、識別子・最新市場価格・AI判定スコアで確認します。楽天検索で保存した商品もここに表示されます。"
      actions={
        <button className="button secondary" type="button">
          <Icon name="product" />
          商品を登録
        </button>
      }
    >
      {products.length > 0 ? (
        <div className="grid columns-3">
          {products.map((product) => {
            const grade = gradeClass(product.judgement);

            return (
              <article className="card hoverable product-db-card" key={product.id}>
                <div className="spread">
                  <div className="meta-tags">
                    {product.identifiers.length > 0 ? (
                      product.identifiers.slice(0, 2).map((identifier) => (
                        <span className={`src-tag ${identifier.source === "楽天" ? "api" : ""}`} key={`${identifier.type}:${identifier.value}`}>
                          {identifier.type} {identifier.value}
                        </span>
                      ))
                    ) : (
                      <span className="src-tag">ID未設定</span>
                    )}
                  </div>
                  <span className={`grade ${grade}`} title={judgementTitle(product.judgement)}>
                    {product.judgement}
                  </span>
                </div>

                <div className="product-db-body">
                  {product.imageUrl ? <img className="product-db-thumb" src={product.imageUrl} alt="" /> : null}
                  <div>
                    <h2 className="product-card-title">{product.title}</h2>
                    <div className="row">
                      {product.category ? <span className="badge neutral">{product.category}</span> : null}
                      <span className="badge neutral">{product.status}</span>
                    </div>
                  </div>
                </div>

                <div className="spread">
                  <span className="muted tiny">AIスコア</span>
                  <span className="strong num">{Math.round(product.score)} / 100</span>
                </div>
                <div className={`scorebar ${grade}`}>
                  <span style={{ width: `${Math.max(0, Math.min(100, product.score))}%` }} />
                </div>

                <p className="muted" style={{ marginTop: "var(--sp-3)" }}>
                  {product.reason}
                </p>

                {product.riskNotes ? (
                  <p className="cell-sub" style={{ marginTop: "var(--sp-2)" }}>
                    <Icon name="warning" style={{ width: 12, height: 12, verticalAlign: "-2px" }} /> {product.riskNotes}
                  </p>
                ) : null}

                <div className="product-price-list">
                  <div className="spread">
                    <span className="tiny muted">最新価格</span>
                    <span className="tiny muted">{product.latestPrices.length}件</span>
                  </div>
                  {product.latestPrices.length > 0 ? (
                    product.latestPrices.slice(0, 3).map((price) => (
                      <a
                        className="product-price-row"
                        href={price.sourceUrl ?? undefined}
                        target={price.sourceUrl ? "_blank" : undefined}
                        rel={price.sourceUrl ? "noreferrer" : undefined}
                        key={`${price.channel}:${price.fetchedAt}`}
                      >
                        <span>{price.channel}</span>
                        <strong>{formatYen(price.price)}</strong>
                      </a>
                    ))
                  ) : (
                    <span className="cell-sub">市場価格はまだありません。</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <strong>商品はまだありません</strong>
          <span>API設定画面の楽天商品検索で「DB保存」をONにして検索すると、ここに商品が表示されます。</span>
        </div>
      )}
    </AppShell>
  );
}

function formatYen(amount: number) {
  return `${amount.toLocaleString("ja-JP")}円`;
}

function judgementTitle(judgement: string) {
  const labels: Record<string, string> = {
    A: "仕入れ推奨",
    B: "条件確認",
    C: "要検討",
    NG: "仕入れ非推奨"
  };

  return labels[judgement] ?? judgement;
}
