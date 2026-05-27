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

export async function saveSupplierCatalogItems(
  items: SupplierImportItem[],
  options: SupplierImportOptions
): Promise<SupplierImportSavedItem[]> {
  const saved: SupplierImportSavedItem[] = [];

  for (const item of items) {
    const jan = normalizeJan(item.jan) ?? extractJanFromTitle(item.title) ?? undefined;
    const product = await findOrCreateProduct(item, jan, options);
    const condition = normalizeCondition(item.condition);

    const marketPrice = await prisma.market_prices.create({
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
    });

    const candidate = await upsertCandidate(item, product.id, jan, condition, options);

    saved.push({
      productId: product.id,
      marketPriceId: marketPrice.id,
      sourcingCandidateId: candidate.id,
      title: item.title,
      supplierPrice: item.supplierPrice,
      targetExpectedPrice: decimalToNumber(candidate.target_expected_price_amount),
      estimatedProfit: decimalToNumber(candidate.estimated_profit_amount),
      estimatedRoi: decimalToNumber(candidate.estimated_roi)
    });
  }

  return saved;
}

async function findOrCreateProduct(
  item: SupplierImportItem,
  jan: string | undefined,
  options: SupplierImportOptions
) {
  if (jan) {
    const existing = await prisma.product_identifiers.findFirst({
      where: {
        organization_id: options.organizationId,
        identifier_type: "jan",
        identifier_value: jan,
        deleted_at: null
      },
      include: { products_product_identifiers_product_idToproducts: true }
    });

    if (existing?.products_product_identifiers_product_idToproducts) {
      return existing.products_product_identifiers_product_idToproducts;
    }
  }

  if (item.supplierSku) {
    const existing = await prisma.product_identifiers.findFirst({
      where: {
        organization_id: options.organizationId,
        identifier_type: "source_product_id",
        identifier_value: item.supplierSku,
        source_channel: "other",
        deleted_at: null
      },
      include: { products_product_identifiers_product_idToproducts: true }
    });

    if (existing?.products_product_identifiers_product_idToproducts) {
      return existing.products_product_identifiers_product_idToproducts;
    }
  }

  return prisma.products.create({
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
    return prisma.sourcing_candidates.update({ where: { id: existing.id }, data });
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
