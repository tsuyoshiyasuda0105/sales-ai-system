export const demoOrganization = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Demo Store",
  role: "owner"
};

export type PlatformRow = {
  platform: string;
  price: number;
  shipping: number;
  fee: number;
  stock: string;
  demand: string;
  source: string;
};

export const comparisonByProduct: Record<string, PlatformRow[]> = {
  "ワイヤレスイヤホン 型番A100": [
    { platform: "Amazon", price: 6980, shipping: 0, fee: 1047, stock: "販売可", demand: "高", source: "manual/keepa" },
    { platform: "楽天", price: 4280, shipping: 550, fee: 0, stock: "在庫あり", demand: "中", source: "api" },
    { platform: "Yahoo", price: 4380, shipping: 0, fee: 0, stock: "在庫あり", demand: "中", source: "api" },
    { platform: "メルカリ", price: 3200, shipping: 750, fee: 0, stock: "要確認", demand: "手動", source: "manual" },
    { platform: "ヤフオク", price: 3600, shipping: 800, fee: 0, stock: "要確認", demand: "手動", source: "manual" }
  ],
  "中古ゲームソフト B": [
    { platform: "Amazon", price: 3480, shipping: 0, fee: 522, stock: "出品あり", demand: "中", source: "manual/keepa" },
    { platform: "楽天", price: 3200, shipping: 600, fee: 0, stock: "在庫僅少", demand: "低", source: "api" },
    { platform: "Yahoo", price: 3380, shipping: 0, fee: 0, stock: "在庫あり", demand: "中", source: "api" },
    { platform: "メルカリ", price: 2100, shipping: 210, fee: 0, stock: "要確認", demand: "手動", source: "manual" },
    { platform: "ヤフオク", price: 3680, shipping: 0, fee: 0, stock: "落札相場", demand: "手動", source: "manual" }
  ],
  "限定ホビー C": [
    { platform: "Amazon", price: 16980, shipping: 0, fee: 2547, stock: "販売可", demand: "中", source: "manual/keepa" },
    { platform: "楽天", price: 13800, shipping: 800, fee: 0, stock: "在庫あり", demand: "低", source: "api" },
    { platform: "Yahoo", price: 12200, shipping: 0, fee: 0, stock: "在庫あり", demand: "低", source: "api" },
    { platform: "メルカリ", price: 12800, shipping: 900, fee: 0, stock: "要確認", demand: "手動", source: "manual" },
    { platform: "ヤフオク", price: 13200, shipping: 1000, fee: 0, stock: "要確認", demand: "手動", source: "manual" }
  ]
};

// Default comparison (kept for backward compatibility / direct visits).
export const platformComparison = comparisonByProduct["ワイヤレスイヤホン 型番A100"];

export const opportunities = [
  {
    id: "opp_001",
    product: "ワイヤレスイヤホン 型番A100",
    buyChannel: "楽天",
    sellChannel: "Amazon",
    buyPrice: 4280,
    expectedSellPrice: 6980,
    estimatedProfit: 2180,
    roi: 0.314,
    judgement: "A",
    risk: "出品者増加に注意"
  },
  {
    id: "opp_002",
    product: "中古ゲームソフト B",
    buyChannel: "メルカリ",
    sellChannel: "ヤフオク",
    buyPrice: 2100,
    expectedSellPrice: 3680,
    estimatedProfit: 940,
    roi: 0.22,
    judgement: "B",
    risk: "状態確認が必要"
  },
  {
    id: "opp_003",
    product: "限定ホビー C",
    buyChannel: "Yahoo",
    sellChannel: "Amazon",
    buyPrice: 12200,
    expectedSellPrice: 16980,
    estimatedProfit: 3420,
    roi: 0.187,
    judgement: "B",
    risk: "回転はやや遅い"
  }
];

