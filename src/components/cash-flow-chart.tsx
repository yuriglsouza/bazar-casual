"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CircleDollarSign } from "lucide-react";
import { chartBuckets, shiftChartAnchor, type ChartMode, type ChartMovement } from "@/lib/analytics";
import { localDate } from "@/lib/finance";

type Detail = ChartMovement & { id: string; label: string; detail: string };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

export function CashFlowChart({ movements }: { movements: Detail[] }) {
  const [mode, setMode] = useState<ChartMode>("month");
  const [anchor, setAnchor] = useState(localDate);
  const buckets = chartBuckets(movements, mode, anchor);
  const totalIncome = buckets.reduce((sum, bucket) => sum + bucket.incomeCents, 0);
  const totalExpense = buckets.reduce((sum, bucket) => sum + bucket.expenseCents, 0);
  const largest = Math.max(1, ...buckets.flatMap((bucket) => [bucket.incomeCents, bucket.expenseCents]));
  const hasData = totalIncome > 0 || totalExpense > 0;
  const trendPoints = buckets.map((_, index) => {
    const recent = buckets.slice(Math.max(0, index - 2), index + 1);
    const average = recent.reduce((sum, bucket) => sum + bucket.incomeCents, 0) / recent.length;
    return `${50 + index * 100},${Math.max(4, 100 - average / largest * 96)}`;
  }).join(" ");
  const chartWidth = mode === "day" ? 180 : Math.max(620, buckets.length * (mode === "year" ? 58 : 42));
  const year = Number(anchor.slice(0, 4));
  const firstYear = Math.min(year, ...movements.map((movement) => Number(movement.date.slice(0, 4))));
  const lastYear = Math.max(new Date().getFullYear() + 1, year);
  const years = Array.from({ length: Math.min(100, lastYear - firstYear + 1) }, (_, index) => lastYear - index);
  const periodLabel = mode === "year" ? String(year) : mode === "month"
    ? new Date(`${anchor.slice(0, 7)}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : dateLabel(anchor);
  const dayMovements = mode === "day" ? movements.filter((movement) => movement.isPaid !== false && movement.date === anchor) : [];

  const changeMode = (next: ChartMode) => setMode(next);
  const openBucket = (key: string) => {
    if (mode === "year") { setAnchor(`${key}-01`); setMode("month"); }
    else if (mode === "month") { setAnchor(key); setMode("day"); }
  };

  return <section className="chart-card" aria-labelledby="cash-flow-title">
    <div className="chart-heading"><div><p className="eyebrow">Histórico do caixa</p><h2 id="cash-flow-title">Movimento financeiro</h2></div>
      <div className="chart-legend" aria-label="Legenda"><span><i className="income" />Entradas</span><span><i className="expense" />Despesas</span>{mode !== "day" && <span><i className="trend" />Média de 3 períodos</span>}</div>
    </div>
    <div className="chart-toolbar">
      <div className="chart-modes" role="group" aria-label="Escala do gráfico">{(["day", "month", "year"] as const).map((option) => <button type="button" key={option} className={mode === option ? "active" : ""} aria-pressed={mode === option} onClick={() => changeMode(option)}>{option === "day" ? "Dia" : option === "month" ? "Mês" : "Ano"}</button>)}</div>
      <div className="chart-period"><button type="button" aria-label="Período anterior" onClick={() => setAnchor(shiftChartAnchor(anchor, mode, -1))}><ChevronLeft size={18} /></button><strong>{periodLabel}</strong><button type="button" aria-label="Próximo período" onClick={() => setAnchor(shiftChartAnchor(anchor, mode, 1))}><ChevronRight size={18} /></button></div>
      <label className="chart-date-picker"><span className="sr-only">Selecionar {mode === "day" ? "dia" : mode === "month" ? "mês" : "ano"}</span>{mode === "year" ? <select value={year} onChange={(event) => setAnchor(`${event.target.value}-01-01`)}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select> : <input type={mode === "day" ? "date" : "month"} value={mode === "day" ? anchor : anchor.slice(0, 7)} onChange={(event) => { if (event.target.value) setAnchor(mode === "day" ? event.target.value : `${event.target.value}-01`); }} />}</label>
    </div>
    <p className="chart-period-summary" role="status">{mode === "day" ? "Neste dia" : mode === "month" ? "Neste mês" : "Neste ano"}: entraram <strong>{money(totalIncome)}</strong> · saíram <strong>{money(totalExpense)}</strong></p>
    {hasData ? <div className="chart-scroll"><div className="bar-chart" style={{ width: chartWidth, gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }} aria-label={`Movimentação de ${periodLabel}`}>
      {mode !== "day" && <svg className="trend-line" viewBox={`0 0 ${buckets.length * 100} 100`} preserveAspectRatio="none" aria-hidden="true"><polyline points={trendPoints} /></svg>}
      {buckets.map((bucket) => <button type="button" className="chart-month" key={bucket.key} onClick={() => openBucket(bucket.key)} aria-label={`${mode === "year" ? "Mês" : "Dia"} ${bucket.label}: entradas ${money(bucket.incomeCents)}, despesas ${money(bucket.expenseCents)}${mode === "day" ? "" : "; abrir detalhes"}`}>
        <span className="bar-pair"><span className="chart-bar income" style={{ height: `${bucket.incomeCents / largest * 100}%`, minHeight: bucket.incomeCents ? 3 : 0 }} /><span className="chart-bar expense" style={{ height: `${bucket.expenseCents / largest * 100}%`, minHeight: bucket.expenseCents ? 3 : 0 }} /></span><strong>{bucket.label}</strong>
      </button>)}
    </div></div> : <div className="chart-empty"><CircleDollarSign size={22} /><span>Nenhuma entrada ou despesa paga neste período.</span></div>}
    {mode === "day" && <div className="chart-day-details"><h3>Lançamentos de {dateLabel(anchor)}</h3>{dayMovements.length ? dayMovements.map((movement) => <div key={movement.id}><span>{movement.label}<small>{movement.detail}</small></span><strong className={movement.kind}>{movement.kind === "income" ? "+" : "−"}{money(movement.amountCents)}</strong></div>) : <p>Não houve lançamentos pagos neste dia.</p>}</div>}
    {mode !== "day" && <p className="chart-tip">Toque em uma barra para ver {mode === "year" ? "os dias do mês" : "os lançamentos do dia"}.</p>}
  </section>;
}
