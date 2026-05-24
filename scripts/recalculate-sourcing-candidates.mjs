import { PrismaClient } from "@prisma/client";
import { estimateSourcingProfit } from "../src/lib/sales/profit.ts";

const prisma = new PrismaClient();

const ACTIVE_STATUSES = ["new", "watching", "approved"];
const TARGET_CHANNELS = new Set(["amazon_jp", "mercari", "yahoo_auction", "yahoo_shopping", "store"]);

const args = parseArgs(process.argv.slice(2));
const write = Boolean(args.write);
const organizationId = args.organizationId;
const limit = Number.parseInt(args.limit ?? "500", 10);
const targetChannelOverride = normalizeTargetChannel(args.targetChannel);
const createScores = args.createScores !== "false";

async function main() {
  const candidates = await prisma.sourcing_candidates.findMany({
    where: {
      ...(organizationId ? { organization_id: organizationId } : {}),
      deleted_at: null,
      status: {
        in: ACTIVE_STATUSES
      }
    },
    orderBy: { created_at: "desc" },
    take: Number.isFinite(limit) ? limit : 500
  });

  const results = [];

  for (const candidate of candidates) {
    const targetChannel = targetChannelOverride ?? normalizeTargetChannel(String(candidate.target_channel)) ?? "amazon_jp";
    const estimate = estimateSourcingProfit({
      sourcePrice: decimalToNumber(candidate.source_price_amount),
      sourceShipping: decimalToNumber(candidate.source_shipping_amount),
      sourcePointValue: decimalToNumber(candidate.source_point_value_amount),
      targetChannel
    });

    const before = {
      expectedSellPrice: nullableDecimalToNumber(candidate.target_expected_price_amount),
      profit: nullableDecimalToNumber(candidate.estimated_profit_amount),
      roi: nullableDecimalToNumber(candidate.estimated_roi)
    };

    const after = {
      expectedSellPrice: estimate.expectedSellPrice,
      profit: estimate.profit,
      roi: estimate.roi,
      judgement: estimate.judgement,
      totalScore: estimate.totalScore
    };

    if (write) {
      await prisma.sourcing_candidates.update({
        where: { id: candidate.id },
        data: {
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
          updated_at: new Date()
        }
      });

      if (createScores) {
        await prisma.ai_scores.create({
          data: {
            organization_id: candidate.organization_id,
            sourcing_candidate_id: candidate.id,
            product_id: candidate.product_id,
            judgement: estimate.judgement,
            total_score: estimate.totalScore,
            profit_score: Math.min(100, Math.max(0, Math.round((estimate.profit / 3000) * 100))),
            risk_score: estimate.roi < 0.1 ? 70 : 30,
            recommended_action: estimate.recommendedMaxPurchaseQuantity > 0 ? "watch_or_buy" : "review",
            recommended_quantity: estimate.recommendedMaxPurchaseQuantity,
            reason_summary: estimate.reasonSummary,
            risk_notes: estimate.riskNotes,
            model_name: "rules-v1",
            prompt_version: "profit-recalculate-v1",
            input_snapshot: {
              source: "recalculate-sourcing-candidates",
              targetChannel
            },
            output_snapshot: estimate,
            created_by_user_id: candidate.discovered_by_user_id
          }
        });
      }
    }

    results.push({
      id: candidate.id,
      sourceTitle: candidate.source_title,
      targetChannel,
      before,
      after
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: write ? "write" : "dry-run",
        scanned: candidates.length,
        updated: write ? candidates.length : 0,
        aiScoresCreated: write && createScores ? candidates.length : 0,
        sample: results.slice(0, 5)
      },
      null,
      2
    )
  );
}

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    if (arg === "--write") {
      acc.write = "true";
      return acc;
    }

    const [key, value] = arg.replace(/^--/, "").split("=");
    acc[toCamelCase(key)] = value ?? "true";
    return acc;
  }, {});
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function normalizeTargetChannel(value) {
  if (!value || !TARGET_CHANNELS.has(value)) return null;

  return value;
}

function decimalToNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();

  return Number(value);
}

function nullableDecimalToNumber(value) {
  if (value == null) return null;

  return decimalToNumber(value);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
