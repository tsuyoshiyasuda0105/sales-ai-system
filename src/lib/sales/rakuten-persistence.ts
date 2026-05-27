import { prisma } from "@/lib/db";
import type { NormalizedRakutenItem } from "@/lib/integrations/rakuten";
import { estimateSourcingProfit, type TargetSalesChannel } from "@/lib/sales/profit";
import { extractJanFromTitle } from "@/lib/sales/jan";

type SaveRakutenSearchOptions = {
  organizationId: string;
  keyword: string;
  targetChannel?: TargetSalesChannel;
  discoveredByUserId?: string;
};

// 🚀 並列チャンク処理: Vercel Hobby の 10秒タイムアウトに対する余裕を作る。
//   従来は items を for ループで完全直列 (1件 ~ 200-400ms × 30件 = 6-12秒) だったが、
//   5並列にすれば 1.5-2秒台に収まる。Prisma の connection pool (default 10) を
//   食い切らないよう CHUNK_SIZE は控えめにしておく。
const SAVE_CHUNK_SIZE = 5;

export async function saveRakutenSearchResults(
  items: NormalizedRakutenItem[],
  options: SaveRakutenSearchOptions
) {
  // 同一 itemCode が複数回現れると、Promise.all 内で findOrCreate のレースに
  // 突入して同じ商品の重複行ができてしまう。最初の出現だけ残してdedupe。
  const seenCodes = new Set<string>();
  const dedupedItems = items.filter((item) => {
    if (seenCodes.has(item.itemCode)) return false;
    seenCodes.add(item.itemCode);
    return true;
  });

  const saved: Array<Awaited<ReturnType<typeof processSingleRakutenItem>>> = [];

  for (let i = 0; i < dedupedItems.length; i += SAVE_CHUNK_SIZE) {
    const chunk = dedupedItems.slice(i, i + SAVE_CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map((item) => processSingleRakutenItem(item, options))
    );
    saved.push(...chunkResults);
  }

  return saved;
}

async function processSingleRakutenItem(
  item: NormalizedRakutenItem,
  options: SaveRakutenSearchOptions
) {
  const product = await findOrCreateProductFromRakutenItem(item, options);

  // market_prices.create と upsertSourcingCandidate は互いに独立 (両方とも product.id しか
  // 共有しない) ので Promise.all で並列実行できる。
  const [marketPrice, candidate] = await Promise.all([
    prisma.market_prices.create({
      data: {
        organization_id: options.organizationId,
        product_id: product.id,
        source_channel: "rakuten",
        source_product_id: item.itemCode,
        source_url: item.affiliateUrl || item.itemUrl,
        condition: "new",
        price_amount: item.itemPrice,
        currency_code: "JPY",
        shipping_amount: item.postageFlag === 0 ? 0 : null,
        point_value_amount: calculatePointValue(item),
        available_quantity: item.availability === 1 ? 1 : 0,
        is_in_stock: item.availability === 1,
        seller_name: item.shopName,
        review_count: item.reviewCount,
        review_rating: item.reviewAverage,
        raw_payload: item.raw as object
      }
    }),
    upsertSourcingCandidate(item, product.id, options)
  ]);

  return {
    productId: product.id,
    marketPriceId: marketPrice.id,
    sourcingCandidateId: candidate.id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    itemPrice: item.itemPrice,
    targetExpectedPrice: decimalToNumber(candidate.target_expected_price_amount),
    estimatedProfit: decimalToNumber(candidate.estimated_profit_amount),
    estimatedRoi: decimalToNumber(candidate.estimated_roi)
  };
}

async function findOrCreateProductFromRakutenItem(
  item: NormalizedRakutenItem,
  options: SaveRakutenSearchOptions
) {
  const existingIdentifier = await prisma.product_identifiers.findFirst({
    where: {
      organization_id: options.organizationId,
      identifier_type: "source_product_id",
      identifier_value: item.itemCode,
      source_channel: "rakuten",
      deleted_at: null
    },
    include: {
      products_product_identifiers_product_idToproducts: true
    }
  });

  if (existingIdentifier?.products_product_identifiers_product_idToproducts) {
    return existingIdentifier.products_product_identifiers_product_idToproducts;
  }

  const jan = extractJanFromTitle(item.itemName);

  return prisma.products.create({
    data: {
      organization_id: options.organizationId,
      title: item.itemName,
      normalized_title: normalizeTitle(item.itemName),
      category: item.genreId ? `rakuten:${item.genreId}` : "rakuten",
      description: item.catchcopy,
      image_url: item.imageUrl,
      status: "active",
      default_condition: "new",
      notes: `Imported from Rakuten keyword: ${options.keyword}`,
      created_by_user_id: options.discoveredByUserId,
      updated_by_user_id: options.discoveredByUserId,
      product_identifiers_product_identifiers_product_idToproducts: {
        create: [
          {
            organization_id: options.organizationId,
            identifier_type: "source_product_id",
            identifier_value: item.itemCode,
            source_channel: "rakuten",
            is_primary: true,
            confidence_score: 100,
            metadata: {
              itemUrl: item.itemUrl,
              affiliateUrl: item.affiliateUrl,
              shopName: item.shopName
            }
          },
          ...(jan
            ? [
                {
                  organization_id: options.organizationId,
                  identifier_type: "jan" as const,
                  identifier_value: jan,
                  source_channel: "rakuten" as const,
                  is_primary: false,
                  confidence_score: 80,
                  metadata: { extractedFrom: "rakuten_title" }
                }
              ]
            : [])
        ]
      }
    }
  });
}

