import { prisma } from "@/lib/db";
import { estimateSourcingProfit, type TargetSalesChannel } from "@/lib/sales/profit";
import { extractJanFromTitle } from "@/lib/sales/jan";

export type SupplierName = "netsea" | "cj" | "topseller" | "other";

export type SupplierImportItem = {
  jan?: string;
  supplierSku?: string;
  title: string;
  supplierPrice: number;
  supplierShippingCost?: number;
  supplierUrl?: string;
  stockQty?: number;
  condition?: "new" | "used" | "unknown";
  imageUrl?: string;
  notes?: string;
};

export type SupplierImportOptions = {
  organizationId: string;
  supplier: SupplierName;
  targetChannel?: TargetSalesChannel;
  discoveredByUserId?: string;
};

export type SupplierImportSavedItem = {
  productId: string;
  marketPriceId: string;
  sourcingCandidateId: string;
  title: string;
  supplierPrice: number;
  targetExpectedPrice: number | null;
  estimatedProfit: number | null;
  estimatedRoi: number | null;
};

export type SupplierImportItemError = {
  title: string;
  message: string;
};

export type SupplierImportResult = {
  saved: SupplierImportSavedItem[];
  itemErrors: SupplierImportItemError[];
  budgetExhausted: boolean;
};

/** True if the error is a Prisma unique constraint violation (P2002). */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error == null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code === "P2002";
}

// 🚀 並列チャンク化: NETSEA 100件×3ページで for ループ直列だと 1件 100-300ms × 300
//   = 30-90秒で Vercel の 10秒タイムアウトを確実に超えていた。5並列にすれば
//   Prisma の connection pool (default 10) も食い切らずに 6-10秒で収まる。
const SUPPLIER_SAVE_CHUNK_SIZE = 5;

/**
 * Save a batch of supplier-catalog items. Tolerant of per-item failures:
 * a single race condition or unique-constraint hit no longer wipes out the
 * whole batch (Promise.allSettled instead of Promise.all). The caller gets
 * back both successes and per-item errors so the UI can show partial results.
 *
 * Honors an optional time budget — if elapsed time exceeds budgetMs, the
 * function stops processing further chunks and reports budgetExhausted=true,
 * which is the difference between "all clean" and "more pages remain".
 */
