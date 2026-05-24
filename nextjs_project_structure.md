# Next.js Project Structure

## 目的

このドキュメントは、Sedori AI MVP を Next.js / TypeScript / PostgreSQL / Prisma / Redis + BullMQ / KMS / OpenAI API で実装するための推奨プロジェクト構成を定義する。

実装方針は以下を前提にする。

- Next.js App Router を採用する。
- テナント境界は `organization_id` を中心に設計する。
- REST API は `/api/v1/organizations/[organizationId]/...` に集約する。
- PostgreSQL は永続データ、Redis は BullMQ のキュー実行状態と短期キャッシュを担う。
- DBアクセスは Prisma 経由を基本にする。
- 外部APIキーやトークンはアプリケーション層でエンベロープ暗号化し、暗号文のみDBに保存する。
- バックグラウンド処理は Next.js のリクエスト処理とは分離した Worker プロセスで実行する。

## 推奨ディレクトリ構成

```text
.
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── callback/
│   │       └── route.ts
│   ├── (dashboard)/
│   │   ├── organizations/
│   │   │   └── [organizationId]/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx
│   │   │       ├── products/
│   │   │       │   ├── page.tsx
│   │   │       │   └── [productId]/
│   │   │       │       └── page.tsx
│   │   │       ├── sourcing-candidates/
│   │   │       │   └── page.tsx
│   │   │       ├── inventory/
│   │   │       │   └── page.tsx
│   │   │       ├── listings/
│   │   │       │   └── page.tsx
│   │   │       ├── orders/
│   │   │       │   └── page.tsx
│   │   │       ├── accounting/
│   │   │       │   └── page.tsx
│   │   │       ├── jobs/
│   │   │       │   └── page.tsx
│   │   │       └── settings/
│   │   │           ├── page.tsx
│   │   │           ├── members/
│   │   │           │   └── page.tsx
│   │   │           └── api-credentials/
│   │   │               └── page.tsx
│   ├── api/
│   │   ├── health/
│   │   │   └── route.ts
│   │   └── v1/
│   │       └── organizations/
│   │           └── [organizationId]/
│   │               ├── me/
│   │               │   └── route.ts
│   │               ├── api-credentials/
│   │               │   ├── route.ts
│   │               │   └── [credentialId]/
│   │               │       ├── route.ts
│   │               │       ├── verify/
│   │               │       │   └── route.ts
│   │               │       └── rotate/
│   │               │           └── route.ts
│   │               ├── products/
│   │               │   ├── route.ts
│   │               │   └── [productId]/
│   │               │       └── route.ts
│   │               ├── cross-platform/
│   │               │   └── compare/
│   │               │       └── route.ts
│   │               ├── ai-scores/
│   │               │   ├── route.ts
│   │               │   ├── batch/
│   │               │   │   └── route.ts
│   │               │   └── [scoreId]/
│   │               │       ├── route.ts
│   │               │       └── recalculate/
│   │               │           └── route.ts
│   │               ├── inventory-items/
│   │               │   ├── route.ts
│   │               │   └── [inventoryItemId]/
│   │               │       └── route.ts
│   │               ├── listings/
│   │               │   ├── route.ts
│   │               │   └── [listingId]/
│   │               │       ├── route.ts
│   │               │       └── sync/
│   │               │           └── route.ts
│   │               ├── orders/
│   │               │   ├── route.ts
│   │               │   └── import/
│   │               │       └── route.ts
│   │               ├── accounting-exports/
│   │               │   ├── route.ts
│   │               │   └── [exportId]/
│   │               │       ├── route.ts
│   │               │       └── download/
│   │               │           └── route.ts
│   │               ├── jobs/
│   │               │   ├── route.ts
│   │               │   └── [jobId]/
│   │               │       ├── route.ts
│   │               │       └── run/
│   │               │           └── route.ts
│   │               └── job-runs/
│   │                   └── route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   └── domain/
│       ├── products/
│       ├── inventory/
│       ├── jobs/
│       └── settings/
├── services/
│   ├── auth/
│   │   ├── auth.service.ts
│   │   └── organization-membership.service.ts
│   ├── api-credentials/
│   │   ├── api-credential.service.ts
│   │   └── credential-verification.service.ts
│   ├── products/
│   │   ├── product.service.ts
│   │   └── market-price.service.ts
│   ├── ai/
│   │   ├── ai-score.service.ts
│   │   └── openai.service.ts
│   ├── inventory/
│   ├── listings/
│   ├── orders/
│   ├── accounting/
│   ├── jobs/
│   │   ├── job.service.ts
│   │   ├── job-run.service.ts
│   │   └── scheduler.service.ts
│   └── billing/
├── repositories/
│   ├── organization.repository.ts
│   ├── organization-member.repository.ts
│   ├── api-credential.repository.ts
│   ├── product.repository.ts
│   ├── market-price.repository.ts
│   ├── ai-score.repository.ts
│   ├── inventory.repository.ts
│   ├── listing.repository.ts
│   ├── order.repository.ts
│   ├── accounting.repository.ts
│   ├── job.repository.ts
│   ├── job-run.repository.ts
│   ├── audit-log.repository.ts
│   └── usage-log.repository.ts
├── jobs/
│   ├── queues.ts
│   ├── types.ts
│   ├── enqueue/
│   │   ├── enqueue-ai-score.ts
│   │   ├── enqueue-price-fetch.ts
│   │   ├── enqueue-order-import.ts
│   │   └── enqueue-accounting-export.ts
│   ├── processors/
│   │   ├── ai-score.processor.ts
│   │   ├── price-fetch.processor.ts
│   │   ├── listing-sync.processor.ts
│   │   ├── order-import.processor.ts
│   │   ├── accounting-export.processor.ts
│   │   └── alert-check.processor.ts
│   ├── workers/
│   │   ├── worker.ts
│   │   └── scheduler.ts
│   └── utils/
│       ├── job-context.ts
│       ├── progress.ts
│       └── retry-policy.ts
├── lib/
│   ├── prisma.ts
│   ├── redis.ts
│   ├── env.ts
│   ├── logger.ts
│   ├── errors.ts
│   ├── http.ts
│   ├── validation.ts
│   ├── auth.ts
│   ├── tenant.ts
│   ├── rls.ts
│   ├── idempotency.ts
│   ├── audit.ts
│   ├── rate-limit.ts
│   ├── kms/
│   │   ├── kms-client.ts
│   │   ├── aws-kms-client.ts
│   │   └── gcp-kms-client.ts
│   ├── crypto/
│   │   ├── envelope-encryption.ts
│   │   ├── credential-vault.ts
│   │   └── redaction.ts
│   └── external/
│       ├── openai-client.ts
│       ├── amazon-sp-api-client.ts
│       ├── keepa-client.ts
│       └── marketplace-client.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   ├── seed.ts
│   └── sql/
│       ├── rls.sql
│       └── extensions.sql
├── scripts/
│   ├── dev-worker.ts
│   ├── migrate.ts
│   └── create-organization.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

## 主要ディレクトリの役割

### `app/`

Next.js App Router のルーティング層。画面表示、API Route Handler、レイアウトを配置する。

- `app/(dashboard)/organizations/[organizationId]/...`
  - テナント選択後の画面を置く。
  - URLの `organizationId` を必ず現在のテナントコンテキストとして扱う。
  - `layout.tsx` でログイン確認、組織メンバー確認、ロール取得を行う。
- `app/api/v1/organizations/[organizationId]/...`
  - REST API を置く。
  - Route Handler は薄く保ち、認証・認可・入力検証・サービス呼び出し・レスポンス整形に限定する。
  - DB更新、外部API呼び出し、ジョブ投入などの業務処理は `services/` に委譲する。
- `app/api/health/route.ts`
  - ロードバランサーや監視用。
  - DB接続まで見る `readiness` と、プロセス生存のみを見る `liveness` は分けてもよい。

Route Handler の基本形は以下に統一する。

```ts
export async function POST(
  request: Request,
  { params }: { params: { organizationId: string } },
) {
  const context = await requireOrganizationContext(request, params.organizationId);
  const body = createSchema.parse(await request.json());
  const result = await productService.createProduct(context, body);
  return jsonCreated(result);
}
```

### `services/`

ユースケース層。アプリケーションの業務フローを実装する。

責務:

- 認可済みの `OrganizationContext` を受け取る。
- 複数 repository の呼び出しを組み合わせる。
- トランザクション境界を決める。
- 外部API、KMS、OpenAI、BullMQ などの呼び出しを制御する。
- 監査ログ、利用ログ、セキュリティイベントを必要に応じて記録する。

例:

- `api-credential.service.ts`
  - APIキー登録、更新、ローテーション、削除。
  - 平文のcredentialを受け取れるのはこの層まで。
  - 保存前に `lib/crypto/credential-vault.ts` で暗号化する。
- `ai-score.service.ts`
  - AIスコアの同期実行またはジョブ投入を判断する。
  - OpenAI APIの利用量を `usage_logs` に記録する。
- `job.service.ts`
  - `jobs` テーブルの設定作成、更新、即時実行。
  - BullMQへのenqueueと `job_runs` 作成を同一ユースケースとして扱う。

### `repositories/`

DBアクセス層。Prisma Client を直接利用する場所を原則としてこのディレクトリに限定する。

責務:

- Prisma query の実行。
- `organization_id` 条件の強制。
- ページネーション、検索条件、ソート条件の組み立て。
- DBモデルとアプリケーションDTOの変換。

禁止事項:

- 外部APIを呼ばない。
- KMS復号をしない。
- HTTPリクエストやCookieに依存しない。
- BullMQに直接enqueueしない。

repository のメソッドは原則として `organizationId` を必須引数にする。

```ts
async function findProductById(args: {
  organizationId: string;
  productId: string;
}) {
  return prisma.product.findFirst({
    where: {
      id: args.productId,
      organizationId: args.organizationId,
      deletedAt: null,
    },
  });
}
```

### `jobs/`

BullMQ を使うバックグラウンドジョブの定義、enqueue関数、processor、worker起動コードを置く。

責務:

- `jobs/queues.ts`
  - Queue、QueueEvents、Worker 共通設定を定義する。
  - Redis接続は `lib/redis.ts` から取得する。
- `jobs/types.ts`
  - ジョブpayload型を定義する。
  - すべてのpayloadに `organizationId`、`jobRunId`、`requestId` を含める。
- `jobs/enqueue/`
  - APIやserviceから呼ばれるenqueue関数。
  - BullMQ投入前に `job_runs` を `queued` または `scheduled` で作成する。
- `jobs/processors/`
  - 実際の処理本体。
  - DBアクセスは services/repositories を使う。
  - 処理開始時に `job_runs.status = running`、完了時に `succeeded`、失敗時に `failed` を記録する。
- `jobs/workers/worker.ts`
  - 本番で別プロセスとして起動するWorkerエントリポイント。
- `jobs/workers/scheduler.ts`
  - 定期ジョブをDBの `jobs.next_run_at` から読み取り、BullMQへ投入するスケジューラ。

Next.js サーバープロセス内で長時間ジョブを処理しない。API Route はジョブを登録して即時レスポンスする。

### `lib/`

横断的な基盤コードを置く。業務ロジックは置かない。

主なファイル:

- `lib/prisma.ts`
  - Prisma Client のsingleton。
  - 開発時のHot Reloadで接続が増えすぎないようにする。
- `lib/redis.ts`
  - BullMQとキャッシュで使うRedis接続。
  - Queue用と一般キャッシュ用の接続設定を分離できる形にする。
- `lib/env.ts`
  - 環境変数をZodなどで検証し、型付きでexportする。
  - `process.env` の直接参照を各所に散らさない。
- `lib/auth.ts`
  - セッション検証、ユーザー解決。
- `lib/tenant.ts`
  - `OrganizationContext` の生成。
  - ユーザーが対象organizationのactive memberか確認する。
- `lib/rls.ts`
  - PostgreSQL RLS用の `app.current_organization_id` をトランザクション内で設定する。
- `lib/kms/`
  - AWS KMS / GCP KMS の差し替え可能なクライアント。
- `lib/crypto/`
  - エンベロープ暗号化、復号、ログ用redaction。
- `lib/external/openai-client.ts`
  - OpenAI SDKの初期化。
  - リトライ、タイムアウト、ログredactionを共通化する。

### `prisma/`

Prisma schema、migration、seed、RLS補助SQLを置く。

推奨:

- DBカラムはSQL設計に合わせてsnake_case、PrismaモデルはcamelCaseにmapする。
- 全テナントスコープテーブルに `organization_id` を持たせる。
- Prismaのmiddlewareまたはrepository規約で `organizationId` 条件漏れを防ぐ。
- PostgreSQL RLSを有効化する場合、Prisma操作はトランザクション内で `set_config('app.current_organization_id', ...)` を実行してから行う。

例:

```ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`
    select set_config('app.current_organization_id', ${organizationId}, true)
  `;

  return tx.product.findMany({
    where: { organizationId },
  });
});
```

## 環境変数一覧

### アプリケーション基本設定

| 変数名 | 必須 | 例 | 説明 |
|---|---:|---|---|
| `NODE_ENV` | yes | `development` | 実行環境。 |
| `NEXT_PUBLIC_APP_URL` | yes | `http://localhost:3000` | ブラウザから見えるアプリURL。 |
| `APP_ENV` | yes | `local` / `staging` / `production` | アプリ独自の環境名。 |
| `APP_NAME` | no | `sedori-ai` | ログや監査イベントに出すアプリ名。 |
| `LOG_LEVEL` | yes | `debug` / `info` | ログレベル。 |
| `REQUEST_ID_HEADER` | no | `x-request-id` | リクエストIDヘッダー名。 |

