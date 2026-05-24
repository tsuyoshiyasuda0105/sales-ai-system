import { prisma } from "@/lib/db";
import type { NormalizedRakutenItem } from "@/lib/integrations/rakuten";

type SaveRakutenSearchOptions = {
  organizationId: string;
  keyword: string;
  targetChannel?: "amazon_jp" | "mercari" | "yahoo_auction" | "yahoo_shopping" | "store";
  discoveredByUserId?: string;
};

export async function saveRakutenSearchResults(
  items: NormalizedRakutenItem[],
  options: SaveRakutenSearchOptions
) {
  const saved = [];

  for (const item of items) {
    const product = await findOrCreateProductFromRakutenItem(item, options);

    const marketPrice = await prisma.market_prices.create({
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
    });

    const candidate = await upsertSourcingCandidate(item, product.id, options);

    saved.push({
      productId: product.id,
      marketPriceId: marketPrice.id,
      sourcingCandidateId: candidate.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemPrice: item.itemPrice
    });
  }

  return saved;
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
        create: {
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
        }
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

  const data = {
    product_id: productId,
    source_url: item.affiliateUrl || item.itemUrl,
    source_title: item.itemName,
    source_condition: "new" as const,
    source_price_amount: item.itemPrice,
    source_shipping_amount: item.postageFlag === 0 ? 0 : 0,
    source_point_value_amount: calculatePointValue(item),
    target_channel: options.targetChannel ?? "amazon_jp",
    estimated_shipping_amount: 0,
    estimated_packaging_amount: 0,
    status: "watching" as const,
    raw_payload: item.raw as object,
    discovered_by_user_id: options.discoveredByUserId,
    updated_at: new Date()
  };

  if (existing) {
    return prisma.sourcing_candidates.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.sourcing_candidates.create({
    data: {
      organization_id: options.organizationId,
      source_channel: "rakuten",
      source_product_id: item.itemCode,
      ...data
    }
  });
}

function calculatePointValue(item: NormalizedRakutenItem) {
  const pointRate = item.pointRate ?? 1;
  return Math.floor((item.itemPrice * pointRate) / 100);
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
