import { prisma } from "@/lib/db";

export type PriceTrendChannel = "rakuten" | "yahoo_shopping";

export type PriceTrendRow = {
  productId: string;
  productTitle: string;
  productImageUrl: string | null;
  channel: PriceTrendChannel;
  currentPrice: number;
  basePrice: number;
  priceChange: number;
  priceChangeRate: number;
  currentRank: number | null;
  baseRank: number | null;
  rankChange: number | null;
  inStock: boolean | null;
  currentFetchedAt: string;
  baseFetchedAt: string;
  daysBetween: number;
  estimatedProfit: number | null;
  roi: number | null;
  judgement: "A" | "B" | "C" | "NG" | null;
};

export type PriceTrendQuery = {
  organizationId: string;
  channel?: PriceTrendChannel;
  days?: number;
  minRateAbs?: number;
  limit?: number;
};

export type PriceTrendResult = {
  channel: PriceTrendChannel;
  days: number;
  evaluated: number;
  rows: PriceTrendRow[];
};

const DEFAULT_DAYS = 7;
const DEFAULT_LIMIT = 200;

export async function getPriceTrends(query: PriceTrendQuery): Promise<PriceTrendResult> {
  const channel = query.channel ?? "rakuten";
  const days = Math.max(1, query.days ?? DEFAULT_DAYS);
  const limit = Math.min(500, Math.max(1, query.limit ?? DEFAULT_LIMIT));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const products = await prisma.products.findMany({
    where: {
      organization_id: query.organizationId,
      deleted_at: null,
      market_prices: {
        some: { source_channel: channel, fetched_at: { lte: cutoff } }
      }
    },
    select: {
      id: true,
      title: true,
      image_url: true,
      market_prices: {
        where: { source_channel: channel },
        orderBy: { fetched_at: "desc" },
        select: {
          price_amount: true,
          is_in_stock: true,
          fetched_at: true,
          raw_payload: true
        },
        take: 30
      }
    },
    take: limit
  });

  const productIds = products.map((product) => product.id);
  const candidates =
    productIds.length === 0
      ? []
      : await prisma.sourcing_candidates.findMany({
          where: {
            organization_id: query.organizationId,
            deleted_at: null,
            status: { in: ["new", "watching", "approved"] },
            product_id: { in: productIds }
          },
          select: {
            product_id: true,
            estimated_profit_amount: true,
            estimated_roi: true,
            updated_at: true
          },
          orderBy: { updated_at: "desc" }
        });

  const candidateByProduct = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    if (candidate.product_id && !candidateByProduct.has(candidate.product_id)) {
      candidateByProduct.set(candidate.product_id, candidate);
    }
  }

  const rows: PriceTrendRow[] = [];

  for (const product of products) {
    const prices = product.market_prices;
    if (prices.length < 2) continue;

    const current = prices[0];
    const baseCandidates = prices.filter((price) => price.fetched_at.getTime() <= cutoff.getTime());
    const base = baseCandidates.length > 0 ? baseCandidates[0] : prices[prices.length - 1];
    if (!base || base.fetched_at.getTime() >= current.fetched_at.getTime()) continue;

    const currentPrice = Number(current.price_amount);
    const basePrice = Number(base.price_amount);
    if (!Number.isFinite(currentPrice) || !Number.isFinite(basePrice) || basePrice <= 0) continue;

    const priceChange = Math.round(currentPrice - basePrice);
    const priceChangeRate = (currentPrice - basePrice) / basePrice;

    if (query.minRateAbs != null && Math.abs(priceChangeRate) < query.minRateAbs) continue;

    const currentRank = extractRank(current.raw_payload);
    const baseRank = extractRank(base.raw_payload);
    const rankChange = currentRank != null && baseRank != null ? baseRank - currentRank : null;

    const candidate = candidateByProduct.get(product.id);
    const estimatedProfit =
      candidate?.estimated_profit_amount != null ? Number(candidate.estimated_profit_amount) : null;
    const roi = candidate?.estimated_roi != null ? Number(candidate.estimated_roi) : null;
    const judgement = judgementFromMetrics(estimatedProfit, roi);

    const daysBetween =
      Math.round(((current.fetched_at.getTime() - base.fetched_at.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10;

    rows.push({
      productId: product.id,
      productTitle: product.title,
      productImageUrl: product.image_url,
      channel,
      currentPrice,
      basePrice,
      priceChange,
      priceChangeRate,
      currentRank,
      baseRank,
      rankChange,
      inStock: current.is_in_stock,
      currentFetchedAt: current.fetched_at.toISOString(),
      baseFetchedAt: base.fetched_at.toISOString(),
      daysBetween,
      estimatedProfit,
      roi,
      judgement
    });
  }

  rows.sort((a, b) => b.priceChangeRate - a.priceChangeRate);

  return { channel, days, evaluated: products.length, rows };
}

function extractRank(payload: unknown): number | null {
  if (payload && typeof payload === "object" && "rank" in payload) {
    const value = (payload as { rank?: unknown }).rank;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function judgementFromMetrics(profit: number | null, roi: number | null): "A" | "B" | "C" | "NG" | null {
  if (profit == null || roi == null) return null;
  if (profit <= 0 || roi <= 0) return "NG";
  if (profit >= 2000 && roi >= 0.2) return "A";
  if (profit >= 800 && roi >= 0.1) return "B";
  return "C";
}