### 認証・セッション

| 変数名 | 必須 | 例 | 説明 |
|---|---:|---|---|
| `AUTH_SECRET` | yes | `...` | セッション署名・暗号化用secret。 |
| `AUTH_COOKIE_NAME` | no | `sedori_ai_session` | セッションCookie名。 |
| `AUTH_COOKIE_SECURE` | yes | `true` | HTTPS Cookie 強制。localのみ `false` 可。 |
| `SESSION_TTL_SECONDS` | yes | `2592000` | セッション有効期限。 |
| `OIDC_ISSUER_URL` | no | `https://...` | OIDCを使う場合のIssuer。 |
| `OIDC_CLIENT_ID` | no | `...` | OIDC client id。 |
| `OIDC_CLIENT_SECRET` | no | `...` | OIDC client secret。 |

### PostgreSQL / Prisma

| 変数名 | 必須 | 例 | 説明 |
|---|---:|---|---|
| `DATABASE_URL` | yes | `postgresql://app:pass@localhost:5432/sedori_ai` | Prisma接続文字列。 |
| `DIRECT_DATABASE_URL` | no | `postgresql://...` | migration用の直接接続。pooler利用時に分ける。 |
| `DATABASE_POOL_MIN` | no | `1` | 本番プール設定。 |
| `DATABASE_POOL_MAX` | no | `10` | 本番プール設定。 |
| `PRISMA_LOG_LEVEL` | no | `query,error,warn` | Prismaログ設定。 |

