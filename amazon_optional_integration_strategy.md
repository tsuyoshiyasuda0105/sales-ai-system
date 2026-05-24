# Amazon任意連携戦略

## 結論

MVPでは、Amazon SP-APIを必須にしない。

最初は以下の2モードで設計する。

| モード | 対象 | できること |
|---|---|---|
| Amazon手動/半自動モード | SP-API未取得ユーザー | ASIN/URL/JAN入力、Keepa取得、手動価格、AI判定 |
| Amazon SP-API連携モード | 大口出品 + SP-API取得済みユーザー | 価格、競合、注文、在庫、入金、手数料を自動同期 |

これにより、Amazon審査やSP-API登録で詰まっても、楽天/Yahoo/Keepa/手動入力でMVP検証を進められる。

## なぜ任意連携にするか

Amazon SP-APIは強力だが、初期ハードルが高い。

- 大口出品アカウントが必要
- SP-API Developer登録が必要
- LWA、Refresh Token、IAM Roleなど認証が複雑
- 取得ロールによって審査やセキュリティ要件が重い
- 注文/購入者情報などはデータ保護要件が厳しい

そのため、最初からAmazon完全連携を必須にすると、開発と検証が止まりやすい。

## Phase 1: Amazonなしでも動くMVP

### 使用データ

- 楽天API
- Yahoo!ショッピングAPI
- Keepa API
- ASIN手動入力
- Amazon販売価格の手動入力
- メルカリ/ヤフオクのURL入力またはCSV

### 主要機能

- 楽天/Yahooから仕入れ候補取得
- JAN/商品名で商品候補を作成
- ASINが分かる商品だけKeepaで価格推移/ランキング確認
- 販売想定価格を手動入力
- 送料/手数料/梱包費を入れて利益計算
- GPT-5.5でA/B/C判定
- `cross_channel_opportunities` に価格差候補を保存

### 画面

- マルチプラットフォーム横断比較
- 価格差チャンス一覧
- 商品詳細/AI判定
- 仕入れ登録
- 在庫一覧

## Phase 2: Amazon価格・競合のSP-API連携

### 追加するAPI

- Catalog Items API
- Product Pricing API
- Fees API

### 追加機能

- JAN/ASIN照合
- Amazon現在価格取得
- 競合オファー取得
- FBA/販売手数料見積もり
- Amazon本体/出品者数のリスク判定

この段階では注文や購入者情報は扱わない。
PIIが絡みにくく、SP-API連携の難易度を抑えられる。

## Phase 3: Amazon在庫/注文/入金連携

### 追加するAPI

- Orders API
- Reports API
- Finances API
- FBA Inventory API

### 追加機能

- Amazon注文同期
- FBA/自社在庫同期
- 販売手数料同期
- 入金/精算レポート同期
- 会計エントリ自動生成

この段階からデータ保護、監査ログ、APIキーアクセスログを厳格に運用する。

## Phase 4: SaaS化

### 方針

各organizationが自分のAmazon認証情報を登録する。

自社側のAmazon認証で全ユーザー分をまとめて処理しない。

理由:

- 規約リスクを分離できる
- 利用量/エラー/権限をテナントごとに管理できる
- APIキー漏洩時の影響範囲を限定できる
- Amazon側の認可取り消しにも対応しやすい

## DB上の扱い

Amazon連携状態は `api_credentials` で管理する。

```text
provider = amazon_sp_api
status = active / expired / revoked / error / disabled
external_account_id = Seller ID
external_account_name = Seller Central account name
scopes = approved roles
```

Amazon連携がない場合でも、以下は動作する。

```text
products
product_identifiers
market_prices
channel_product_matches
cross_channel_opportunities
sourcing_candidates
ai_scores
inventory_items
```

## API設計上の扱い

Amazon連携が必須のAPIは明示的に分ける。

```text
GET /v1/organizations/{organization_id}/integrations/amazon/status
POST /v1/organizations/{organization_id}/integrations/amazon/connect
POST /v1/organizations/{organization_id}/integrations/amazon/sync-prices
POST /v1/organizations/{organization_id}/integrations/amazon/sync-orders
```

横断比較APIでは、Amazon連携がない場合は `amazon_connection_status = manual` を返す。

```json
{
  "amazon_connection_status": "manual",
  "asin": "B000000000",
  "amazon_price_source": "manual",
  "keepa_available": true
}
```

## UI上の扱い

API連携設定画面で、Amazonを3状態で表示する。

| 状態 | 表示 |
|---|---|
| 未連携 | ASIN/価格手動入力で利用できます |
| 価格連携のみ | 価格/競合/手数料を自動取得できます |
| 注文/在庫連携あり | 販売後の在庫/入金/会計まで同期できます |

## 実装優先順位

1. Amazon未連携でも商品・価格差候補を登録できる
2. KeepaでASINの履歴を取得できる
3. Amazon価格を手動入力できる
4. SP-API連携済みなら自動価格取得に切り替える
5. 注文/在庫同期は後回し

## リスクと対策

| リスク | 対策 |
|---|---|
| SP-API登録に時間がかかる | AmazonなしMVPで先に検証 |
| 取得ロール審査が重い | 最初は価格/カタログ系だけに絞る |
| PII管理が重い | Orders APIはPhase 3以降 |
| Amazon依存が強くなる | 楽天/Yahoo/メルカリ/ヤフオク横断を中核にする |
| 真贋/請求書問題 | 証憑保存、仕入先、古物台帳、リスク警告を実装 |

## まとめ

Amazonは重要だが、MVPの必須条件にしない。

最初の差別化は、Amazon完全自動化ではなく以下に置く。

```text
楽天/Yahoo/メルカリ/ヤフオク/Amazonの横断比較
+ Keepaによる売れ行き確認
+ AI仕入れ判定
+ 在庫/会計管理
```

Amazon SP-APIは、ユーザーが伸びてから接続する拡張機能として扱う。