async function upsertSourcingCandidate(
  item: NormalizedRakutenItem,
  productId: string,
  options: SaveRakutenSearchOptions
) {
  const existing = await prisma.sourcing_candidates.findFirst({
    where: {
      organization_id: options.organizationId,
      source_channel: "rakuten",
      source_product_id: item.itemCode,
      status: {
        in: ["new", "watching", "approved"]
      },
      deleted_at: null
    }
  });
  const sourceShipping = item.postageFlag === 0 ? 0 : 0;
  const sourcePointValue = calculatePointValue(item);
  const targetChannel = options.targetChannel ?? "amazon_jp";
  const estimate = estimateSourcingProfit({
    sourcePrice: item.itemPrice,
    sourceShipping,
    sourcePointValue,
    targetChannel
  });

  const data = {
    product_id: productId,
    source_url: item.affiliateUrl || item.itemUrl,
    source_title: item.itemName,
    source_condition: "new" as const,
    source_price_amount: item.itemPrice,
    source_shipping_amount: sourceShipping,
    source_point_value_amount: sourcePointValue,
    target_channel: targetChannel,
    target_expected_price_amount: estimate.expectedSellPrice,
    estimated_platform_fee_amount: estimate.platformFee,
    estimated_fba_fee_amount: estimate.fbaFee,
    estimated_shipping_amount: estimate.shipping,
    estimated_packaging_amount: estimate.packaging,
    estimated_profit_amount: estimate.profit,
    estimated_roi: estimate.roi,
    estimated_profit_margin: estimate.profitMargin,
    break_even_price_amount: estimate.breakEvenPrice,
    recommended_max_purchase_quantity: estimate.recommendedMaxPurchaseQuantity,
    status: "watching" as const,
    raw_payload: item.raw as object,
    discovered_by_user_id: options.discoveredByUserId,
    updated_at: new Date()
  };

  if (existing) {
    // 🔒 Preserve real-price state: if this candidate was previously promoted to
    // target_channel = yahoo_shopping by a Yahoo refresh (i.e. real-priced), do NOT overwrite
    // the target channel and profit fields back to amazon_jp + ×1.35 markup. Only refresh
    // the source-side data (latest Rakuten price/shipping/points) and let the next Yahoo
    // refresh recompute the target side.
    const existingTargetChannel = String(existing.target_channel);
    const preserveRealPrice = existingTargetChannel === "yahoo_shopping";
    const updateData = preserveRealPrice
      ? {
          product_id: data.product_id,
          source_url: data.source_url,
          source_title: data.source_title,
          source_condition: data.source_condition,
          source_price_amount: data.source_price_amount,
          source_shipping_amount: data.source_shipping_amount,
          source_point_value_amount: data.source_point_value_amount,
          raw_payload: data.raw_payload,
          discovered_by_user_id: data.discovered_by_user_id,
          updated_at: data.updated_at
        }
      : data;
    const candidate = await prisma.sourcing_candidates.update({
      where: { id: existing.id },
      data: updateData
    });

    await createAiScoreForCandidate(candidate.id, productId, options, estimate);

    return candidate;
  }

  const candidate = await prisma.sourcing_candidates.create({
    data: {
      organization_id: options.organizationId,
      source_channel: "rakuten",
      source_product_id: item.itemCode,
      ...data
    }
  });

  await createAiScoreForCandidate(candidate.id, productId, options, estimate);

  return candidate;
}

async function createAiScoreForCandidate(
  candidateId: string,
  productId: string,
  options: SaveRakutenSearchOptions,
  estimate: ReturnType<typeof estimateSourcingProfit>
) {
  return prisma.ai_scores.create({
    data: {
      organization_id: options.organizationId,
      sourcing_candidate_id: candidateId,
      product_id: productId,
      judgement: estimate.judgement,
      total_score: estimate.totalScore,
      profit_score: Math.min(100, Math.max(0, Math.round((estimate.profit / 3000) * 100))),
      risk_score: estimate.roi < 0.1 ? 70 : 30,
      recommended_action: estimate.recommendedMaxPurchaseQuantity > 0 ? "watch_or_buy" : "review",
      recommended_quantity: estimate.recommendedMaxPurchaseQuantity,
      reason_summary: estimate.reasonSummary,
      risk_notes: estimate.riskNotes,
      model_name: "rules-v1",
      prompt_version: "profit-estimate-v1",
      input_snapshot: {
        source: "rakuten",
        targetChannel: estimate.targetChannel
      },
      output_snapshot: estimate,
      created_by_user_id: options.discoveredByUserId
    }
  });
}

function calculatePointValue(item: NormalizedRakutenItem) {
  const pointRate = item.pointRate ?? 1;
  return Math.floor((item.itemPrice * pointRate) / 100);
}

function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();

  return Number(value);
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