export async function saveSupplierCatalogItems(
  items: SupplierImportItem[],
  options: SupplierImportOptions & { budgetMs?: number }
): Promise<SupplierImportResult> {
  // Dedupe by the strongest available identifier. We don't dedupe by JAN here
  // because the same JAN can legitimately appear with different supplierSkus
  // (size/color variations of one product); the unique-constraint retry in
  // findOrCreateProduct handles the resulting JAN collision safely.
  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    const key = item.supplierSku ?? item.supplierUrl ?? `${item.title}::${item.supplierPrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const saved: SupplierImportSavedItem[] = [];
  const itemErrors: SupplierImportItemError[] = [];
  let budgetExhausted = false;

  const startedAt = Date.now();
  const budgetMs = options.budgetMs ?? Infinity;

  for (let i = 0; i < deduped.length; i += SUPPLIER_SAVE_CHUNK_SIZE) {
    if (Date.now() - startedAt > budgetMs) {
      budgetExhausted = true;
      break;
    }

    const chunk = deduped.slice(i, i + SUPPLIER_SAVE_CHUNK_SIZE);
    // allSettled so one item's failure doesn't cancel the others in the chunk
    // AND doesn't cancel subsequent chunks. Items that fail go into itemErrors.
    const results = await Promise.allSettled(chunk.map((item) => saveSingleSupplierItem(item, options)));

    for (let j = 0; j < results.length; j += 1) {
      const result = results[j];
      if (result.status === "fulfilled") {
        saved.push(result.value);
      } else {
        const item = chunk[j];
        itemErrors.push({
          title: item.title,
          message: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });
      }
    }
  }

  return { saved, itemErrors, budgetExhausted };
}

async function saveSingleSupplierItem(
  item: SupplierImportItem,
  options: SupplierImportOptions
): Promise<SupplierImportSavedItem> {
  const jan = normalizeJan(item.jan) ?? extractJanFromTitle(item.title) ?? undefined;
  const product = await findOrCreateProduct(item, jan, options);
  const condition = normalizeCondition(item.condition);

  // market_prices.create と upsertCandidate は両方とも product.id しか共有しないので
  // 並列化できる。1件あたり ~50-100ms の節約。
  const [marketPrice, candidate] = await Promise.all([
    prisma.market_prices.create({
      data: {
        organization_id: options.organizationId,
        product_id: product.id,
        source_channel: "other",
        source_product_id: item.supplierSku ?? item.supplierUrl ?? null,
        source_url: item.supplierUrl ?? null,
        condition,
        price_amount: item.supplierPrice,
        currency_code: "JPY",
        shipping_amount: item.supplierShippingCost ?? 0,
        available_quantity: item.stockQty ?? null,
        is_in_stock: item.stockQty == null ? null : item.stockQty > 0,
        raw_payload: {
          supplier: options.supplier,
          jan: jan ?? null,
          supplierSku: item.supplierSku ?? null,
          supplierUrl: item.supplierUrl ?? null,
          stockQty: item.stockQty ?? null,
          condition,
          notes: item.notes ?? null
        }
      }
    }),
    upsertCandidate(item, product.id, jan, condition, options)
  ]);

  return {
    productId: product.id,
    marketPriceId: marketPrice.id,
    sourcingCandidateId: candidate.id,
    title: item.title,
    supplierPrice: item.supplierPrice,
    targetExpectedPrice: decimalToNumber(candidate.target_expected_price_amount),
    estimatedProfit: decimalToNumber(candidate.estimated_profit_amount),
    estimatedRoi: decimalToNumber(candidate.estimated_roi)
  };
}

async function findOrCreateProduct(
  item: SupplierImportItem,
  jan: string | undefined,
  options: SupplierImportOptions
) {
  // 1. JAN lookup first — most authoritative identifier.
  if (jan) {
    const found = await lookupProductByIdentifier(options.organizationId, "jan", jan, null);
    if (found) return found;
  }

  // 2. supplierSku fallback.
  if (item.supplierSku) {
    const found = await lookupProductByIdentifier(
      options.organizationId,
      "source_product_id",
      item.supplierSku,
      "other"
    );
    if (found) return found;
  }

  // 3. Create — handle P2002 race condition gracefully.
  // If two parallel items have the same JAN, both miss the findFirst and both
  // try to create. Postgres unique constraint catches the second; on P2002 we
  // re-lookup by the colliding identifier and return that product instead.
  try {
    return await prisma.products.create({
      data: {
        organization_id: options.organizationId,
        title: item.title,
        normalized_title: normalizeTitle(item.title),
        category: `supplier:${options.supplier}`,
        description: item.notes,
        image_url: item.imageUrl,
        status: "active",
        default_condition: normalizeCondition(item.condition),
        notes: `Imported from ${options.supplier} CSV`,
        created_by_user_id: options.discoveredByUserId,
        updated_by_user_id: options.discoveredByUserId,
        product_identifiers_product_identifiers_product_idToproducts: {
          create: [
            ...(item.supplierSku
              ? [
                  {
                    organization_id: options.organizationId,
                    identifier_type: "source_product_id" as const,
                    identifier_value: item.supplierSku,
                    source_channel: "other" as const,
                    is_primary: true,
                    confidence_score: 100,
                    metadata: { supplier: options.supplier, supplierUrl: item.supplierUrl }
                  }
                ]
              : []),
            ...(jan
              ? [
                  {
                    organization_id: options.organizationId,
                    identifier_type: "jan" as const,
                    identifier_value: jan,
                    source_channel: "other" as const,
                    is_primary: !item.supplierSku,
                    confidence_score: 90,
                    metadata: { supplier: options.supplier }
                  }
                ]
              : [])
          ]
        }
      }
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    // Race: parallel sibling created the same identifier between our findFirst
    // and our create. Re-lookup; the colliding identifier MUST exist now.
    if (jan) {
      const found = await lookupProductByIdentifier(options.organizationId, "jan", jan, null);
      if (found) return found;
    }
    if (item.supplierSku) {
      const found = await lookupProductByIdentifier(
        options.organizationId,
        "source_product_id",
        item.supplierSku,
        "other"
      );
      if (found) return found;
    }
    // We hit P2002 but can't find the colliding row — something is genuinely
    // weird (deleted between create and re-lookup?). Surface the original.
    throw error;
  }
}

async function lookupProductByIdentifier(
  organizationId: string,
  type: "jan" | "source_product_id",
  value: string,
  sourceChannel: "other" | null
) {
  const identifier = await prisma.product_identifiers.findFirst({
    where: {
      organization_id: organizationId,
      identifier_type: type,
      identifier_value: value,
      ...(sourceChannel ? { source_channel: sourceChannel } : {}),
      deleted_at: null
    },
    include: { products_product_identifiers_product_idToproducts: true }
  });

  return identifier?.products_product_identifiers_product_idToproducts ?? null;
}

async function upsertCandidate(
  item: SupplierImportItem,
  productId: string,
  jan: string | undefined,
  condition: "new" | "used" | "unknown",
  options: SupplierImportOptions
) {
  const targetChannel = options.targetChannel ?? "yahoo_shopping";
  const supplierShipping = item.supplierShippingCost ?? 0;
  const estimate = estimateSourcingProfit({
    sourcePrice: item.supplierPrice,
    sourceShipping: supplierShipping,
    sourcePointValue: 0,
    targetChannel
  });

  const sourceProductId = item.supplierSku ?? jan ?? item.supplierUrl ?? `${options.supplier}:${productId.slice(0, 8)}`;

  const existing = await prisma.sourcing_candidates.findFirst({
    where: {
      organization_id: options.organizationId,
      source_channel: "other",
      source_product_id: sourceProductId,
      status: { in: ["new", "watching", "approved"] },
      deleted_at: null
    }
  });

  const data = {
    product_id: productId,
    source_url: item.supplierUrl ?? null,
    source_title: item.title,
    source_condition: condition,
    source_price_amount: item.supplierPrice,
    source_shipping_amount: supplierShipping,
    source_point_value_amount: 0,
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
    raw_payload: {
      supplier: options.supplier,
      jan: jan ?? null,
      stockQty: item.stockQty ?? null,
      notes: item.notes ?? null
    },
    discovered_by_user_id: options.discoveredByUserId,
    updated_at: new Date()
  };

  if (existing) {
    // 🔒 Preserve real-price state when the candidate has already been promoted to
    // target_channel = yahoo_shopping via a Yahoo refresh. Re-importing the supplier catalog
    // (NETSEA/CSV) only refreshes the cost side; the Yahoo-derived target is kept.
    const preserveRealPrice = String(existing.target_channel) === "yahoo_shopping";
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
    return prisma.sourcing_candidates.update({ where: { id: existing.id }, data: updateData });
  }

  return prisma.sourcing_candidates.create({
    data: {
      organization_id: options.organizationId,
      source_channel: "other",
      source_product_id: sourceProductId,
      ...data
    }
  });
}

function normalizeJan(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 13 || digits.length === 8 ? digits : null;
}

function normalizeCondition(value: string | undefined): "new" | "used" | "unknown" {
  if (!value) return "new";
  const lowered = value.toLowerCase();
  if (lowered === "new" || lowered === "新品") return "new";
  if (lowered === "used" || lowered === "中古") return "used";
  return "unknown";
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}
