import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { products } from "@/lib/mock-data";
import { gradeClass, gradeMeaning } from "@/lib/format";

export default function ProductsPage() {
  return (
    <AppShell
      active="商品/AI判定"
      title="商品 / AI判定"
      subtitle="JAN・ASIN・販路IDを紐づけ、AI判定スコアと理由を確認します。"
      actions={
        <button className="button secondary" type="button">
          <Icon name="product" />
          商品を登録
        </button>
      }
    >
      <div className="grid columns-3">
        {products.map((product) => {
          const grade = gradeClass(product.judgement);
          return (
            <article className="card hoverable" key={product.id}>
              <div className="spread">
                <div className="meta-tags">
                  <span className="src-tag">JAN {product.jan}</span>
                  <span className="src-tag">{product.asin || "ASIN未設定"}</span>
                </div>
                <span className={`grade ${grade}`} title={gradeMeaning[product.judgement]}>
                  {product.judgement}
                </span>
              </div>

              <h2 className="product-card-title">{product.title}</h2>

              <div className="spread">
                <span className="muted tiny">AIスコア</span>
                <span className="strong num">{product.score} / 100</span>
              </div>
              <div className={`scorebar ${grade}`}>
                <span style={{ width: `${product.score}%` }} />
              </div>

              <p className="muted" style={{ marginTop: "var(--sp-3)" }}>
                {product.reason}
              </p>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
