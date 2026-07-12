/** Convert a non-negative amount to English words (for invoice “In words”). */
const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function under1000(n: number): string {
  if (n < 20) return ones[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o ? `${tens[t]} ${ones[o]}` : tens[t];
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${ones[h]} Hundred`;
  return rest ? `${head} ${under1000(rest)}` : head;
}

export function amountToWordsTaka(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "Zero Taka Only";
  const rounded = Math.round(amount * 100) / 100;
  const whole = Math.floor(rounded);
  const paise = Math.round((rounded - whole) * 100);

  const parts: string[] = [];
  let n = whole;
  if (n >= 10000000) {
    const c = Math.floor(n / 10000000);
    parts.push(`${under1000(c)} Crore`);
    n %= 10000000;
  }
  if (n >= 100000) {
    const l = Math.floor(n / 100000);
    parts.push(`${under1000(l)} Lakh`);
    n %= 100000;
  }
  if (n >= 1000) {
    const t = Math.floor(n / 1000);
    parts.push(`${under1000(t)} Thousand`);
    n %= 1000;
  }
  if (n > 0) parts.push(under1000(n));

  let s = parts.join(" ").trim() || "Zero";
  if (paise > 0) {
    s += ` and ${under1000(paise)} Paise`;
  }
  return `${s} Taka Only`;
}
