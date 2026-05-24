# せどりAIシステム MVP 画面設計

## 前提

- 対象ユーザー: 日本のせどり初心者から中級者、小規模物販事業者。
- 画面方針: LPではなく、日次業務で使う業務ダッシュボード。
- 共通構成: 左サイドナビ、上部の組織切替、期間フィルタ、検索、一覧テーブル、詳細ドロワー。
- 権限: `owner`, `admin`, `member` を基本にする。

## 画面一覧

| No | 画面 | 目的 | 主要UI | 主なデータ | 権限 |
|---:|---|---|---|---|---|
| 1 | ログイン/組織選択 | 認証し、作業対象の組織を選ぶ | ログインフォーム、組織一覧、招待承認 | `users`, `organizations`, `organization_members` | 全員 |
| 2 | ダッシュボード | 今日見るべき利益候補、在庫、注文、エラーを俯瞰する | KPI、アラート、価格差上位、滞留在庫、ジョブ状況 | `cross_channel_opportunities`, `inventory_items`, `orders`, `alerts`, `job_runs` | 全員 |
| 3 | API連携設定 | Amazon/Keepa/楽天/Yahoo/freee等の接続を管理する | 接続カード、認証状態、再検証、削除 | `api_credentials`, `api_credential_access_logs` | owner/admin |
| 4 | マルチプラットフォーム横断比較 | Amazon、メルカリ、ヤフオク、楽天、Yahooを1画面で比較する | 商品検索、横断比較表、価格/送料/手数料/在庫/売れ行き | `channel_product_matches`, `market_prices`, `cross_channel_opportunities` | admin/member |
| 5 | 価格差チャンス一覧 | 利益が見込める候補を絞り込み、優先順位をつける | A/B/C判定、利益額、ROI、回転、リスク、仕入れ登録ボタン | `cross_channel_opportunities`, `sourcing_candidates`, `ai_scores` | admin/member |
| 6 | 商品詳細/AI判定 | 商品単位で価格推移、相場、AI判定理由を確認する | 価格推移、販路別相場、AIコメント、仕入れ上限数 | `products`, `product_identifiers`, `market_prices`, `ai_scores` | admin/member |
| 7 | 仕入れ登録 | 仕入れ予定/実績を登録し、在庫化する | 仕入先、価格、数量、送料、証憑、古物情報 | `suppliers`, `purchase_orders`, `purchase_order_items`, `receipts`, `secondhand_trade_records` | admin/member |
| 8 | 在庫一覧/在庫詳細 | 在庫状態、原価、滞留、出品状況を管理する | ステータスフィルタ、滞留アラート、棚卸、在庫移動履歴 | `inventory_items`, `inventory_movements`, `listings` | admin/member |
| 9 | 注文一覧 | 販売、発送、返品、入金状況を確認する | 注文一覧、明細、発送、手数料、返品 | `orders`, `order_items`, `fees`, `shipments`, `returns` | admin/member |
| 10 | 会計CSV/レポート | 会計ソフト向けCSVと月次集計を出力する | 期間指定、CSV出力、仕訳一覧、資金繰り、税集計 | `accounting_entries`, `accounting_exports`, `cashflow_snapshots`, `tax_summary_reports` | owner/admin |
| 11 | ジョブ実行履歴 | API取得、AI判定、会計出力などの実行状況を見る | ジョブ一覧、実行履歴、失敗理由、再実行 | `jobs`, `job_runs`, `job_run_logs` | owner/admin |
| 12 | 利用量/課金 | Keepa/API/AI利用量、プラン、請求を確認する | 利用量グラフ、上限、請求、プラン表示 | `usage_logs`, `billing_plans`, `billing_subscriptions`, `billing_invoices` | owner |
| 13 | 監査ログ/セキュリティイベント | APIキー操作、権限変更、不審ログインを追跡する | 監査ログ検索、重大度、解決処理、APIキーアクセス履歴 | `audit_logs`, `security_events`, `api_credential_access_logs`, `login_events` | owner |

## MVP優先度

### Phase 1

- ログイン/組織選択
- API連携設定
- マルチプラットフォーム横断比較
- 価格差チャンス一覧
- 商品詳細/AI判定

### Phase 2

- 仕入れ登録
- 在庫一覧/在庫詳細
- 注文一覧
- ジョブ実行履歴

### Phase 3

- 会計CSV/レポート
- 利用量/課金
- 監査ログ/セキュリティイベント

## UXメモ

- 初心者向けに「仕入れる/見送る」だけでなく、理由を短く表示する。
- 価格差だけでなく、在庫滞留、Amazon本体、出品者増加、送料負けを警告する。
- 重要な操作はドロワーやモーダルで確認し、誤仕入れ・誤出品を防ぐ。
- API連携エラーはダッシュボード上部に明確に出す。
- メルカリ/ヤフオクは自動操作ではなく、URL入力/CSV/手動補完を基本導線にする。
