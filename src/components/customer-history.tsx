"use client";

import { ShoppingBag } from "lucide-react";
import type { ManagedSale } from "@/components/sales-manager";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function CustomerHistory({ name, sales, onNewSale }: { name: string; sales: ManagedSale[]; onNewSale: () => void }) {
  const total = sales.reduce((sum, sale) => sum + sale.total, 0);
  const received = sales.reduce((sum, sale) => sum + sale.paid, 0);
  return <div className="customer-history">
    <p className="form-hint">Histórico de compras de {name}. Vendas canceladas não entram nestes totais.</p>
    <div className="history-summary"><div><span>Compras</span><strong>{sales.length}</strong></div><div><span>Total comprado</span><strong>{money(total)}</strong></div><div><span>Recebido</span><strong>{money(received)}</strong></div><div><span>Em aberto</span><strong>{money(Math.max(0, total - received))}</strong></div></div>
    <button type="button" className="primary-button history-new-sale" onClick={onNewSale}><ShoppingBag size={17} />Nova venda para esta cliente</button>
    <h3>O que ela comprou</h3>
    {sales.length ? <div className="history-sales">{sales.map((sale) => <article key={sale.id}><div><strong>{sale.description}</strong><small>{new Date(`${sale.soldOn}T12:00:00`).toLocaleDateString("pt-BR")} · {sale.parts.length} parcela(s)</small></div><div><strong>{money(sale.total)}</strong><small>Recebido {money(sale.paid)} · falta {money(Math.max(0, sale.total - sale.paid))}</small></div></article>)}</div> : <p className="history-empty">Ainda não há vendas registradas para esta cliente.</p>}
  </div>;
}
