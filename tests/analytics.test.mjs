import test from "node:test";
import assert from "node:assert/strict";
import { chartBuckets, shiftChartAnchor, birthdayReminders } from "../src/lib/analytics.ts";

const movements = [
  { date: "2026-10-31", kind: "income", amountCents: 1000 },
  { date: "2026-11-01", kind: "income", amountCents: 2500 },
  { date: "2026-11-01", kind: "expense", amountCents: 400 },
  { date: "2026-11-02", kind: "expense", amountCents: 900, isPaid: false },
];

test("gráfico permite dia, mês e ano sem contar despesas não pagas", () => {
  assert.deepEqual(chartBuckets(movements, "day", "2026-11-01"), [{ key: "2026-11-01", label: "01", incomeCents: 2500, expenseCents: 400 }]);
  const month = chartBuckets(movements, "month", "2026-11-01");
  assert.equal(month.length, 30);
  assert.equal(month[1].expenseCents, 0);
  const year = chartBuckets(movements, "year", "2026-11-01");
  assert.equal(year[9].incomeCents, 1000);
  assert.equal(year[10].incomeCents, 2500);
});

test("setas atravessam mês e ano sem pular fevereiro", () => {
  assert.equal(shiftChartAnchor("2026-01-31", "month", 1), "2026-02-01");
  assert.equal(shiftChartAnchor("2026-01-01", "day", -1), "2025-12-31");
  assert.equal(shiftChartAnchor("2026-11-06", "year", -1), "2025-11-01");
});

test("aniversários do mês distinguem hoje, futuros e passados", () => {
  const customers = [
    { birthDate: "1980-11-05", isActive: true },
    { birthDate: "1990-11-06", isActive: true },
    { birthDate: "2000-11-10", isActive: true },
    { birthDate: "2000-12-01", isActive: true },
    { birthDate: "2000-11-07", isActive: false },
  ];
  assert.deepEqual(birthdayReminders(customers, "2026-11-06").map((item) => item.daysAway), [0, 4, -1]);
});
