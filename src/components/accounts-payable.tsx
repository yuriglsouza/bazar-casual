"use client";

import { useState } from "react";
import { localDate, scheduledDate } from "@/lib/finance";
import { paymentStatus } from "@/lib/payment-status";

export type Payable = { id: string; label: string; detail: string; date: string; dueDate?: string | null; amountCents: number; isPaid?: boolean };
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
export function AccountsPayable({ entries, onPay, onEdit, onRemove, onCreate, error, busy }: { entries: Payable[]; onPay: (id: string) => void; onEdit: (id: string) => void; onRemove: (id: string) => void; onCreate: () => void; error: string; busy: boolean }) {
  const [filter, setFilter] = useState("open");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(50);
  const today = localDate();
  const soon = scheduledDate(today, 1, "weekly");
  const open = entries.filter((entry) => !entry.isPaid);
  const overdue = open.filter((entry) => entry.dueDate && entry.dueDate < today);
  const upcoming = open.filter((entry) => entry.dueDate && entry.dueDate >= today && entry.dueDate <= soon);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const selected = (filter === "overdue" ? overdue : filter === "soon" ? upcoming : filter === "paid" ? entries.filter((entry) => entry.isPaid) : open).filter((entry) => normalize(`${entry.label} ${entry.detail}`).includes(normalize(query))).toSorted((a, b) => (a.dueDate ?? a.date).localeCompare(b.dueDate ?? b.date));
  return <section className="dashboard page-view"><div className="page-heading"><div><p className="eyebrow">Compromissos da loja</p><h1>Contas a pagar</h1><p>Despesas e boletos organizados por vencimento.</p></div><button className="primary-button" onClick={onCreate}>Nova despesa</button></div>
    <div className="payable-summary">{[["Em aberto", open], ["Vencidas", overdue], ["Próximos 7 dias", upcoming]].map(([label, items]) => <article key={String(label)}><span>{String(label)}</span><strong>{money((items as Payable[]).reduce((total, entry) => total + entry.amountCents, 0))}</strong></article>)}</div>
    <div className="finance-filters"><label>Buscar despesa<input placeholder="Fornecedor, mercadoria ou categoria" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(50); }} /></label><label>Situação<select value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(50); }}><option value="open">Em aberto</option><option value="overdue">Vencidas</option><option value="soon">Próximos 7 dias</option><option value="paid">Quitadas</option></select></label></div>
    {error && <p role="alert" className="form-message error">{error}</p>}
    <div className="finance-records">{selected.slice(0, limit).map((entry) => { const state = paymentStatus(Boolean(entry.isPaid), entry.dueDate, "expense", today); return <article className={`finance-record state-${state.tone}`} key={entry.id}><div><h2>{entry.label}</h2><p>{entry.detail}</p><small>{entry.dueDate ? `Vence em ${new Date(`${entry.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}` : "Sem vencimento informado"}</small></div><div><strong>{money(entry.amountCents)}</strong><span className={`payment-status state-${state.tone}`}>{state.label}</span></div><div className="finance-record-actions">{!entry.isPaid && <button className="compact-button" disabled={busy} onClick={() => onPay(entry.id)}>Marcar paga</button>}<button className="secondary-button" disabled={busy} onClick={() => onEdit(entry.id)}>Editar</button><button className="secondary-button danger-action" disabled={busy} onClick={() => onRemove(entry.id)}>Excluir</button></div></article>; })}</div>
    {!selected.length && <p className="attention-card">Nenhuma conta nesta situação.</p>}{selected.length > limit && <button className="secondary-button" onClick={() => setLimit(limit + 50)}>Carregar mais</button>}
  </section>;
}