### Redis / BullMQ

| 変数名 | 必須 | 例 | 説明 |
|---|---:|---|---|
| `REDIS_URL` | yes | `redis://localhost:6379/0` | BullMQ用Redis。 |
| `REDIS_CACHE_URL` | no | `redis://localhost:6379/1` | キャッシュを分ける場合。 |
| `BULLMQ_PREFIX` | yes | `sedori-ai` | BullMQ key prefix。環境ごとに分ける。 |
| `WORKER_CONCURRENCY` | yes | `5` | Workerのデフォルト並列数。 |
| `WORKER_QUEUES` | yes | `default,ai,marketplace,accounting` | 起動するキュー名。 |
| `SCHEDULER_ENABLED` | yes | `true` | スケジューラ起動有無。 |

### KMS / 暗号化

| 変数名 | 必須 | 例 | 説明 |
|---|---:|---|---|
| `KMS_PROVIDER` | yes | `aws` / `gcp` | 利用するKMS。 |
| `KMS_KEY_ID` | yes | `arn:aws:kms:...` | デフォルトのKMSキーID。 |
| `KMS_ENCRYPTION_CONTEXT_APP` | yes | `sedori-ai` | KMS encryption context に含めるアプリ名。 |
| `AWS_REGION` | AWS時yes | `ap-northeast-1` | AWS KMSリージョン。 |
| `AWS_ACCESS_KEY_ID` | local時のみ | `...` | localで明示認証する場合。 |
| `AWS_SECRET_ACCESS_KEY` | local時のみ | `...` | localで明示認証する場合。 |
| `GCP_PROJECT_ID` | GCP時yes | `my-project` | GCP project id。 |
| `GCP_KMS_LOCATION` | GCP時yes | `asia-northeast1` | GCP KMS location。 |
| `GCP_KMS_KEY_RING` | GCP時yes | `sedori-ai` | Key ring。 |
| `GCP_KMS_KEY_NAME` | GCP時yes | `api-credentials` | Crypto key名。 |
| `GOOGLE_APPLICATION_CREDENTIALS` | local時のみ | `/secrets/gcp.json` | localでGCP認証する場合。 |

