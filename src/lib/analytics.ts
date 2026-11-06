export type ChartMode = "day" | "month" | "year";
export type ChartMovement = { date: string; kind: "income" | "expense"; amountCents: number; isPaid?: boolean };
export type ChartBucket = { key: string; label: string; incomeCents: number; expenseCents: number };

const pad = (value: number) => String(value).padStart(2, "0");
const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function chartBuckets(movements: ChartMovement[], mode: ChartMode, anchor: string): ChartBucket[] {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const count = mode === "year" ? 12 : mode === "month" ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 1;
  const buckets = Array.from({ length: count }, (_, index) => {
    const key = mode === "year" ? `${year}-${pad(index + 1)}` : mode === "month" ? `${year}-${pad(month)}-${pad(index + 1)}` : anchor;
    return { key, label: mode === "year" ? monthNames[index] : mode === "day" ? anchor.slice(8, 10) : pad(index + 1), incomeCents: 0, expenseCents: 0 };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const movement of movements) {
    if (movement.isPaid === false) continue;
    const key = mode === "year" ? movement.date.slice(0, 7) : movement.date;
    const bucket = byKey.get(key);
    if (!bucket) continue;
    if (movement.kind === "income") bucket.incomeCents += movement.amountCents;
    else bucket.expenseCents += movement.amountCents;
  }
  return buckets;
}

export function shiftChartAnchor(anchor: string, mode: ChartMode, direction: -1 | 1): string {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)) - 1;
  const day = Number(anchor.slice(8, 10));
  const date = mode === "year" ? new Date(Date.UTC(year + direction, month, 1))
    : mode === "month" ? new Date(Date.UTC(year, month + direction, 1))
      : new Date(Date.UTC(year, month, day + direction));
  return date.toISOString().slice(0, 10);
}

export function birthdayReminders<T extends { birthDate: string | null; isActive: boolean }>(customers: T[], today: string): (T & { daysAway: number })[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const todayDay = Number(today.slice(8, 10));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return customers.flatMap((customer) => {
    if (!customer.isActive || !customer.birthDate || Number(customer.birthDate.slice(5, 7)) !== month) return [];
    const birthdayDay = Math.min(Number(customer.birthDate.slice(8, 10)), lastDay);
    return [{ ...customer, daysAway: birthdayDay - todayDay }];
  }).sort((a, b) => (a.daysAway < 0 ? 1 : 0) - (b.daysAway < 0 ? 1 : 0) || a.daysAway - b.daysAway);
}
