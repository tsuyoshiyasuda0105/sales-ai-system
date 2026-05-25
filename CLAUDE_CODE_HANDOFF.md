# Claude Code Handoff

## 目的

販売システムのUI/UX実装をClaude Codeへ渡すための引き継ぎメモです。

Codex側ではDB/API/Supabase/楽天APIプロキシ/業務ロジックを担当しています。Claude Code側では、下記APIとデータ項目を使って管理画面を実務向けに整えてください。

## 現在の本番URL

- App: `https://sales-ai-system.vercel.app`
- API保護: `/api/v1/*` は `x-api-key: SALES_API_KEY` 必須
- 楽天API: Vercelから直接ではなく、さくらVPSの固定IPプロキシ経由

## 重要な画面

- `/settings/api`
  - 楽天検索、楽天ランキング、複数キーワード検索
  - 商品・市場価格・仕入れ候補としてDB保存できる
- `/opportunities`
  - 仕入れ候補一覧
  - 利益、ROI、販売想定、下限、上限、損益分岐を確認する画面
- `/products`
  - 保存済み商品一覧

## 楽天データ取得フロー

```text
管理画面
  -> Vercel API
  -> さくらVPS 楽天プロキシ
  -> 楽天API
  -> Supabase DB
```

楽天から取得した商品は、保存ONの場合に以下へ保存されます。

- `products`
- `product_identifiers`
- `market_prices`
- `sourcing_candidates`
- `ai_scores`

## API

### 単一キーワード検索

`POST /api/v1/organizations/{organizationId}/rakuten/search`

Body:

```json
{
  "keyword": "joy-con",
  "hits": 10,
  "page": 1,
  "sort": "",
  "save": true,
  "targetChannel": "amazon_jp",
  "discoveredByUserId": "00000000-0000-4000-8000-000000000001"
}
```

### 複数キーワード検索

`POST /api/v1/organizations/{organizationId}/rakuten/bulk-search`

Body:

```json
{
  "keywords": ["joy-con", "スイッチ", "プリンター"],
  "hits": 5,
  "sort": "",
  "save": true,
  "targetChannel": "amazon_jp",
  "discoveredByUserId": "00000000-0000-4000-8000-000000000001"
}
```

制限:

- 最大20キーワード
- 1キーワードあたり最大10件
- 1キーワードが失敗しても他は続行

Response summary:

```json
{
  "ok": true,
  "data": {
    "keywordCount": 3,
    "succeededCount": 3,
    "failedCount": 0,
    "totalReturnedCount": 15,
    "totalSavedCount": 15,
    "items": [],
    "results": []
  }
}
```

### 楽天ランキング

`POST /api/v1/organizations/{organizationId}/rakuten/ranking`

Body:

```json
{
  "genreId": "101205",
  "hits": 30,
  "save": true,
  "targetChannel": "amazon_jp",
  "discoveredByUserId": "00000000-0000-4000-8000-000000000001"
}
```

### 仕入れ候補一覧

`GET /api/v1/organizations/{organizationId}/opportunities`

UIで重要な項目:

```ts
type OpportunityRow = {
  id: string;
  product: string;
  productImageUrl?: string | null;
  buyChannel: string;
  sellChannel: string;
  buyPrice: number;
  buyShipping: number;
  pointValue: number;
  expectedSellPrice: number | null;
  expectedSellPriceLower: number | null;
  expectedSellPriceUpper: number | null;
  breakEvenPrice: number | null;
  estimatedProfit: number | null;
  roi: number | null;
  judgement: "A" | "B" | "C" | "NG";
  risk: string;
  status: string;
  sourceUrl?: string | null;
  createdAt: string;
};
```

## 価格・利益ロジック

現在の販売想定価格は外部実売APIではなくルール計算です。

```text
実質仕入れ原価 = 楽天価格 + 送料 - ポイント相当
販売想定価格 = 実質仕入れ原価 × 販売先ごとの倍率
```

販売先ごとの倍率:

- Amazon JP: `1.35`
- メルカリ: `1.28`
- Yahoo!オークション: `1.25`
- Yahoo!ショッピング: `1.30`
- 自社/店舗: `1.22`

販売想定レンジ:

```text
下限 = 販売想定価格 × 0.9
上限 = 販売想定価格 × 1.1
```

損益分岐:

```text
損益分岐 = 原価 + 手数料 + FBA費 + 送料 + 梱包費
```

## UIで優先して見せたい指標

仕入れ候補一覧では、まず以下を見やすくしてください。

- 判定: `A / B / C / NG`
- 商品名
- 仕入れ価格
- ポイント相当
- 販売想定
- 実売価格レンジ: 下限 / 上限
- 損益分岐
- 想定利益
- ROI
- 仕入れ元リンク

## Claude Code向けUIタスク

1. `/opportunities` を実務向けに見やすくする
   - 販売想定、下限、上限、損益分岐を同じ列内で整理
   - 利益がマイナスなら赤、良ければ緑
   - `A/B/C/NG` の判定を視認しやすくする

2. `/settings/api` の楽天取得UIを整える
   - 複数キーワード入力をわかりやすく
   - キーワード別の成功/失敗/保存件数を表示
   - 取得後に `/opportunities` への導線を置く

3. `/products` と `/opportunities` の関係をわかりやすくする
   - 商品詳細または候補詳細の導線
   - 仕入れ元URLを開くボタン

## 注意

- `.env.local` やVercel/VPSの秘密値はUIに表示しない
- `SALES_API_KEY` は管理API用
- `RAKUTEN_PROXY_API_KEY` は楽天プロキシ用
- 楽天プロキシのHTTPS化やNginxなどのセキュリティ強化は別途Claude Code側で対応予定
- 現時点ではAmazon/Yahoo/メルカリの実売価格API連携は未実装
