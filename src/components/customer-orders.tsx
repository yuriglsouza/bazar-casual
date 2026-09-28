"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Save, Search } from "lucide-react";
import { saveCustomerOrders } from "@/app/actions";

type Customer = { id: string; name: string; phone: string | null; orderNotes: string };
type Draft = { text: string; saved: string };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function CustomerOrders({ customers, visible }: { customers: Customer[]; visible: boolean }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selected = customers.find((customer) => customer.id === selectedId);
  const current = selected ? drafts[selected.id] ?? { text: selected.orderNotes, saved: selected.orderNotes } : null;
  const dirty = Object.values(drafts).some((draft) => draft.text !== draft.saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    if (!selected || !current || savingRef.current) return;
    const id = selected.id;
    const text = current.text;
    savingRef.current = true;
    setSaving(true); setMessage(""); setError("");
    const data = new FormData();
    data.set("id", id); data.set("text", text); data.set("previous", current.saved);
    try {
      const result = await saveCustomerOrders(data);
      if (!result.ok) { setError(result.error); return; }
      setDrafts((previous) => ({ ...previous, [id]: { text: previous[id]?.text ?? text, saved: text } }));
      setMessage("Anotações salvas.");
    } catch { setError("Não foi possível salvar. Seu texto continua aqui; tente novamente."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <section hidden={!visible} className="dashboard page-view orders-page">
    <div className="page-heading"><div><p className="eyebrow">Bloco de notas</p><h1>Pedidos de Clientes</h1><p>Guarde os pedidos, tamanhos e preferências de cada cliente.</p></div></div>
    <div className="orders-layout">
      <aside className="orders-customers" aria-label="Escolher cliente">
        <label className="orders-search"><Search size={18} /><span className="sr-only">Pesquisar cliente</span><input placeholder="Buscar pelo nome…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="orders-results">
          {customers.filter((customer) => normalize(customer.name).includes(normalize(query.trim()))).map((customer) => <button type="button" key={customer.id} aria-pressed={selectedId === customer.id} disabled={saving} onClick={() => { setSelectedId(customer.id); setMessage(""); setError(""); }}>
            <strong>{customer.name}</strong><small>{drafts[customer.id] && drafts[customer.id].text !== drafts[customer.id].saved ? "Alterações por salvar" : (drafts[customer.id]?.text ?? customer.orderNotes) ? "Tem anotações" : customer.phone || "Abrir bloco de notas"}</small>
          </button>)}
          {!customers.length ? <p>Cadastre uma cliente na aba Clientes para começar.</p> : !customers.some((customer) => normalize(customer.name).includes(normalize(query.trim()))) ? <p>Nenhuma cliente encontrada.</p> : null}
        </div>
      </aside>
      <article className="orders-notebook">
        {selected && current ? <>
          <div className="orders-notebook-heading"><span className="icon-badge pink"><NotebookPen size={21} /></span><div><h2>{selected.name}</h2><p>Um espaço para lembrar do que ela procura.</p></div></div>
          <label htmlFor="order-notes" className="sr-only">Anotações de pedidos de {selected.name}</label>
          <textarea id="order-notes" maxLength={20000} value={current.text} placeholder={"Ex.: Procura uma calça jeans tamanho 42.\nPrefere vestidos florais e blusas em tons claros."} onChange={(event) => { const text = event.target.value; setDrafts((previous) => ({ ...previous, [selected.id]: { text, saved: previous[selected.id]?.saved ?? selected.orderNotes } })); setMessage(""); setError(""); }} />
          <div className="orders-save"><span role="status">{message || (current.text !== current.saved ? "Alterações por salvar" : "Tudo salvo")}</span><button type="button" className="primary-button" disabled={saving || current.text === current.saved} onClick={save}><Save size={18} />{saving ? "Salvando…" : "Salvar anotações"}</button></div>
          {error && <p role="alert" className="form-message">{error}</p>}
          <p className="orders-hint">Para remover um pedido, apague o trecho e salve. Estas anotações são apenas para seu controle interno.</p>
        </> : <div className="empty-attention"><NotebookPen size={32} /><strong>O que sua cliente está procurando?</strong><p>Busque pelo nome e toque na cliente para abrir as anotações dela.</p></div>}
      </article>
    </div>
  </section>;
}
