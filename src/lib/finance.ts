export function parseMoney(value: unknown): number {
  const text = String(value ?? "").trim().replace(/^R\$\s*/, "");
  let normalized: string;
  if (/^\d+(?:[.,]\d{1,2})?$/.test(text)) normalized = text.replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) normalized = text.replaceAll(".", "").replace(",", ".");
  else return NaN;
  const [whole, fraction = ""] = normalized.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : NaN;
}

export function localDate(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function scheduledDate(first: string, index: number, frequency: "monthly" | "biweekly" | "weekly"): string {
  const date = new Date(`${first}T12:00:00Z`);
  if (frequency === "monthly") {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + index);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  } else date.setUTCDate(date.getUTCDate() + index * (frequency === "weekly" ? 7 : 15));
  return date.toISOString().slice(0, 10);
}

export function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 || digits.length === 11 ? `55${digits}` : digits}`;
}
