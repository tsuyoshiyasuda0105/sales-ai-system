/** Extracts a JAN-13 code from a product title when present (Japanese JAN prefixes 45/49 preferred). */
export function extractJanFromTitle(title: string): string | null {
  const normalized = title.normalize("NFKC");
  const matches = normalized.match(/(?<!\d)\d{13}(?!\d)/g);

  if (!matches) return null;

  return matches.find((value) => value.startsWith("45") || value.startsWith("49")) ?? matches[0];
}

/** ふるさと納税 (hometown-tax return gifts) are not resale inventory and must be excluded from sourcing. */
export function isFurusatoNozei(title: string): boolean {
  return title.normalize("NFKC").includes("ふるさと納税");
}

const NOISE_WORDS =
  /ふるさと納税|送料無料|送料込み?|新品|未使用品?|中古|限定|クーポン|ポイント|還元|レビュー|あす楽|正規品|日本語|国内専用|国内版|専用|公式|まとめ買い|お買い得|期間限定|割引|セール|高評価|人気|ランキング|おすすめ|新生活/g;

/**
 * Extracts model-number-like tokens (e.g. "EW-M873T", "BEE-S-KB6CA") from a title, normalized for
 * matching. Hyphenated vendor codes are preferred; plain alphanumeric tokens are only used as a
 * fallback and need to be longer to avoid grouping unrelated products by generic specs (e.g. "USB3").
 */
export function extractModelNumbers(title: string): string[] {
  const tokens = stripNoise(title).split(" ").filter(Boolean);
  const hyphenated = new Set<string>();
  const plain = new Set<string>();

  for (const token of tokens) {
    if (!looksLikeModel(token)) continue;

    const normalized = normalizeForMatch(token);

    if (token.includes("-") && normalized.length >= 5) {
      hyphenated.add(normalized);
    } else if (normalized.length >= 6) {
      plain.add(normalized);
    }
  }

  return hyphenated.size > 0 ? Array.from(hyphenated) : Array.from(plain);
}

export function stripNoise(title: string): string {
  return title
    .replace(/【[^】]*】/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[（(][^)）]*[)）]/g, " ")
    .replace(NOISE_WORDS, " ")
    .replace(/[!！?？|｜/／·・,，、。.　]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeModel(token: string): boolean {
  return /[A-Za-z]/.test(token) && /[0-9]/.test(token) && token.replace(/[^A-Za-z0-9]/g, "").length >= 4;
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().normalize("NFKC").replace(/[^a-z0-9]/g, "");
}