### OpenAI API

| 変数名 | 必須 | 例 | 説明 |
|---|---:|---|---|
| `OPENAI_API_KEY` | yes | `sk-...` | OpenAI APIキー。 |
| `OPENAI_DEFAULT_MODEL` | yes | `gpt-4.1-mini` | デフォルトモデル。実装時点の最新要件で見直す。 |
| `OPENAI_SCORE_MODEL` | no | `gpt-4.1-mini` | AIスコア用モデル。 |
| `OPENAI_EMBEDDING_MODEL` | no | `text-embedding-3-small` | 類似検索を使う場合。 |
| `OPENAI_REQUEST_TIMEOUT_MS` | yes | `60000` | タイムアウト。 |
| `OPENAI_MAX_RETRIES` | yes | `2` | SDK/APIリトライ回数。 |

### 外部マーケットプレイスAPI

| 変数名 | 必須 | 例 | 説明 |
|---|---:|---|---|
| `AMAZON_SP_API_REGION` | no | `fe` | Amazon SP-API region。 |
| `KEEPA_API_BASE_URL` | no | `https://api.keepa.com` | Keepa API URL。 |
| `RAKUTEN_API_BASE_URL` | no | `https://app.rakuten.co.jp/services/api` | 楽天API URL。 |
| `YAHOO_API_BASE_URL` | no | `https://shopping.yahooapis.jp` | Yahoo API URL。 |
| `EBAY_API_BASE_URL` | no | `https://api.ebay.com` | eBay API URL。 |

