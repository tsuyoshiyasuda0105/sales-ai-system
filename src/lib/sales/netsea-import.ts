import {
  searchNetseaItems,
  NetseaApiError,
  type NetseaItem,
  type NetseaItemSearchParams,
  type NetseaSetEntry
} from "@/lib/integrations/netsea";
import { saveSupplierCatalogItems, type SupplierImportItem } from "@/lib/sales/supplier-import";
import type { TargetSalesChannel } from "@/lib/sales/profit";

export type NetseaSweepResult = {
  pagesFetched: number;
  totalItems: number;
  totalSetEntries: number;
  totalSaved: number;
  nextDirectItemId?: string;
  errors: Array<{ page: number; message: string }>;
};

const SWEEP_DELAY_MS = 600;
const DEFAULT_MAX_PAGES = 3;
// Vercel Hobby の 10秒上限に対するソフト予算。これを超えそうな場合、
// 次のページに進むのを諦めてここまでの結果を返す。
const TOTAL_BUDGET_MS = 8500;
// 次のページを開始する前に確保しておく最低残り時間。fetch + 永続化 + 余裕。
const MIN_PAGE_BUDGET_MS = 2500;

export async function sweepNetsea(options: {
  organizationId: string;
  supplierIds: string[];
  categoryId?: number;
  janCode?: string;
  priceFrom?: number;
  priceTo?: number;
  excludeSoldOut?: boolean;
  netShopOnly?: boolean;
  maxPages?: number;
  targetChannel?: TargetSalesChannel;
  discoveredByUserId?: string;
}): Promise<NetseaSweepResult> {
  if (!options.supplierIds || options.supplierIds.length === 0) {
    throw new NetseaApiError("At least one supplierId is required.", 400, "missing_supplier_ids");
  }

  const maxPages = Math.min(20, Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES));
  const supplierIdsCsv = options.supplierIds.slice(0, 10).join(",");

  const summary: NetseaSweepResult = {
    pagesFetched: 0,
    totalItems: 0,
    totalSetEntries: 0,
    totalSaved: 0,
    errors: []
  };

  let nextDirectItemId: string | undefined;
  const startedAt = Date.now();

  for (let page = 0; page < maxPages; page += 1) {
    // 予算ガード: 残り時間が永続化に必要なだけ無さそうなら、ここまでの結果を返す。
    // (関数全体が Vercel に殺されて UI が「取得中…」のまま固まるよりはマシ。)
    const elapsed = Date.now() - startedAt;
    if (elapsed > TOTAL_BUDGET_MS - MIN_PAGE_BUDGET_MS) {
      summary.errors.push({
        page: page + 1,
        message: `Budget exhausted after ${(elapsed / 1000).toFixed(1)}s; stopped before page ${page + 1}.`
      });
      break;
    }

    const params: NetseaItemSearchParams = {
      supplierIds: supplierIdsCsv,
      categoryId: options.categoryId,
      janCode: options.janCode,
      priceFrom: options.priceFrom,
      priceTo: options.priceTo,
      soldOutFlag: options.excludeSoldOut ? "N" : undefined,
      dealNetShopFlag: options.netShopOnly ? "Y" : undefined,
      nextDirectItemId
    };

    let result;
    try {
      result = await searchNetseaItems(params);
    } catch (error) {
      summary.errors.push({
        page: page + 1,
        message: error instanceof Error ? error.message : "Unknown NETSEA error"
      });
      break;
    }

    summary.pagesFetched += 1;
    summary.totalItems += result.data.length;

    const supplierItems = flattenNetseaToSupplierItems(result.data);
    summary.totalSetEntries += supplierItems.length;

    if (supplierItems.length > 0) {
      // 残り予算を秒精度で計算して saveSupplierCatalogItems に渡す。
      // これにより、1ページ分の保存中に予算が尽きたら途中で打ち切れる
      // (Vercel 関数全体が殺される前にクリーンに返せる)。
      const remainingBudget = Math.max(1000, TOTAL_BUDGET_MS - (Date.now() - startedAt) - 1000);

      try {
        const { saved, itemErrors, budgetExhausted } = await saveSupplierCatalogItems(supplierItems, {
          organizationId: options.organizationId,
          supplier: "netsea",
          targetChannel: options.targetChannel,
          discoveredByUserId: options.discoveredByUserId,
          budgetMs: remainingBudget
        });
        summary.totalSaved += saved.length;

        // Item-level エラー (race / unique 違反 etc.) を先頭 3 件だけ集約。
        // すべて積むと UI が長くなり、繰り返しの同種エラーは大抵似たメッセージ。
        if (itemErrors.length > 0) {
          summary.errors.push({
            page: page + 1,
            message: `${itemErrors.length} item(s) failed (showing first 2): ${itemErrors
              .slice(0, 2)
              .map((entry) => `"${entry.title.slice(0, 40)}" → ${entry.message.slice(0, 100)}`)
              .join(" | ")}`
          });
        }

        if (budgetExhausted) {
          summary.errors.push({
            page: page + 1,
            message: `Save budget exhausted mid-page; saved ${saved.length}/${supplierItems.length} items.`
          });
          break;
        }
      } catch (error) {
        summary.errors.push({
          page: page + 1,
          message: error instanceof Error ? error.message : "Persistence failed"
        });
      }
    }

    if (!result.nextDirectItemId) {
      summary.nextDirectItemId = undefined;
      break;
    }

    summary.nextDirectItemId = result.nextDirectItemId;
    nextDirectItemId = result.nextDirectItemId;

    if (page < maxPages - 1) {
      await sleep(SWEEP_DELAY_MS);
    }
  }

  return summary;
}