export const products = [
  {
    id: "prd_001",
    title: "ワイヤレスイヤホン 型番A100",
    jan: "4900000000011",
    asin: "B0A100DEMO",
    judgement: "A",
    score: 86,
    reason: "利益率が高く、Keepa上のランキング変動も良好。初回は2個まで。"
  },
  {
    id: "prd_002",
    title: "中古ゲームソフト B",
    jan: "4900000000028",
    asin: "",
    judgement: "B",
    score: 72,
    reason: "利益は出るが、状態確認と付属品確認が必要。"
  },
  {
    id: "prd_003",
    title: "限定ホビー C",
    jan: "4900000000035",
    asin: "B0CDEMO123",
    judgement: "B",
    score: 68,
    reason: "利益額は大きいが回転がやや遅く、在庫滞留に注意。"
  }
];

export const purchases = [
  {
    id: "po_001",
    supplier: "楽天ショップA",
    product: "ワイヤレスイヤホン 型番A100",
    quantity: 2,
    amount: 8560,
    status: "発注済み",
    date: "2026-05-24"
  },
  {
    id: "po_002",
    supplier: "メルカリ出品者",
    product: "中古ゲームソフト B",
    quantity: 1,
    amount: 2100,
    status: "検品待ち",
    date: "2026-05-23"
  }
];

export const inventory = [
  {
    sku: "SKU-A100-001",
    product: "ワイヤレスイヤホン 型番A100",
    status: "出品中",
    cost: 4280,
    listedPrice: 6980,
    daysInStock: 3
  },
  {
    sku: "SKU-GAME-B-001",
    product: "中古ゲームソフト B",
    status: "検品済み",
    cost: 2100,
    listedPrice: 3680,
    daysInStock: 1
  },
  {
    sku: "SKU-HOBBY-C-001",
    product: "限定ホビー C",
    status: "滞留注意",
    cost: 12200,
    listedPrice: 16980,
    daysInStock: 45
  }
];

export const orders = [
  {
    id: "order_001",
    channel: "Amazon",
    product: "ワイヤレスイヤホン 型番A100",
    total: 6980,
    fee: 1047,
    status: "発送待ち",
    orderedAt: "2026-05-24"
  },
  {
    id: "order_002",
    channel: "ヤフオク",
    product: "中古ゲームソフト B",
    total: 3680,
    fee: 368,
    status: "入金済み",
    orderedAt: "2026-05-23"
  }
];

export const accountingRows = [
  { label: "売上", amount: 10660 },
  { label: "仕入原価", amount: 6380 },
  { label: "販売手数料", amount: 1415 },
  { label: "想定粗利", amount: 2865 }
];

export const apiConnections = [
  { provider: "Keepa", status: "未設定", cost: "€49/月〜", note: "価格/ランキング履歴" },
  { provider: "楽天", status: "未設定", cost: "0円/月", note: "商品検索API" },
  { provider: "Yahoo", status: "未設定", cost: "0円/月", note: "商品検索API" },
  { provider: "Amazon", status: "任意", cost: "大口4,900円/月+税", note: "Phase 2以降" },
  { provider: "OpenAI", status: "未設定", cost: "従量課金", note: "AI判定/レポート" }
];

export const jobs = [
  { name: "楽天候補取得", schedule: "6時間ごと", status: "active", lastRun: "成功" },
  { name: "Yahoo候補取得", schedule: "6時間ごと", status: "active", lastRun: "成功" },
  { name: "Keepa監視更新", schedule: "1日1回", status: "active", lastRun: "未実行" },
  { name: "会計レポート生成", schedule: "毎日深夜", status: "paused", lastRun: "未実行" }
];

export const auditLogs = [
  { action: "API設定画面を表示", user: "demo@example.com", severity: "info", at: "2026-05-24 12:00" },
  { action: "横断比較を実行", user: "demo@example.com", severity: "info", at: "2026-05-24 12:05" },
  { action: "在庫滞留アラート", user: "system", severity: "warning", at: "2026-05-24 12:10" }
];
