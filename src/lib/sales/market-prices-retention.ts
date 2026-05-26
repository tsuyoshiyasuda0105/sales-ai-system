import { prisma } from "@/lib/db";

export type PruneOldMarketPricesResult = {
  deletedCount: number;
  keepPerProductChannel: number;
};

/**
 * Keep only the latest N market_price rows per (product_id, source_channel) per organization and
 * delete the older ones. Implemented as a single CTE so it's atomic on the DB side.
 *
 * Rows with product_id IS NULL are left untouched (they aren't associated with a product so we
 * can't safely partition them).
 */
export async function pruneOldMarketPrices(
  organizationId: string,
  options: { keepPerProductChannel?: number } = {}
): Promise<PruneOldMarketPricesResult> {
  const keepPerProductChannel = Math.max(1, options.keepPerProductChannel ?? 5);

  const deleted = await prisma.$executeRaw`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY product_id, source_channel
        ORDER BY fetched_at DESC
      ) AS rn
      FROM market_prices
      WHERE organization_id = ${organizationId}::uuid
        AND product_id IS NOT NULL
    )
    DELETE FROM market_prices
    WHERE id IN (SELECT id FROM ranked WHERE rn > ${keepPerProductChannel})
  `;

  return { deletedCount: Number(deleted), keepPerProductChannel };
}