外部ユーザーcredentialは環境変数に置かない。organizationごとに `api_credentials` へ暗号化保存する。

### 運用・監視

| 変数名 | 必須 | 例 | 説明 |
|---|---:|---|---|
| `SENTRY_DSN` | no | `https://...` | エラー監視。 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | `https://...` | OpenTelemetry送信先。 |
| `METRICS_ENABLED` | no | `true` | メトリクス有効化。 |
| `RATE_LIMIT_ENABLED` | yes | `true` | API rate limit 有効化。 |
| `IDEMPOTENCY_TTL_SECONDS` | yes | `86400` | `Idempotency-Key` 保存期間。 |

## ローカル開発構成

### 起動サービス

localでは `docker-compose.yml` で以下を起動する。

- `postgres`
  - PostgreSQL 16以上。
  - `pgcrypto` など必要extensionを有効化する。
- `redis`
  - BullMQ用。
- `app`
  - 通常はホスト上で `next dev` を実行してもよい。
- `worker`
  - ホスト上で `tsx jobs/workers/worker.ts`、またはcompose内で起動。
- `scheduler`
  - `tsx jobs/workers/scheduler.ts`。

### 推奨npm scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:worker": "tsx jobs/workers/worker.ts",
    "dev:scheduler": "tsx jobs/workers/scheduler.ts",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### local KMS

localでは次のどちらかを選ぶ。

