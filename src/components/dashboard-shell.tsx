"use client";

import Image from "next/image";
import { useState } from "react";
import { localDate, whatsappLink } from "@/lib/finance";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays, CheckCircle2, CircleDollarSign,
  HandCoins, Home, LogOut, Menu, Pencil, Phone, Plus, ReceiptText, Search, Settings,
  ShoppingBag, SlidersHorizontal, Trash2, RotateCcw, Users, WalletCards, X, NotebookPen,
} from "lucide-react";
import {
  createCashEntry, createCustomer, createSale, markCashEntryPaid, recordPayment,
  updateCashEntry, updateCustomer, updatePayment, updateProfile, voidMovement, voidPayment,
  type ActionResult,
} from "@/app/actions";
import { logout } from "@/app/login/actions";
import { WhatsAppSettings, type WhatsAppSettingsData } from "@/components/whatsapp-settings";
import { CustomerOrders } from "@/components/customer-orders";
import { MerchandisePurchases, type MerchandisePurchase } from "@/components/merchandise-purchases";

import { SalesManager, type ManagedSale } from "@/components/sales-manager";
import { AccountsPayable } from "@/components/accounts-payable";
import { paymentStatus } from "@/lib/payment-status";

type View = "sales" | "payables" | "home" | "customers" | "orders" | "purchases" | "collections" | "movements" | "settings";
type Modal = "menu" | "customer" | "editCustomer" | "sale" | "cash" | "editCash" | "editPayment" | "payExpense" | "payment" | "more" | null;
type Customer = {
  orderNotes: string;
  id: string; name: string; phone: string | null; birthDate: string | null; notes: string | null; isActive: boolean; createdAt: string;
  whatsappEnabled: boolean; overdueMessagesEnabled: boolean; birthdayMessagesEnabled: boolean; purchaseMessagesEnabled: boolean;
};
type Collection = {
  id: string; customer: string; description: string; installmentNumber: number;
  dueDate: string; amountCents: number; paidCents: number; outstandingCents: number;
  status: string; overdue: boolean;
};
type Movement = {
  id: string; kind: "income" | "expense"; date: string; label: string; detail: string; amountCents: number;
  source?: "cash" | "sale"; sourceId?: string; paymentId?: string;
  entryId?: string; editable?: boolean; occurredOn?: string; dueDate?: string | null; category?: string;
  description?: string; isPaid?: boolean; paymentMethod?: string | null;
};
type ChartMonth = { key: string; label: string; incomeCents: number; expenseCents: number };
type Props = {
  sales: ManagedSale[];
  purchases: MerchandisePurchase[];
  purchasesLoadError: boolean;
  profile: { displayName: string; dueAlertDays: number };
  customers: Customer[];
  collections: Collection[];
  movements: Movement[];
  chart: ChartMonth[];
  whatsapp: WhatsAppSettingsData;
  summary: { incomeCents: number; expenseCents: number; receivableCents: number; overdueCents: number; soonCents: number };
};

const navItems: { view: View; label: string; icon: typeof Home; desktopOnly?: boolean }[] = [
  { view: "home", label: "Início", icon: Home },
  { view: "customers", label: "Clientes", icon: Users },
  { view: "orders", label: "Pedidos de Clientes", icon: NotebookPen, desktopOnly: true },
  { view: "sales", label: "Vendas", icon: ShoppingBag },
  { view: "payables", label: "Contas a pagar", icon: HandCoins, desktopOnly: true },
  { view: "purchases", label: "Compras de Mercadorias", icon: ShoppingBag, desktopOnly: true },
  { view: "collections", label: "Cobranças", icon: WalletCards },
  { view: "movements", label: "Movimentações", icon: ReceiptText, desktopOnly: true },
  { view: "settings", label: "Configurações", icon: Settings, desktopOnly: true },
];
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const today = () => localDate();
const dateLabel = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const birthdayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const paymentOptions = [
  ["pix", "Pix"], ["credit_card", "Cartão de crédito"], ["debit_card", "Cartão de débito"],
  ["cash", "Dinheiro"], ["transfer", "Transferência"], ["other", "Outra"],
] as const;

function EmptyState({ icon: Icon, title, copy }: { icon: typeof Bell; title: string; copy: string }) {
  return <div className="empty-attention"><span className="empty-icon"><Icon size={24} /></span><strong>{title}</strong><p>{copy}</p></div>;
}

function MoneyCard({ label, value, icon: Icon, tone, onClick }: {
  label: string; value: string; icon: typeof WalletCards; tone: "pink" | "green" | "amber" | "red"; onClick: () => void;
}) {
  return <button className="money-card" onClick={onClick}><span className={`icon-badge ${tone}`}><Icon size={18} /></span><div><p>{label}</p><strong>{value}</strong></div><ArrowRight className="card-arrow" size={16} /></button>;
}

