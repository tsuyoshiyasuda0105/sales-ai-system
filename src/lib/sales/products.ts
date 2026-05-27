import { prisma } from "@/lib/db";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";

export { DEMO_ORGANIZATION_ID };

export type ProductRow = {
  id: string;
  title: string;
  imageUrl?: string | null;
  category?: string | null;
  status: string;
  judgement: "A" | "B" | "C" | "NG";
  score: number;
  reason: string;
  riskNotes?: string | null;
  identifiers: Array<{
    type: string;
    value: string;
    source?: string | null;
    primary: boolean;
  }>;
  latestPrices: Array<{
    channel: string;
    price: number;
    shipping: number | null;
    seller?: string | null;
    fetchedAt: string;
    sourceUrl?: string | null;
  }>;
  createdAt: string;
};

export async function listProductRows(organizationId: string): Promise<ProductRow[]> {
  const products = await prisma.products.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null
    },
    include: {
      // 🚀 各ネスト関係に select を入れて、必要なスカラ列だけ取り出す。
      //   特に market_prices は raw_payload (~1-2KB/row) を含むので、
      //   take: 4 × 100 商品 = 最大 800KB → 数十KB へ削減できる。
      product_identifiers_product_identifiers_product_idToproducts: {
        where: { deleted_at: null },
        orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
        take: 6,
        select: {
          identifier_type: true,
          identifier_value: true,
          source_channel: true,
          is_primary: true
        }
      },
      ai_scores_ai_scores_product_idToproducts: {
        orderBy: { created_at: "desc" },
        take: 1,
        select: {
          total_score: true,
          judgement: true,
          reason_summary: true,
          risk_notes: true
        }
      },
      market_prices: {
        orderBy: { fetched_at: "desc" },
        take: 4,
        select: {
          source_channel: true,
          price_amount: true,
          shipping_amount: true,
          seller_name: true,
          fetched_at: true,
          source_url: true
        }
      }
    },
    orderBy: { created_at: "desc" },
    take: 100
  });

  return products.map((product) => {
    const latestScore = product.ai_scores_ai_scores_product_idToproducts[0];
    const score = decimalToNullableNumber(latestScore?.total_score) ?? fallbackScore(product.market_prices.length);
    const judgement = normalizeJudgement(String(latestScore?.judgement ?? "unknown"), score);

    return {
      id: product.id,
      title: product.title,
      imageUrl: product.image_url,
      category: product.category,
      status: statusLabel(String(product.status)),
      judgement,
      score,
      reason:
        latestScore?.reason_summary ??
        product.notes ??
        (product.market_prices.length > 0
          ? "市場価格データを取得済みです。販売想定価格を入れるとAI判定を更新できます。"
          : "AI判定は未実行です。価格データを追加して判定してください。"),
      riskNotes: latestScore?.risk_notes ?? product.restriction_reason,
      identifiers: product.product_identifiers_product_identifiers_product_idToproducts.map((identifier) => ({
        type: identifierLabel(String(identifier.identifier_type)),
        value: identifier.identifier_value,
        source: identifier.source_channel ? channelLabel(String(identifier.source_channel)) : null,
        primary: identifier.is_primary
      })),
      latestPrices: product.market_prices.map((price) => ({
        channel: channelLabel(String(price.source_channel)),
        price: decimalToNumber(price.price_amount),
        shipping: decimalToNullableNumber(price.shipping_amount),
        seller: price.seller_name,
        fetchedAt: price.fetched_at.toISOString(),
        sourceUrl: price.source_url
      })),
      createdAt: product.created_at.toISOString()
    };
  });
}

function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();

  return Number(value);
}

function decimalToNullableNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return null;

  return decimalToNumber(value);
}

function normalizeJudgement(value: string, score: number): ProductRow["judgement"] {
  const upper = value.toUpperCase();

  if (upper === "A" || upper === "B" || upper === "C" || upper === "NG") {
    return upper;
  }

  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";

  return "NG";
}

function fallbackScore(priceCount: number) {
  if (priceCount >= 3) return 62;
  if (priceCount > 0) return 50;

  return 35;
}

function identifierLabel(type: string) {
  const labels: Record<string, string> = {
    jan: "JAN",
    asin: "ASIN",
    sku: "SKU",
    source_product_id: "販売元ID",
    model_number: "型番",
    other: "ID"
  };

  return labels[type] ?? type.toUpperCase();
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    amazon_jp: "Amazon JP",
    rakuten: "楽天",
    yahoo_shopping: "Yahoo!ショッピング",
    yahoo_auction: "Yahoo!オークション",
    mercari: "メルカリ",
    store: "店舗/自社"
  };

  return labels[channel] ?? channel;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "有効",
    draft: "下書き",
    archived: "アーカイブ",
    restricted: "制限あり"
  };

  return labels[status] ?? status;
}