1. 開発用AWS/GCP KMSキーを使う。
2. `KMS_PROVIDER=local` を実装し、開発専用の固定マスターキーで疑似エンベロープ暗号化する。

本番相当の暗号化フローを早期に検証するため、可能なら開発用KMSキーを使う。`KMS_PROVIDER=local` はテスト用途に限定し、productionでは起動時に拒否する。

### local DB初期化

推奨手順:

1. `docker compose up -d postgres redis`
2. `npm run db:generate`
3. `npm run db:migrate`
4. `npm run db:seed`
5. `npm run dev`
6. 別ターミナルで `npm run dev:worker`
7. 定期ジョブを検証する場合は `npm run dev:scheduler`

seedでは最低限以下を作る。

- 開発用ユーザー
- 開発用organization
- `organization_members` のowner/admin/member
- サンプル商品、販売チャネル、ジョブ設定
- 暗号化済みのダミーAPI credential

## 本番構成

### 推奨コンポーネント

```text
Internet
  └── CDN / WAF
      └── Load Balancer
          ├── Next.js Web/API containers
          ├── BullMQ Worker containers
          └── Scheduler container

Managed PostgreSQL
Managed Redis
AWS KMS or GCP KMS
OpenAI API
External marketplace APIs
Object Storage for exports
Observability stack
```

### Web/API

- Next.js standalone outputをコンテナ化する。
- statelessに保ち、セッションや一時状態をローカルファイルに置かない。
- API Routeは短時間で返す。
- 長時間処理、外部APIの大量取得、AIバッチ処理、会計エクスポートはBullMQへ渡す。

### Worker

- Web/APIとは別コンテナ、別スケール単位にする。
- キューごとにworker deploymentを分けられるようにする。
  - `ai`
  - `marketplace`
  - `accounting`
  - `default`
- CPU/メモリ/外部API rate limit に応じて `WORKER_CONCURRENCY` を調整する。
- graceful shutdown で新規ジョブ取得を止め、実行中ジョブの完了またはtimeoutを待つ。

### Scheduler

- 原則1インスタンスのみ起動する。
- 複数起動があり得る環境ではPostgreSQL advisory lockまたはRedis lockでleader制御する。
- `jobs` テーブルから `status = active` かつ `next_run_at <= now()` のジョブを読み、BullMQへ投入する。

### PostgreSQL

- Managed PostgreSQLを利用する。
- migrationはCI/CDの専用ステップで実行する。
- アプリ用ユーザーとmigration用ユーザーを分ける。
- RLSを有効にする場合、アプリ用ユーザーにはRLS bypass権限を与えない。
- PITR、定期backup、復元訓練を必須にする。

### Redis

- Managed Redisを利用する。
- BullMQ用Redisは永続化設定とメモリ上限を明示する。
- キャッシュ用途とキュー用途は、可能ならDB番号またはクラスタを分ける。
- eviction policyによりBullMQ keyが消えない設定にする。

### KMS

- 本番ではAWS KMSまたはGCP KMSのCustomer Managed Keyを使う。
- 環境ごとにKMS keyを分ける。
- key rotationを有効化する。
- KMS decrypt権限はWeb/APIとWorkerの実行ロールに限定する。
- 管理者の手元に平文APIキーを残さない。

### OpenAI API

- サーバーサイドからのみ呼び出す。
- APIキーは `OPENAI_API_KEY` としてSecret Manager等から注入する。
- ユーザー入力、商品情報、価格情報を送る場合はログに平文promptを無制限に残さない。
- 利用量は `usage_logs` とジョブ実行ログに紐づける。

## マルチテナントと `organization_id` の扱い

### 基本原則

- テナントの主キーは `organizations.id`。
- API URL、画面URL、DBレコード、ジョブpayloadのすべてで `organization_id` を明示する。
- ユーザーは複数organizationに所属できる。
- リクエストごとに「認証済みユーザーが対象organizationのactive memberであること」を確認する。
- roleは `organization_members.role` で判定する。

### `OrganizationContext`

すべてのserviceは以下のようなcontextを受け取る。