function CashFlowChart({ months }: { months: ChartMonth[] }) {
  const [selectedDay, setSelectedDay] = useState<ChartMonth | null>(null);
  const largest = Math.max(1, ...months.flatMap((month) => [month.incomeCents, month.expenseCents]));
  const hasData = months.some((month) => month.incomeCents || month.expenseCents);
  const trendPoints = months.map((_, index) => {
    const recent = months.slice(Math.max(0, index - 2), index + 1);
    const average = recent.reduce((sum, day) => sum + day.incomeCents, 0) / recent.length;
    return `${50 + index * 100},${Math.max(4, 100 - average / largest * 96)}`;
  }).join(" ");
  const chartWidth = Math.max(620, months.length * 42);

  return <section className="chart-card" aria-labelledby="cash-flow-title">
    <div className="chart-heading">
      <div><p className="eyebrow">Este mês · por dia</p><h2 id="cash-flow-title">Movimento diário</h2></div>
      <div className="chart-legend" aria-label="Legenda"><span><i className="income" />Entradas</span><span><i className="expense" />Despesas</span><span><i className="trend" />Média de 3 dias</span></div>
    </div>
    {hasData ? <div className="chart-scroll">
      <div className="bar-chart" style={{ width: chartWidth, gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }} aria-label="Movimentação financeira diária do mês atual">
        <svg className="trend-line" viewBox={`0 0 ${months.length * 100} 100`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={trendPoints} />
        </svg>
        <span className="sr-only">A linha mostra a média das entradas dos últimos três dias.</span>
        {months.map((month) => <button type="button" className="chart-month" key={month.key} onClick={() => setSelectedDay(month)} aria-label={`Dia ${month.label}: entradas ${money(month.incomeCents)}, despesas ${money(month.expenseCents)}`}>
          <div className="bar-pair">
            <span className="chart-bar income" style={{ height: `${month.incomeCents / largest * 100}%`, minHeight: month.incomeCents ? 3 : 0 }} />
            <span className="chart-bar expense" style={{ height: `${month.expenseCents / largest * 100}%`, minHeight: month.expenseCents ? 3 : 0 }} />
          </div>
          <strong>{month.label}</strong>
        </button>)}
      </div>
    </div> : <div className="chart-empty"><CircleDollarSign size={22} /><span>O gráfico diário aparece conforme as movimentações deste mês forem registradas.</span></div>}
    {selectedDay && <p className="chart-day-detail" role="status">Dia {selectedDay.label}: entraram {money(selectedDay.incomeCents)} e saíram {money(selectedDay.expenseCents)}.</p>}
  </section>;
}

function CustomerPicker({ customers, selectedId, onSelect, onCreate, isSaving }: {
  customers: Customer[]; selectedId: string; onSelect: (id: string) => void;
  onCreate: (name: string, phone: string) => Promise<boolean>; isSaving: boolean;
}) {
  const selected = customers.find((customer) => customer.id === selectedId);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const normalizedQuery = searchable(query.trim());
  const matches = customers
    .filter((customer) => !normalizedQuery || searchable(customer.name).includes(normalizedQuery))
    .slice(0, 8);

  const choose = (customer: Customer) => {
    setQuery(customer.name);
    onSelect(customer.id);
    setIsOpen(false);
    setCreating(false);
  };

  return <div className="customer-picker">
    <label htmlFor="sale-customer">Cliente</label>
    <div className="customer-picker-control">
      <Search size={18} aria-hidden="true" />
      <input
        id="sale-customer"
        value={query}
        placeholder="Digite o nome da cliente"
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="customer-options"
        aria-autocomplete="list"
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
        onChange={(event) => {
          const value = event.target.value;
          const exact = customers.find((customer) => searchable(customer.name) === searchable(value.trim()));
          setQuery(value);
          onSelect(exact?.id ?? "");
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && isOpen && matches[0]) {
            event.preventDefault();
            choose(matches[0]);
          }
          if (event.key === "Escape") setIsOpen(false);
        }}
      />
      <input className="customer-id-field" name="customer_id" value={selectedId} readOnly tabIndex={-1} aria-hidden="true" />
      {isOpen && <div className="customer-options" id="customer-options" role="listbox">
        {matches.length ? matches.map((customer) => <button
          type="button"
          role="option"
          aria-selected={customer.id === selectedId}
          className={customer.id === selectedId ? "selected" : ""}
          key={customer.id}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => choose(customer)}
        ><strong>{customer.name}</strong><small>{customer.phone || "Sem telefone"}</small></button>) : <span className="customer-empty">Nenhuma cliente encontrada.</span>}
        {query.trim() && !customers.some((customer) => searchable(customer.name) === normalizedQuery) && <button type="button" className="customer-create-option" onMouseDown={(event) => event.preventDefault()} onClick={() => { setCreating(true); setIsOpen(false); }}>+ Cadastrar {query.trim()} e continuar</button>}
      </div>}
    </div>
    {creating && <div className="inline-customer"><strong>Nova cliente: {query.trim()}</strong><label>WhatsApp (opcional)<input type="tel" inputMode="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="(00) 00000-0000" /></label><div><button type="button" className="secondary-button" onClick={() => setCreating(false)}>Voltar</button><button type="button" className="primary-button" disabled={isSaving || !query.trim()} onClick={async () => { if (await onCreate(query.trim(), newPhone)) setCreating(false); }}>{isSaving ? "Cadastrando..." : "Cadastrar e usar"}</button></div></div>}
    {selected && <small className="selected-customer">Selecionada: {selected.name}</small>}
  </div>;
}

