import { AppShell } from "@/components/app-shell";
import { RakutenSearchPanel } from "@/components/rakuten-search-panel";
import { apiConnections } from "@/lib/mock-data";

function statusBadge(status: string) {
  if (status.includes("接続") || status.includes("有効")) return "good";
  if (status.includes("任意")) return "info";
  return "neutral";
}

export default function ApiSettingsPage() {
  return (
    <AppShell
      active="API設定"
      title="API連携設定"
      subtitle="APIキーは KMS で暗号化保存し、画面には再表示しません。Amazon は任意連携です。"
    >
      <div className="grid columns-2">
        {apiConnections.map((api) => (
          <article className="card" key={api.provider}>
            <div className="spread">
              <h3 className="product-card-title" style={{ margin: 0 }}>
                {api.provider}
              </h3>
              <span className={`badge ${statusBadge(api.status)}`}>{api.status}</span>
            </div>
            <p className="muted" style={{ marginTop: "var(--sp-2)" }}>
              {api.note}
            </p>
            <div className="spread" style={{ marginTop: "var(--sp-4)" }}>
              <span className="tiny muted">{api.cost}</span>
              <button className="button secondary" type="button">
                設定
              </button>
            </div>
          </article>
        ))}
      </div>

      <div style={{ marginTop: "var(--sp-6)" }}>
        <RakutenSearchPanel />
      </div>
    </AppShell>
  );
}
