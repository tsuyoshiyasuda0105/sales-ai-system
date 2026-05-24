# PROJECT_CONTEXT

## Project

せどりAIシステム。Amazon、メルカリ、ヤフオク、楽天、Yahooを横断して、価格差、需要、在庫、仕入れ、販売、会計を管理するSaaSを目指す。

方向性は「日本版 Tactical Arbitrage + SellerAmp + 在庫/会計管理」。

## Current Location

正式な作業フォルダ:

```text
C:\sedori_project
```

このフォルダをCodexのプロジェクトとして開けば、続きから作業できる。

## Role Split

UI/UX:

- Claude Codeに任せる
- 画面デザイン、操作性、見た目、レスポンシブ改善を担当

Codex:

- DB設計
- Supabase接続
- Prisma
- API設計
- セキュリティ
- KMS/APIキー管理
- マルチテナント設計
- 業務ロジック
- スケジューラー/ジョブ
- 外部API連携

## Current App

Next.js アプリとして作成済み。

主要画面:

- `/` ダッシュボード
- `/cross-platform` マルチプラットフォーム横断比較
- `/opportunities` 価格差チャンス
- `/products` 商品/AI判定
- `/purchases` 仕入れ
- `/inventory` 在庫
- `/orders` 注文
- `/accounting` 会計
- `/jobs` ジョブ
- `/settings/api` API設定
- `/billing` 利用量/課金
- `/security` 監査ログ

ヘルスチェック:

```text
http://localhost:3000/api/health
```

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Prisma
- PostgreSQL
- Supabase PostgreSQL予定
- BullMQ / Redis予定
- OpenAI API予定
- Keepa API予定
- 楽天API予定
- Yahoo API予定
- Amazon SP-APIは後続フェーズ

## Database Direction

DBはSupabase PostgreSQLを使う。

Prisma設定:

- `DATABASE_URL`: アプリ実行用。Supabase Transaction pooler URL
- `DIRECT_URL`: Prisma migrate / deploy用。Supabase Direct connection URL

マルチテナント前提:

- `organization_id` を主要テーブルに持たせる
- 将来的にRLSでテナント分離
- APIキーや外部認証情報は平文保存しない
- `api_credentials` はKMS暗号化前提

## Existing Design Files

設計資料:

- `api_design_mvp.md`
- `mvp_implementation_plan.md`
- `nextjs_project_structure.md`
- `screen_design_mvp.md`
- `amazon_optional_integration_strategy.md`

DB SQL:

- `db_schema_01_tenant_users.sql`
- `db_schema_02_api_security.sql`
- `db_schema_03_products_market.sql`
- `db_schema_04_inventory.sql`
- `db_schema_05_sales_orders.sql`
- `db_schema_06_accounting.sql`
- `db_schema_07_jobs_billing.sql`
- `db_schema_08_security_hardening.sql`

構成図:

- `sedori_ai_flow_system_v9.svg`

## Security Decisions

- APIキーはDBに平文保存しない
- AWS KMS / GCP KMS / Supabase Vault相当を検討
- AES-256-GCMの鍵管理を自前で抱え込まない
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用
- `SUPABASE_SERVICE_ROLE_KEY` を `NEXT_PUBLIC_` にしない
- 外部API連携はテナント単位で管理
- 監査ログを残す

## External API Priority

MVP優先:

1. 楽天API
2. Yahoo API
3. Keepa API
4. 手動入力/CSV
5. OpenAI API

後続:

- Amazon SP-API
- メルカリ/ヤフオクは規約とAPI提供状況に注意。まずは手動入力または許可された取得方法で扱う。

## Next Recommended Work

1. Supabaseプロジェクトを作成
2. `.env` を作成してSupabase接続情報を入れる
3. Prisma migrationをSupabaseへ適用
4. 初期データ/シードを作る
5. 画面のモックデータをDB読み込みに置き換える
6. API routesをPrisma接続に変更
7. APIキー保存処理をKMS前提で実装
8. 楽天/Yahoo/Keepa連携を順番に実装

## First Prompt For New Codex Project

新しいCodexプロジェクトで最初に以下を伝える。

```text
PROJECT_CONTEXT.md と TODO.md を読んで、このせどりAIシステム開発の続きを進めてください。
UI/UXはClaude Codeに任せ、CodexはDB/API/Supabase/セキュリティ/業務ロジックを担当します。
まずSupabase接続、Prisma migration、初期データ投入、モックデータのDB化から進めてください。
```

