"use client";

import { useRef, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { editSale, voidMovement } from "@/app/actions";
import { parseMoney } from "@/lib/finance";
import { paymentStatus } from "@/lib/payment-status";

export type ManagedSale = { id: string; customer: string; description: string; soldOn: string; updatedAt: string; total: number; paid: number; parts: { id: string; number: number; dueDate: string; amount: number; paid: number }[] };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function SalesManager({ sales, onCreate, onCollect }: { sales: ManagedSale[]; onCreate: () => void; onCollect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<ManagedSale | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [limit, setLimit] = useState(50);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = sales.filter((sale) => normalize(`${sale.customer} ${sale.description}`).includes(normalize(query)) && (status === "all" || (status === "paid" ? sale.paid >= sale.total : sale.paid < sale.total)) && (!from || sale.soldOn >= from) && (!to || sale.soldOn <= to));
  async function run(data: FormData, remove = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      const result = await (remove ? voidMovement(data) : editSale(data));
      if (!result.ok) { setError(result.error); return; }
      setEditing(null); setSuccess(remove ? "Venda cancelada, incluindo parcelas e recebimentos." : "Venda atualizada.");
    } catch { setError("Não foi possível salvar. Tente novamente."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="dashboard page-view">
    <div className="page-heading"><div><p className="eyebrow">Histórico de vendas</p><h1>Vendas</h1><p>Consulte vendas pagas, fiadas e parceladas.</p></div><button className="primary-button" onClick={onCreate}><Plus size={18} />Nova venda</button></div>
    <div className="finance-filters"><label><Search size={16} />Cliente ou mercadoria<input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(50); }} placeholder="Buscar venda" /></label><label>Situação<select value={status} onChange={(event) => { setStatus(event.target.value); setLimit(50); }}><option value="all">Todas</option><option value="open">A receber</option><option value="paid">Quitadas</option></select></label><label>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
    {success && <p role="status" className="form-message success">{success}</p>}{error && !editing && <p role="alert" className="form-message error">{error}</p>}
    <p className="form-hint">{filtered.length} venda(s) · Total {money(filtered.reduce((sum, sale) => sum + sale.total, 0))}</p>
    <div className="finance-records">{filtered.slice(0, limit).map((sale) => { const state = paymentStatus(sale.paid >= sale.total, sale.parts.filter((part) => part.paid < part.amount).toSorted((a,b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate, "sale"); return <article className={`finance-record state-${state.tone}`} key={sale.id}><div><h2>{sale.customer}</h2><p>{sale.description}</p><small>{new Date(`${sale.soldOn}T12:00:00`).toLocaleDateString("pt-BR")} · {sale.parts.length} parcela(s)</small></div><div><strong>{money(sale.total)}</strong><span className={`payment-status state-${state.tone}`}>{state.label}</span><p>Recebido: {money(sale.paid)} · Falta: {money(Math.max(0, sale.total - sale.paid))}</p></div><div className="finance-record-actions"><button className="secondary-button" disabled={busy} onClick={() => { setEditing(sale); setError(""); }}><Pencil size={16} />Editar</button>{sale.paid < sale.total && <button className="compact-button" onClick={() => onCollect(sale.parts.find((part) => part.paid < part.amount)!.id)}>Receber</button>}<button className="secondary-button danger-action" disabled={busy} onClick={() => { if (!window.confirm(`Cancelar a venda de ${sale.customer}? Todas as parcelas e recebimentos desta venda serão retirados do financeiro.`)) return; const data = new FormData(); data.set("id", sale.id); data.set("source", "sale"); void run(data, true); }}><Trash2 size={16} />Cancelar venda</button></div></article>; })}</div>
    {!filtered.length && <p className="attention-card">Nenhuma venda encontrada.</p>}{filtered.length > limit && <button className="secondary-button" onClick={() => setLimit(limit + 50)}>Carregar mais</button>}
    {editing && <div className="modal-backdrop"><section className="register-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-sale-title"><div className="sheet-heading"><h2 id="edit-sale-title">Editar venda · {editing.customer}</h2><button className="secondary-button" disabled={busy} onClick={() => setEditing(null)}>Fechar</button></div><form className="entry-form" action={async (data) => { const parts = editing.parts.map((part) => ({ id: part.id, amount_cents: parseMoney(data.get(`amount_${part.id}`)), due_date: data.get(`date_${part.id}`) })); data.set("parts", JSON.stringify(parts)); await run(data); }}>
      <input type="hidden" name="id" value={editing.id} /><input type="hidden" name="version" value={editing.updatedAt} /><label>Descrição<input name="description" required defaultValue={editing.description} /></label><label>Data da venda<input type="date" name="sold_on" required defaultValue={editing.soldOn} /></label>
      <p className="form-hint">O total será a soma das parcelas. Valores já recebidos são preservados.</p>
      {editing.parts.map((part) => <fieldset className="sale-installment" key={part.id}><legend>Parcela {part.number} · recebido {money(part.paid)}</legend><label>Valor<input required inputMode="decimal" name={`amount_${part.id}`} defaultValue={(part.amount / 100).toFixed(2).replace(".", ",")} /></label><label>Vencimento<input required type="date" name={`date_${part.id}`} defaultValue={part.dueDate} /></label></fieldset>)}
      {error && <p role="alert" className="form-message error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</button>
    </form></section></div>}
  </section>;
}