export function DashboardShell({ profile, customers, collections, movements, chart, whatsapp, summary, purchases, purchasesLoadError, sales }: Props) {
  const [view, setView] = useState<View>("home");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<"all" | "overdue" | "soon">("all");
  const [saleMode, setSaleMode] = useState<"paid_now" | "credit" | "installments">("paid_now");
  const [saleCustomerId, setSaleCustomerId] = useState("");
  const [saleRequestId, setSaleRequestId] = useState("");
  const [movementLimit, setMovementLimit] = useState(50);
  const [cashDirection, setCashDirection] = useState<"income" | "expense">("expense");
  const [cashState, setCashState] = useState<"paid_now" | "unpaid" | "installments">("paid_now");
  const balance = summary.incomeCents - summary.expenseCents;
  const activeCustomers = customers.filter((customer) => customer.isActive);
  const overdue = collections.filter((item) => item.overdue);
  const filteredCustomers = activeCustomers.filter((customer) => searchable(`${customer.name} ${customer.phone ?? ""}`).includes(searchable(customerSearch.trim())));
  const soonLimit = new Date(); soonLimit.setDate(soonLimit.getDate() + profile.dueAlertDays);
  const soonDate = localDate(soonLimit);
  const filteredCollections = collections.filter((item) =>
    (collectionFilter === "all" || (collectionFilter === "overdue" ? item.overdue : !item.overdue && item.dueDate <= soonDate)) &&
    searchable(`${item.customer} ${item.description}`).includes(searchable(collectionSearch.trim()))
  );
  const attentionCollections = collections.filter((item) => item.overdue || item.dueDate <= soonDate).slice(0, 4);
  const showCollections = (filter: typeof collectionFilter) => { setCollectionFilter(filter); navigate("collections"); };

  const close = () => { setModal(null); setFormDirty(false); setSelectedCollection(null); setSelectedCustomer(null); setSelectedMovement(null); setFormError(""); };
  const requestClose = () => { if (isSaving) return; if (formDirty && !window.confirm("Descartar os dados preenchidos?")) return; close(); };
  const open = (next: Exclude<Modal, null>) => { setFormDirty(false); setFormError(""); setFormSuccess(""); if (next === "sale") { setSaleRequestId(crypto.randomUUID()); setSaleMode("paid_now"); setSaleCustomerId(""); } if (next === "cash") { setCashDirection("expense"); setCashState("paid_now"); } setModal(next); };
  const navigate = (next: View) => { setView(next); close(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openPayment = (collection: Collection) => { setSelectedCollection(collection); open("payment"); };
  const openCustomerEdit = (customer: Customer) => { setSelectedCustomer(customer); setFormError(""); setFormSuccess(""); setModal("editCustomer"); };
  const openMovementEdit = (movement: Movement) => { setSelectedMovement(movement); setFormError(""); setFormSuccess(""); setModal(movement.source === "sale" ? "editPayment" : "editCash"); };
  const openExpensePayment = (movement: Movement) => { setSelectedMovement(movement); setFormError(""); setFormSuccess(""); setModal("payExpense"); };
  const removeMovement = async (movement: Movement) => {
    const warning = movement.paymentId
      ? `Estornar apenas este recebimento de ${money(movement.amountCents)}? A venda será mantida e a parcela voltará a ter saldo a receber.`
      : "Excluir esta movimentação? Se for uma despesa parcelada, todas as parcelas desse lançamento também serão excluídas.";
    if (!movement.source || !movement.sourceId || !window.confirm(warning)) return;
    const data = new FormData();
    data.set("id", movement.paymentId ?? movement.sourceId);
    if (movement.paymentId) await run(voidPayment, "Recebimento estornado; venda preservada.")(data);
    else { data.set("source", movement.source); await run(voidMovement, "Movimentação excluída.")(data); }
  };
  const createCustomerDuringSale = async (name: string, phone: string) => {
    setFormError(""); setIsSaving(true);
    try {
      const data = new FormData(); data.set("name", name); data.set("phone", phone);
      const result = await createCustomer(data);
      if (!result.ok) { setFormError(result.error); return false; }
      if (!result.id) { setFormError("Cliente criada, mas não foi possível selecioná-la. Reabra a venda."); return false; }
      setSaleCustomerId(result.id); setFormDirty(true); return true;
    } catch { setFormError("Não foi possível cadastrar a cliente. Tente novamente."); return false; }
    finally { setIsSaving(false); }
  };
  const run = (action: (data: FormData) => Promise<ActionResult>, success: string) => async (data: FormData) => {
    setFormError(""); setIsSaving(true);
    try {
      const result = await action(data);
      if (!result.ok) { setFormError(result.error); return; }
      close(); setFormSuccess(success);
    } catch { setFormError("Não foi possível concluir. Verifique a conexão e tente novamente."); }
    finally { setIsSaving(false); }
  };

  const title = view === "sales" ? "Vendas" : view === "payables" ? "Contas a pagar" : view === "purchases" ? "Compras de Mercadorias" : view === "orders" ? "Pedidos de Clientes" : view === "home" ? "Visão geral" : view === "customers" ? "Clientes" : view === "collections" ? "Cobranças" : view === "movements" ? "Movimentações" : "Configurações";

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Navegação principal">
      <div className="brand-lockup"><Image src="/bazar-casual-logo.png" alt="Bazar Casual" width={92} height={72} priority /></div>
      <nav className="desktop-nav">
        {navItems.map(({ view: itemView, label, icon: Icon }) => <button className={view === itemView ? "nav-item active" : "nav-item"} onClick={() => navigate(itemView)} key={itemView}><Icon size={20} /><span>{label}</span></button>)}
      </nav>
      <form action={logout}><button className="nav-item logout-button"><LogOut size={19} />Sair</button></form>
      <div className="sidebar-note"><span className="note-mark">BC</span><div><strong>{profile.displayName}</strong><span>Gestão financeira</span></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <button className="mobile-brand plain-button" onClick={() => navigate("home")}><span className="brand-mark">BC</span><span className="mobile-brand-copy"><strong>{profile.displayName}</strong><small>{title}</small></span></button>
        <div className="topbar-actions"><button className="icon-button alert-button" aria-label="Abrir cobranças" onClick={() => showCollections("overdue")}><Bell size={20} />{overdue.length > 0 && <span>{overdue.length}</span>}</button><button className="primary-button mobile-register" onClick={() => open("menu")}><Plus size={18} />Registrar</button><button className="primary-button desktop-register" onClick={() => open("menu")}><Plus size={19} />Registrar</button></div>
      </header>

      {formSuccess && <button className="success-toast" onClick={() => setFormSuccess("")}><CheckCircle2 size={18} />{formSuccess}<X size={15} /></button>}

      <CustomerOrders customers={activeCustomers} visible={view === "orders"} />
      {view === "sales" && <SalesManager sales={sales} onCreate={() => open("sale")} onCollect={(id) => { const item = collections.find((item) => item.id === id); if (item) openPayment(item); }} />}
      {view === "payables" && <AccountsPayable entries={movements.filter((item) => item.kind === "expense" && item.source === "cash")} onCreate={() => open("cash")} onPay={(id) => { const item = movements.find((item) => item.id === id); if (item) openExpensePayment(item); }} onEdit={(id) => { const item = movements.find((item) => item.id === id); if (item) openMovementEdit(item); }} onRemove={(id) => { const item = movements.find((item) => item.id === id); if (item) void removeMovement(item); }} error={formError} busy={isSaving} />}
      {view === "purchases" && <MerchandisePurchases purchases={purchases} loadError={purchasesLoadError} />}
      {view === "home" && <section className="dashboard">
        <div className="dashboard-heading"><div><p className="eyebrow">Visão geral</p><h1>Olá! Vamos organizar o caixa?</h1><p className="heading-copy">Acompanhe o que entrou, saiu e ainda falta receber.</p></div><span className="period-label">Este mês</span></div>
        <section className="balance-panel" aria-label="Resumo do caixa"><div className="balance-main"><div className="balance-label"><span>Resultado deste mês</span><CircleDollarSign size={19} /></div><strong>{money(balance)}</strong><p>{summary.incomeCents || summary.expenseCents ? "Entradas menos despesas registradas; não é o saldo disponível." : "Você ainda não registrou movimentações neste mês."}</p></div><div className="balance-divider" /><div className="balance-stat"><span className="stat-icon income"><ArrowDownLeft size={17} /></span><div><span>Entradas</span><strong>{money(summary.incomeCents)}</strong></div></div><div className="balance-stat"><span className="stat-icon expense"><ArrowUpRight size={17} /></span><div><span>Despesas</span><strong>{money(summary.expenseCents)}</strong></div></div></section>
        <section className="money-grid"><MoneyCard label="Total a receber" value={money(summary.receivableCents)} icon={WalletCards} tone="amber" onClick={() => showCollections("all")} /><MoneyCard label="Em atraso" value={money(summary.overdueCents)} icon={Bell} tone="red" onClick={() => showCollections("overdue")} /><MoneyCard label="Vencem em breve" value={money(summary.soonCents)} icon={HandCoins} tone="pink" onClick={() => showCollections("soon")} /></section>
        <CashFlowChart months={chart} />
        <div className="content-grid"><section className="attention-card"><div className="section-title-row"><div><p className="eyebrow">Cobranças</p><h2>Precisa de atenção</h2></div><button className="text-button" onClick={() => showCollections("all")}>Ver todas <ArrowRight size={16} /></button></div>{attentionCollections.length ? <div className="alert-list">{attentionCollections.map((item) => { const state = paymentStatus(false, item.dueDate, "sale"); return <button className="alert-row" onClick={() => openPayment(item)} key={item.id}><span className={`alert-dot state-${state.tone}`} /><span><strong>{item.customer}</strong><small>{item.description} · {state.label.toLowerCase()} · vence {dateLabel(item.dueDate)}</small></span><b>{money(item.outstandingCents)}</b></button>; })}</div> : <EmptyState icon={Bell} title="Tudo em dia por aqui" copy="Quando uma parcela estiver próxima ou atrasada, ela aparece neste espaço." />}</section>
        <section className="start-card"><span className="start-kicker">REGISTRO RÁPIDO</span><h2>{movements.length ? "Próximo lançamento" : "Seu controle começa aqui"}</h2><p>{movements.length ? "Registre uma nova venda ou despesa sem sair da visão geral." : "Cadastre uma cliente ou registre a primeira movimentação do bazar."}</p><div className="start-actions"><button className="primary-button" onClick={() => open("sale")}><Plus size={18} />Nova venda</button><button className="secondary-button" onClick={() => open("cash")}><ReceiptText size={18} />Nova despesa</button></div></section></div>
      </section>}

      {view === "customers" && <section className="dashboard page-view"><div className="page-heading"><div><p className="eyebrow">Relacionamento</p><h1>Clientes</h1><p>Consulte quem compra no bazar e cadastre novos contatos.</p></div><button className="primary-button" onClick={() => open("customer")}><Plus size={18} />Nova cliente</button></div><label className="list-search"><Search size={18} /><span className="sr-only">Buscar cliente</span><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Buscar por nome ou telefone" /></label>{filteredCustomers.length ? <div className="record-grid">{filteredCustomers.map((customer) => <article className="record-card" key={customer.id}><span className="record-avatar">{customer.name.slice(0, 2).toUpperCase()}</span><div><strong>{customer.name}</strong><span>{customer.phone || "Telefone não informado"}</span>{customer.birthDate && <span className="birthday"><CalendarDays size={13} />{birthdayLabel(customer.birthDate)}</span>}{customer.phone && <a href={whatsappLink(customer.phone)} target="_blank" rel="noreferrer"><Phone size={14} />Abrir WhatsApp</a>}</div><button className="record-edit" aria-label={`Editar ${customer.name}`} onClick={() => openCustomerEdit(customer)}><Pencil size={16} /></button></article>)}</div> : <section className="attention-card"><EmptyState icon={Users} title={activeCustomers.length ? "Nenhuma cliente encontrada" : "Nenhuma cliente cadastrada"} copy={activeCustomers.length ? "Tente outro nome ou telefone." : "Cadastre a primeira cliente para registrar vendas."} /></section>}</section>}

      {view === "collections" && <section className="dashboard page-view"><div className="page-heading"><div><p className="eyebrow">A receber</p><h1>Cobranças</h1><p>Parcelas pendentes e atrasadas, ordenadas por vencimento.</p></div></div><div className="list-filters"><label className="list-search"><Search size={18} /><span className="sr-only">Buscar cobrança</span><input value={collectionSearch} onChange={(event) => setCollectionSearch(event.target.value)} placeholder="Buscar cliente ou venda" /></label><label className="list-filter-select"><span className="sr-only">Filtrar cobranças</span><select value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value as typeof collectionFilter)}><option value="all">Todas</option><option value="overdue">Em atraso</option><option value="soon">Vencem em breve</option></select></label></div>{filteredCollections.length ? <div className="collection-list">{filteredCollections.map((item) => { const state = paymentStatus(false, item.dueDate, "sale"); return <article className={`collection-row state-${state.tone}`} key={item.id}><span className={`payment-status state-${state.tone}`}>{state.label}</span><div className="collection-copy"><strong>{item.customer}</strong><span>{item.description} · parcela {item.installmentNumber}</span><small>Vencimento: {dateLabel(item.dueDate)}{item.paidCents > 0 ? ` · já pago ${money(item.paidCents)}` : ""}</small></div><div className="collection-value"><strong>{money(item.outstandingCents)}</strong><button className="compact-button" onClick={() => openPayment(item)}><HandCoins size={16} />Receber</button></div></article>; })}</div> : <section className="attention-card"><EmptyState icon={CheckCircle2} title={collections.length ? "Nenhuma cobrança neste filtro" : "Nenhuma cobrança pendente"} copy={collections.length ? "Tente outro nome ou selecione Todas." : "As vendas fiadas e parceladas aparecerão aqui."} /></section>}</section>}

      {view === "movements" && <section className="dashboard page-view">
        <div className="page-heading"><div><p className="eyebrow">Histórico</p><h1>Movimentações</h1><p>Entradas, recebimentos e despesas em ordem de data.</p></div><button className="primary-button" onClick={() => open("cash")}><Plus size={18} />Nova movimentação</button></div>
        {movements.length ? <div className="movement-list">{movements.slice(0, movementLimit).map((item) => { const state = item.kind === "income" ? { tone: "paid" as const, label: "Recebido" } : paymentStatus(item.isPaid !== false, item.dueDate); return <article className={`movement-row state-${state.tone}`} key={item.id}>
          <span className={`movement-icon ${item.kind}`}>{item.kind === "expense" ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span>
          <div><strong>{item.label}</strong><span>{item.detail} · {item.isPaid === false && item.dueDate ? `vence ${dateLabel(item.dueDate)}` : dateLabel(item.date)}</span><span className={`payment-status state-${state.tone}`}>{state.label}</span></div>
          <div className="movement-actions"><b className={item.kind}>{item.kind === "expense" ? "−" : "+"}{money(item.amountCents)}</b>{item.editable && <span>
            <button className="mini-action" aria-label={`Editar ${item.label}`} onClick={() => openMovementEdit(item)}><Pencil size={15} /></button>
            {item.kind === "expense" && item.isPaid === false && <button className="mini-action pay" onClick={() => openExpensePayment(item)}><HandCoins size={15} />Pagar</button>}
            <button className={item.paymentId ? "mini-action" : "mini-action delete"} aria-label={`${item.paymentId ? "Estornar recebimento" : "Excluir movimentação"}: ${item.label}`} disabled={isSaving} onClick={() => removeMovement(item)}>{item.paymentId ? <RotateCcw size={16} /> : <Trash2 size={16} />}</button>
          </span>}</div>
        </article>; })}</div> : <section className="attention-card"><EmptyState icon={ReceiptText} title="Nenhuma movimentação" copy="Registre uma entrada, despesa ou venda paga para começar." /></section>}
      </section>}

      {view === "movements" && movementLimit < movements.length && <button className="secondary-button" onClick={() => setMovementLimit((value) => value + 50)}>Carregar mais movimentações</button>}
      {view === "movements" && formError && <p role="alert" className="form-message error">{formError}</p>}
      {view === "settings" && <section className="dashboard page-view"><div className="page-heading"><div><p className="eyebrow">Preferências</p><h1>Configurações</h1><p>Ajuste como o sistema identifica o bazar e antecipa os alertas.</p></div></div><section className="settings-card"><div className="settings-intro"><span className="settings-icon"><SlidersHorizontal size={22} /></span><div><strong>Preferências gerais</strong><p>Essas alterações valem somente para este acesso.</p></div></div><form className="entry-form settings-form" action={run(updateProfile, "Configurações atualizadas.")}><label>Nome exibido<input name="display_name" required defaultValue={profile.displayName} /></label><label>Alertar com antecedência<select name="due_alert_days" defaultValue={String(profile.dueAlertDays)}>{[0,1,2,3,5,7,10,15,30].map((days) => <option value={days} key={days}>{days === 0 ? "Somente no vencimento" : `${days} dia${days > 1 ? "s" : ""} antes`}</option>)}</select></label>{formError && <p className="form-message error">{formError}</p>}<button className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar configurações"}</button></form></section><WhatsAppSettings settings={whatsapp} /></section>}
    </main>

    <nav className="bottom-nav" aria-label="Navegação principal no celular">{navItems.filter((item) => !item.desktopOnly).map(({ view: itemView, label, icon: Icon }) => <button className={view === itemView ? "bottom-item active" : "bottom-item"} onClick={() => navigate(itemView)} key={itemView}><Icon size={21} /><span>{label}</span></button>)}<button className={navItems.some((item) => item.view === view && item.desktopOnly) ? "bottom-item active" : "bottom-item"} onClick={() => open("more")}><Menu size={21} /><span>Mais</span></button></nav>

    {modal && <div className="modal-backdrop" onMouseDown={requestClose}><section className="register-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onInput={() => setFormDirty(true)} onChange={() => setFormDirty(true)} onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div><p className="eyebrow">{modal === "more" ? "Navegação" : "Registro rápido"}</p><h2 id="sheet-title">{modal === "menu" ? "O que você quer registrar?" : modal === "customer" ? "Nova cliente" : modal === "editCustomer" ? "Editar cliente" : modal === "sale" ? "Nova venda" : modal === "cash" ? "Movimentação do caixa" : modal === "editCash" ? "Editar movimentação" : modal === "editPayment" ? "Editar recebimento" : modal === "payExpense" ? "Pagar despesa" : modal === "payment" ? "Receber pagamento" : "Mais opções"}</h2></div><button className="icon-button" aria-label="Fechar" onClick={requestClose}><X size={20} /></button></div>
      {modal === "menu" && <div className="quick-action-list"><button className="quick-action" onClick={() => open("sale")}><span className="quick-icon pink"><ShoppingBag size={21} /></span><span className="quick-copy"><strong>Nova venda</strong><small>À vista, fiado ou parcelada</small></span><ArrowRight size={18} /></button><button className="quick-action" onClick={() => open("cash")}><span className="quick-icon dark"><ArrowUpRight size={21} /></span><span className="quick-copy"><strong>Entrada ou despesa</strong><small>Registre uma movimentação do caixa</small></span><ArrowRight size={18} /></button><button className="quick-action" onClick={() => open("customer")}><span className="quick-icon green"><Users size={21} /></span><span className="quick-copy"><strong>Nova cliente</strong><small>Nome e telefone para identificação</small></span><ArrowRight size={18} /></button></div>}
      {modal === "more" && <div className="quick-action-list">{navItems.filter((item) => ["payables", "purchases", "orders", "movements", "settings"].includes(item.view)).sort((a, b) => ["payables", "purchases", "orders", "movements", "settings"].indexOf(a.view) - ["payables", "purchases", "orders", "movements", "settings"].indexOf(b.view)).map(({ view: target, label, icon: Icon }) => <button className="quick-action" key={target} onClick={() => navigate(target)}><span className="quick-icon pink"><Icon size={21} /></span><span className="quick-copy"><strong>{label}</strong></span><ArrowRight size={18} /></button>)}<form action={logout}><button className="quick-action danger-action"><span className="quick-icon"><LogOut size={21} /></span><span className="quick-copy"><strong>Sair</strong><small>Encerrar este acesso</small></span><ArrowRight size={18} /></button></form></div>}
      {modal === "menu" && <button className="quick-action menu-purchases" onClick={() => navigate("purchases")}><span className="quick-icon pink"><ShoppingBag size={21} /></span><span className="quick-copy"><strong>Compras de Mercadorias</strong><small>Compras e despesas com fornecedores</small></span><ArrowRight size={18} /></button>}
      {formError && modal !== "more" && <p className="form-message error">{formError}</p>}
      {modal === "customer" && <form className="entry-form" action={run(createCustomer, "Cliente cadastrada.")}><label>Nome<input name="name" required autoFocus /></label><label>WhatsApp<input name="phone" inputMode="tel" placeholder="(00) 00000-0000" /></label><label>Aniversário<input name="birth_date" type="date" /></label><button className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar cliente"}</button></form>}
      {modal === "editCustomer" && selectedCustomer && <form className="entry-form" action={run(updateCustomer, "Cliente atualizada.")}><input type="hidden" name="id" value={selectedCustomer.id} /><label>Nome<input name="name" required autoFocus defaultValue={selectedCustomer.name} /></label><label>WhatsApp<input name="phone" inputMode="tel" defaultValue={selectedCustomer.phone ?? ""} /></label><label>Aniversário<input name="birth_date" type="date" defaultValue={selectedCustomer.birthDate ?? ""} /></label><label>Observações<input name="notes" defaultValue={selectedCustomer.notes ?? ""} /></label><fieldset className="customer-automation"><legend>Mensagens automáticas</legend><label className="toggle-row"><span><strong>Permitir WhatsApp para esta cliente</strong><small>Ative somente com autorização dela</small></span><input type="checkbox" name="whatsapp_enabled" defaultChecked={selectedCustomer.whatsappEnabled} /></label><label className="toggle-row"><span>Cobranças atrasadas</span><input type="checkbox" name="overdue_messages_enabled" defaultChecked={selectedCustomer.overdueMessagesEnabled} /></label><label className="toggle-row"><span>Aniversário e desconto</span><input type="checkbox" name="birthday_messages_enabled" defaultChecked={selectedCustomer.birthdayMessagesEnabled} /></label><label className="toggle-row"><span>Resumo das compras</span><input type="checkbox" name="purchase_messages_enabled" defaultChecked={selectedCustomer.purchaseMessagesEnabled} /></label></fieldset><button className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar alterações"}</button></form>}
      {modal === "cash" && <form className="entry-form" action={run(createCashEntry, "Movimentação registrada.")}><label>Tipo<select name="direction" value={cashDirection} onChange={(event) => { const direction = event.target.value as typeof cashDirection; setCashDirection(direction); if (direction === "income") setCashState("paid_now"); }}><option value="expense">Despesa</option><option value="income">Entrada extra</option></select></label><label>Descrição<input name="description" required autoFocus placeholder="Ex.: reposição de mercadoria" /></label><label>Categoria<input name="category" required defaultValue="Outros" /></label><label>Valor {cashState === "installments" ? "total" : ""}<input name="amount" required inputMode="decimal" placeholder="0,00" /></label><label>Data da compra/registro<input name="occurred_on" type="date" required defaultValue={today()} /></label>{cashDirection === "expense" && <label>Situação<select name="payment_state" value={cashState} onChange={(event) => setCashState(event.target.value as typeof cashState)}><option value="paid_now">Pago agora</option><option value="unpaid">Não pago agora</option><option value="installments">Parcelado</option></select></label>}{cashDirection === "income" && <input type="hidden" name="payment_state" value="paid_now" />}{cashState === "paid_now" ? <label>Forma de pagamento<select name="payment_method">{paymentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label> : <><label>{cashState === "installments" ? "Primeiro vencimento" : "Vencimento"}<input name="due_date" type="date" required defaultValue={today()} /></label>{cashState === "installments" && <><label>Frequência<select name="installment_frequency" defaultValue="monthly"><option value="monthly">Mensal</option><option value="biweekly">Quinzenal</option><option value="weekly">Semanal</option></select></label><label>Quantidade de parcelas<input name="installment_count" type="number" min="2" max="24" defaultValue="2" /></label></>}</>}<button className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar movimentação"}</button></form>}
      {modal === "editCash" && selectedMovement?.entryId && <form className="entry-form" action={run(updateCashEntry, "Movimentação atualizada.")}><input type="hidden" name="id" value={selectedMovement.entryId} /><label>Descrição<input name="description" required autoFocus defaultValue={selectedMovement.description} /></label><label>Categoria<input name="category" required defaultValue={selectedMovement.category} /></label><label>Valor<input name="amount" required inputMode="decimal" defaultValue={(selectedMovement.amountCents / 100).toFixed(2).replace(".", ",")} /></label><label>Data da compra/registro<input name="occurred_on" type="date" required defaultValue={selectedMovement.occurredOn} /></label><label>Vencimento<input name="due_date" type="date" required defaultValue={selectedMovement.dueDate ?? selectedMovement.occurredOn} /></label>{selectedMovement.isPaid && <label>Data do pagamento<input name="paid_on" type="date" required defaultValue={selectedMovement.date} /></label>}<label>Forma de pagamento<select name="payment_method" defaultValue={selectedMovement.paymentMethod ?? "pix"}>{paymentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar alterações"}</button></form>}
      {modal === "editPayment" && selectedMovement?.paymentId && <form className="entry-form" action={run(updatePayment, "Recebimento atualizado.")}><div className="payment-summary"><strong>{selectedMovement.label}</strong><span>{selectedMovement.detail}</span></div><input type="hidden" name="id" value={selectedMovement.paymentId} /><label>Valor recebido<input name="amount" required autoFocus inputMode="decimal" defaultValue={(selectedMovement.amountCents / 100).toFixed(2).replace(".", ",")} /></label><label>Data do recebimento<input name="paid_on" type="date" required defaultValue={selectedMovement.date} /></label><label>Forma de pagamento<select name="method" defaultValue={selectedMovement.paymentMethod ?? "pix"}>{paymentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar alterações"}</button></form>}
      {modal === "payExpense" && selectedMovement?.entryId && <form className="entry-form" action={run(markCashEntryPaid, "Despesa paga.")}><div className="payment-summary"><strong>{selectedMovement.label}</strong><span>{selectedMovement.dueDate ? `Vencimento ${dateLabel(selectedMovement.dueDate)} · ` : ""}{money(selectedMovement.amountCents)}</span></div><input type="hidden" name="id" value={selectedMovement.entryId} /><label>Forma de pagamento<select name="payment_method">{paymentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Confirmar pagamento"}</button></form>}
      {modal === "sale" && <form className="entry-form" action={run(createSale, "Venda registrada.")}><input type="hidden" name="request_id" value={saleRequestId} /><CustomerPicker customers={activeCustomers} selectedId={saleCustomerId} onSelect={(id) => { setSaleCustomerId(id); if (id) setFormDirty(true); }} onCreate={createCustomerDuringSale} isSaving={isSaving} /><label>Descrição<input name="description" placeholder="Ex.: vestido floral" /></label><label>Valor total<input name="amount" required inputMode="decimal" placeholder="0,00" /></label><label>Forma<select name="mode" value={saleMode} onChange={(event) => setSaleMode(event.target.value as typeof saleMode)}><option value="paid_now">Pago agora</option><option value="credit">Não pago agora</option><option value="installments">Parcelado</option></select></label><input type="hidden" name="sold_on" value={today()} />{saleMode === "paid_now" ? <><input type="hidden" name="due_date" value={today()} /><label>Forma de pagamento<select name="payment_method">{paymentOptions.slice(0, 4).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></> : <><input type="hidden" name="payment_method" value="pix" /><label>{saleMode === "credit" ? "Data de vencimento" : "Primeiro vencimento"}<input name="due_date" type="date" required defaultValue={today()} /></label></>}{saleMode === "installments" ? <><label>Frequência<select name="installment_frequency" defaultValue="monthly"><option value="monthly">Mensal</option><option value="biweekly">Quinzenal</option><option value="weekly">Semanal</option></select></label><label>Quantidade de parcelas<input name="installment_count" type="number" min="2" max="12" defaultValue="2" /></label></> : <><input type="hidden" name="installment_frequency" value="monthly" /><input type="hidden" name="installment_count" value="1" /></>}<button className="primary-button" disabled={!saleCustomerId || isSaving}>{isSaving ? "Salvando..." : "Salvar venda"}</button></form>}
      {modal === "payment" && selectedCollection && <form className="entry-form" action={run(recordPayment, "Pagamento registrado.")}><div className="payment-summary"><strong>{selectedCollection.customer}</strong><span>{selectedCollection.description} · saldo {money(selectedCollection.outstandingCents)}</span></div><input type="hidden" name="installment_id" value={selectedCollection.id} /><label>Valor recebido<input name="amount" required inputMode="decimal" defaultValue={(selectedCollection.outstandingCents / 100).toFixed(2).replace(".", ",")} /></label><label>Forma de pagamento<select name="method">{paymentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Confirmar recebimento"}</button></form>}
    </section></div>}
  </div>;
}