```ts
type OrganizationContext = {
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
  requestId: string;
  sessionId?: string;
};
```

生成場所:

- API Route: `lib/tenant.ts` の `requireOrganizationContext()`
- Server Component: dashboard layoutで取得
- Worker: job payloadの `organizationId` と `jobRunId` から生成

### APIでの扱い

- URL path の `[organizationId]` を唯一のテナント指定として扱う。
- bodyに `organizationId` を受け取らない。受け取る場合もpathと一致するか検証し、基本は無視する。
- GET一覧、詳細取得、更新、削除のすべてで `organizationId` 条件を必須にする。
- `Idempotency-Key` は `organizationId + userId + method + path + key` の組み合わせで扱う。

### DBでの扱い

- テナントスコープのテーブルには必ず `organization_id` を持たせる。
- unique制約は原則 `organization_id` を含める。
  - 例: `(organization_id, provider, external_account_id)`
  - 例: `(organization_id, queue_name, job_key)`
- repositoryの公開メソッドは `organizationId` を必須にする。
- RLSを使う場合、アプリケーションはトランザクション内で `app.current_organization_id` を設定する。

### Workerでの扱い

BullMQ payloadの必須項目:

```ts
type BaseJobPayload = {
  organizationId: string;
  jobRunId: string;
  requestId: string;
  triggeredByUserId?: string;
};
```

Workerはpayloadから `organizationId` を取り、DB更新・外部API credential取得・ログ記録のすべてに渡す。Worker内で `organizationId` を推測しない。

## APIキー暗号化の配置

### 保存対象

外部サービスのAPIキー、access token、refresh token、client secretは `api_credentials` テーブルへ暗号化して保存する。

対象例:

- Amazon SP-API token
- Keepa API key
- Rakuten / Yahoo / eBay API credential
- 会計SaaS連携token
- organization固有のAI provider credentialを許可する場合のkey

OpenAI APIキーをアプリ全体で共有する場合は環境変数 `OPENAI_API_KEY` で管理する。organizationごとにOpenAIキーを持たせる仕様にする場合のみ `api_credentials.provider = ai` などで暗号化保存する。

### 配置

```text
services/api-credentials/api-credential.service.ts
  └── lib/crypto/credential-vault.ts
      ├── lib/crypto/envelope-encryption.ts
      └── lib/kms/kms-client.ts
          ├── lib/kms/aws-kms-client.ts
          └── lib/kms/gcp-kms-client.ts
```

### 暗号化フロー

1. API Routeがcredential登録リクエストを受ける。
2. `requireOrganizationContext()` でadmin以上か確認する。
3. `apiCredentialService.createCredential()` に平文credentialを渡す。
4. serviceが `credentialVault.encryptCredential()` を呼ぶ。
5. `credentialVault` がデータキーを生成し、AES-256-GCMでcredentialを暗号化する。
6. データキーはKMSで暗号化し、`encrypted_data_key` に保存する。
7. 暗号文、IV、auth tag、KMS key id、encryption contextを `api_credentials` に保存する。
8. 監査ログとセキュリティイベントを記録する。

### 復号フロー

1. serviceまたはprocessorがcredential利用を要求する。
2. `apiCredentialRepository` が対象organization内のcredential metadataと暗号文を取得する。
3. `credentialVault.decryptCredential()` がKMSでデータキーを復号する。
4. AES-256-GCMでcredentialを復号する。
5. 利用後は平文をログに出さず、不要になった参照を短命にする。
6. `api_credential_access_logs` に利用目的、requestId、jobRunIdを記録する。

### encryption context

KMS encryption contextには最低限以下を含める。

```json
{
  "app": "sedori-ai",
  "environment": "production",
  "organization_id": "org_uuid",
  "credential_id": "credential_uuid",
  "provider": "amazon_sp_api"
}
```

復号時も同じcontextを要求する。これにより別organizationや別credentialへの暗号文差し替えリスクを下げる。

## ジョブWorkerの配置

### プロセス分離

本番では以下を別プロセスとして起動する。

- `web`
  - Next.js画面とAPI。
- `worker-default`
  - 軽量ジョブ、通知、汎用処理。
