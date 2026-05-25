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