/**
 * NETSEA returns each item with a `set` array of variations (color/size/etc.). Each set entry
 * has its own direct_item_id, jan_code, set_price (税込), and sold_out_flag. We flatten them
 * one-row-per-set so they each become individual sourcing_candidates.
 */
export function flattenNetseaToSupplierItems(items: NetseaItem[]): SupplierImportItem[] {
  const out: SupplierImportItem[] = [];

  for (const item of items) {
    const setEntries: Array<Partial<NetseaSetEntry>> =
      Array.isArray(item.set) && item.set.length > 0 ? item.set : [{}];

    for (const set of setEntries) {
      const price = pickPrice(set);
      if (price == null || price <= 0) continue;

      const title = buildTitle(item, set);
      const jan = normalizeJan(set.jan_code) ?? normalizeJan(item.jan_code);

      out.push({
        jan: jan ?? undefined,
        supplierSku: set.direct_item_id ?? undefined,
        title,
        supplierPrice: price,
        supplierShippingCost: item.ship_fee ?? 0,
        supplierUrl: item.product_url,
        stockQty: set.sold_out_flag === "Y" ? 0 : undefined,
        condition: "new",
        imageUrl: item.image_url_1,
        notes: item.description ? truncate(item.description, 240) : undefined
      });
    }
  }

  return out;
}

function pickPrice(set: Partial<NetseaSetEntry>): number | null {
  if (typeof set.set_price === "number" && set.set_price > 0) return set.set_price;
  if (typeof set.set_price_without_tax === "number" && set.set_price_without_tax > 0) {
    const tax = typeof set.set_price_tax === "number" ? set.set_price_tax : 0;
    return set.set_price_without_tax + tax;
  }
  if (typeof set.price === "number" && set.price > 0) return Math.round(set.price * 1.1);
  return null;
}

function buildTitle(item: NetseaItem, set: Partial<NetseaSetEntry>): string {
  const base = item.product_name?.trim() || item.product_id || "(無題)";
  const variantBits = [set.label, set.branch_code].filter(Boolean) as string[];
  if (variantBits.length === 0) return base;
  return `${base}(${variantBits.join(" / ")})`;
}

function normalizeJan(value: string | number | undefined): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length === 13 || digits.length === 8 ? digits : null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