- `worker-ai`
  - OpenAI APIを使うAIスコア処理。
- `worker-marketplace`
  - 価格取得、注文import、出品sync。
- `worker-accounting`
  - 会計仕訳生成、CSV/会計SaaS export。
- `scheduler`
  - DB上の定期ジョブをBullMQに投入。

### キュー設計

推奨キュー:

| キュー名 | 用途 |
|---|---|
| `default` | 軽量な汎用ジョブ。 |
| `ai` | AIスコア、AI判定、バッチ推論。 |
| `marketplace` | 外部モール価格取得、注文import、出品同期。 |
| `accounting` | 会計仕訳生成、会計export、税サマリー生成。 |
| `notifications` | アラート通知、メール、Webhook。 |

BullMQのjob nameは業務種別に合わせる。

- `ai-score.create`
- `ai-score.batch`
- `market-price.fetch`
- `listing.sync`
- `order.import`
- `accounting-entry.generate`
- `accounting-export.create`
- `alert.check`

### enqueue時のDB連携

APIからジョブを投入するときは、先にDBへ `job_runs` を作る。

```ts
const jobRun = await jobRunRepository.createQueuedRun({
  organizationId: context.organizationId,
  jobId,
  triggerType: "manual",
  requestedByUserId: context.userId,
  requestId: context.requestId,
});

await queue.add("ai-score.create", {
  organizationId: context.organizationId,
  jobRunId: jobRun.id,
  requestId: context.requestId,
  targetType: "product",
  targetId: productId,
});
```

BullMQ投入に成功したら `bullmq_job_id` と `enqueued_at` を更新する。投入に失敗した場合は `job_runs.status = failed` としてエラー理由を保存する。

### processor実装ルール

- processorの先頭で `jobRunId` を検証する。
- `job_runs` を `running` に更新する。
- `organizationId` をcontextに入れてserviceを呼ぶ。
- 進捗は `job_runs.progress` と `job_run_logs` に残す。
- 外部API credentialを使うたびに `api_credential_access_logs` を残す。
- OpenAIや外部APIの利用量は `usage_logs` に残す。
- 例外発生時はredaction済みメッセージを保存する。
- 再試行可能エラーと恒久エラーを区別する。

### スケジューラ実装ルール

- `jobs.status = active` のみ対象。
- `schedule_type = cron` または `interval` の設定から次回実行時刻を計算する。
- 同じ `organization_id + queue_name + job_key` の重複投入を防ぐ。
- 使用量上限を確認してからenqueueする。
- enqueue後に `jobs.last_run_at`、`jobs.next_run_at` を更新する。

## 実装時の境界ルール

- UI componentからrepositoryを直接呼ばない。
- API RouteからPrismaを直接呼ばない。例外はhealth check程度に留める。
- serviceはHTTPのRequest/Response型に依存しない。
- repositoryは認証・認可をしない。すでに検証済みのcontextから渡された `organizationId` を使う。
- 平文credentialは `services/api-credentials/` と `lib/crypto/` の外へ広げない。
- WorkerはNext.jsの内部APIをHTTPで叩かず、serviceを直接呼ぶ。
- 監査ログ、credential access log、usage logはユーザー操作とジョブ操作の両方で記録する。

## 最小実装順序

1. `prisma/schema.prisma` とmigrationを作る。
2. `lib/env.ts`、`lib/prisma.ts`、`lib/redis.ts` を作る。
3. `lib/auth.ts`、`lib/tenant.ts`、membership確認を作る。
4. `repositories/organization*.ts` と `services/auth/*` を作る。
5. `/api/v1/organizations/[organizationId]/me` を作る。
6. `api_credentials` のrepository/service/APIを作る。
7. KMS + credential vault を実装する。
8. `jobs/queues.ts`、`jobs/types.ts`、worker起動を作る。
9. `jobs` / `job_runs` APIとenqueue処理を作る。
10. AI score、価格取得、出品同期、会計exportなどの個別processorを追加する。

この順で作ると、認証・テナント分離・暗号化・ジョブ基盤を先に固定でき、後続のドメイン実装が安全に進められる。
