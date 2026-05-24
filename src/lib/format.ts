export function yen(amount: number) {
  return `${amount.toLocaleString("ja-JP")}円`;
}

export function pct(ratio: number, digits = 1) {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function gradeClass(grade: string) {
  switch (grade) {
    case "A":
      return "grade-a";
    case "B":
      return "grade-b";
    case "C":
      return "grade-c";
    default:
      return "grade-ng";
  }
}

export const gradeMeaning: Record<string, string> = {
  A: "仕入れ推奨",
  B: "要確認",
  C: "見送り寄り",
  NG: "仕入れ不可"
};
