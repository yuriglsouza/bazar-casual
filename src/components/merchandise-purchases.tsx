"use client";

import { useRef, useState } from "react";
import { Pencil, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { createCashEntry, markCashEntryPaid, updateCashEntry, voidMovement, type ActionResult } from "@/app/actions";
import { paymentStatus } from "@/lib/payment-status";

export type MerchandisePurchase = { id: string; description: string; amount_cents: number; occurred_on: string; due_date: string | null; is_paid: boolean; payment_method: string | null };
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const methods = [["pix", "Pix"], ["cash", "Dinheiro"], ["credit_card", "Cartão de crédito"], ["debit_card", "Cartão de débito"], ["transfer", "Transferência"], ["other", "Boleto / outra"]];

export function MerchandisePurchases({ purchases, loadError }: { purchases: MerchandisePurchase[]; loadError: boolean }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MerchandisePurchase | "new" | null>(null);
  const [paying, setPaying] = useState<MerchandisePurchase | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const current = editing && editing !== "new" ? editing : null;
  const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const items = purchases.filter((item) => normalized(item.description).includes(normalized(query.trim())));
  async function submit(action: (data: FormData) => Promise<ActionResult>, data: FormData, message: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      const result = await action(data);
      if (!result.ok) { setError(result.error); return; }
      setEditing(null); setPaying(null); setSuccess(message);
    } catch { setError("Não foi possível salvar. Confira a conexão e tente novamente."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="dashboard page-view">
    <div className="page-heading"><div><p className="eyebrow">Despesas da loja</p><h1>Compras de Mercadorias</h1><p>Registre o que comprou e o valor total da compra.</p></div><button className="primary-button" onClick={() => { setEditing("new"); setPaid(false); setError(""); }}><Plus size={18} />Nova compra</button></div>
    <p className="form-hint">Cada compra aparece também em Movimentações. Compras pendentes entram no caixa quando você marcar como pagas.</p>
    {loadError && <p role="alert" className="form-message error">Não foi possível carregar as compras. Atualize a página para tentar novamente.</p>}
    {success && <p role="status" className="form-message success">{success}</p>}
    {error && !editing && !paying && <p role="alert" className="form-message error">{error}</p>}
    <label className="orders-search merchandise-search"><Search size={18} /><span className="sr-only">Buscar mercadoria ou fornecedor</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar mercadoria ou fornecedor" /></label>
    {items.length ? <div className="movement-list">{items.map((item) => { const state = paymentStatus(item.is_paid, item.due_date); return <article className={`movement-row state-${state.tone}`} key={item.id}>
      <span className="movement-icon expense"><ShoppingBag size={18} /></span><div><strong>{item.description}</strong><span>Compra em {date(item.occurred_on)}</span>{item.due_date && !item.is_paid && <span>Vence em {date(item.due_date)}</span>}<span className={`payment-status state-${state.tone}`}>{state.label}</span></div>
      <div className="movement-actions"><b className="expense">{money(item.amount_cents)}</b><span>
        <button className="mini-action" disabled={busy} aria-label={`Editar compra ${item.description}`} onClick={() => { setEditing(item); setPaid(item.is_paid); setError(""); }}><Pencil size={15} />Editar</button>
        {!item.is_paid && <button className="mini-action pay" disabled={busy} onClick={() => { setPaying(item); setError(""); }}>Marcar paga</button>}
        <button className="mini-action delete" disabled={busy} aria-label={`Excluir compra ${item.description}`} onClick={() => { if (!window.confirm("Excluir esta compra e a despesa correspondente? Se houver parcelas deste lançamento, elas também serão excluídas.")) return; const data = new FormData(); data.set("id", item.id); data.set("source", "cash"); void submit(voidMovement, data, "Compra e despesa excluídas."); }}><Trash2 size={15} /></button>
      </span></div>
    </article>; })}</div> : !loadError && <div className="attention-card empty-attention"><ShoppingBag size={28} /><strong>{query ? "Nenhuma compra encontrada" : "Suas compras ficam aqui"}</strong><p>Ex.: Natura · total de R$ 2.034,10.</p></div>}
    {purchases.length === 1000 && <p className="form-hint">Exibindo as mil compras mais recentes.</p>}
    {(editing || paying) && <div className="modal-backdrop"><section className="register-sheet" role="dialog" aria-modal="true" aria-labelledby="purchase-title"><div className="sheet-heading"><h2 id="purchase-title">{paying ? "Pagar compra" : current ? "Editar compra" : "Nova compra"}</h2><button type="button" className="secondary-button" disabled={busy} onClick={() => { setEditing(null); setPaying(null); setError(""); }}>Fechar</button></div>
      {error && <p role="alert" className="form-message error">{error}</p>}
      {paying ? <form className="entry-form" action={(data) => submit(markCashEntryPaid, data, "Compra marcada como paga.")}><input type="hidden" name="id" value={paying.id} /><p>{paying.description} · {money(paying.amount_cents)}</p><label>Forma de pagamento<select name="payment_method" defaultValue="other">{methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="primary-button" disabled={busy}>{busy ? "Salvando…" : "Confirmar pagamento total"}</button></form> : <form className="entry-form" action={(data) => submit(current ? updateCashEntry : createCashEntry, data, current ? "Compra atualizada." : "Compra registrada como despesa.")}>
        {current && <input type="hidden" name="id" value={current.id} />}<input type="hidden" name="direction" value="expense" /><input type="hidden" name="category" value="Mercadorias" />
        <label>Mercadoria ou fornecedor<input name="description" required autoFocus placeholder="Ex.: Natura, roupas, perfumes…" defaultValue={current?.description ?? ""} /></label>
        <label>Valor total da compra<input name="amount" required inputMode="decimal" placeholder="Ex.: 2.034,10" defaultValue={current ? (current.amount_cents / 100).toFixed(2).replace(".", ",") : ""} /></label>
        <label>Data da compra<input type="date" name="occurred_on" required defaultValue={current?.occurred_on ?? today()} /></label>
        {!current && <label>Situação<select name="payment_state" value={paid ? "paid_now" : "unpaid"} onChange={(event) => setPaid(event.target.value === "paid_now")}><option value="unpaid">Ainda tenho que pagar</option><option value="paid_now">Já paguei o total</option></select></label>}
        {!paid && <label>Vencimento<input type="date" name="due_date" required defaultValue={current?.due_date ?? today()} /></label>}
        {paid && <label>Forma de pagamento<select name="payment_method" defaultValue={current?.payment_method ?? "other"}>{methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <button className="primary-button" disabled={busy}>{busy ? "Salvando…" : "Salvar compra"}</button>
      </form>}
    </section></div>}
  </section>;
}
