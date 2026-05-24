import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { opportunities } from "@/lib/mock-data";
import { yen, pct, gradeClass, gradeMeaning } from "@/lib/format";

export default function OpportunitiesPage() {
  return (
    <AppShell
      active="価格差チャンス"
      title="価格差チャンス一覧"
      subtitle="仕入れ候補を利益・ROI・リスクで優先順位づけし、仕入れる / 見送るを判断します。"
      actions={
        <button className="button secondary" type="button">
          <Icon name="accounting" />
          CSV出力
        </button>
      }
    >
      <div className="toolbar">
        <span className="search">
          <Icon name="search" />
          <input className="input" defaultValue="" placeholder="商品名・JAN・ASIN で検索" />
        </span>
        <button className="button secondary" type="button">判定: すべて</button>
        <button className="button secondary" type="button">リスクあり</button>
        <span className="spacer" />
        <span className="muted tiny">{opportunities.length} 件</span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>判定</th>
              <th>商品</th>
              <th>仕入れ → 販売</th>
              <th className="num">仕入価格</th>
              <th className="num">販売想定</th>
              <th className="num">利益</th>
              <th className="num">ROI</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((item) => (
              <tr key={item.id}>
                <td>
                  <span
                    className={`grade ${gradeClass(item.judgement)}`}
                    title={gradeMeaning[item.judgement]}
                  >
                    {item.judgement}
                  </span>
                </td>
                <td>
                  <Link
                    className="cell-link"
                    href={`/cross-platform?product=${encodeURIComponent(item.product)}`}
                  >
                    {item.product}
                  </Link>
                  <span className="cell-sub">
                    <Icon name="warning" style={{ width: 12, height: 12, verticalAlign: "-2px" }} />{" "}
                    {item.risk}
                  </span>
                </td>
                <td>
                  {item.buyChannel} <span className="muted">→</span> {item.sellChannel}
                </td>
                <td className="num">{yen(item.buyPrice)}</td>
                <td className="num">{yen(item.expectedSellPrice)}</td>
                <td className="num strong" style={{ color: "var(--c-success)" }}>
                  {yen(item.estimatedProfit)}
                </td>
                <td className="num">{pct(item.roi)}</td>
                <td className="num">
                  <button className="button ghost" type="button">仕入れ登録</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
