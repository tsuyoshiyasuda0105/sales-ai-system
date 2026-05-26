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

/**
 * Like extractModelNumbers but returns the original (case+hyphen preserved) tokens, suitable for
 * building search queries (e.g. for Amazon JP). Hyphenated tokens preferred, same as the matcher.
 */
export function extractModelTokens(title: string): string[] {
  const tokens = stripNoise(title).split(" ").filter(Boolean);
  const hyphenated: string[] = [];
  const plain: string[] = [];

  for (const token of tokens) {
    if (!looksLikeModel(token)) continue;

    const normalized = normalizeForMatch(token);

    if (token.includes("-") && normalized.length >= 5) {
      if (!hyphenated.includes(token)) hyphenated.push(token);
    } else if (normalized.length >= 6) {
      if (!plain.includes(token)) plain.push(token);
    }
  }

  return hyphenated.length > 0 ? hyphenated : plain;
}

/**
 * Builds a concise search query suitable for Amazon's site search: prefers "<brand> <model>"
 * (e.g. "パナソニック EH-NA0K"), falling back to the first few meaningful tokens of the title
 * when no model number is present. Avoids the noisy long Rakuten SEO titles that otherwise
 * match unrelated products.
 */
export function buildAmazonSearchQuery(title: string): string {
  const cleanedTokens = stripNoise(title).split(" ").filter(Boolean);
  const modelTokens = extractModelTokens(title);

  if (modelTokens.length > 0) {
    const primaryModel = modelTokens[0];
    const modelIndex = cleanedTokens.indexOf(primaryModel);
    const brandCandidate = modelIndex > 0 ? cleanedTokens[0] : undefined;
    const parts = brandCandidate && brandCandidate !== primaryModel ? [brandCandidate, primaryModel] : [primaryModel];

    return parts.join(" ");
  }

  return cleanedTokens.slice(0, 3).join(" ");
}

export function amazonSearchUrl(title: string): string {
  const query = buildAmazonSearchQuery(title);
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}`;
}
