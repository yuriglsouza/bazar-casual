import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [profileResult, customersResult, cashResult, installmentsResult, paymentsResult, salesResult] = await Promise.all([
    supabase.from("profiles").select("display_name,due_alert_days").single(),
    supabase.from("customers").select("id,name,phone,birth_date,notes,is_active,created_at").order("name"),
    supabase.from("cash_entries").select("id,direction,amount_cents,occurred_on,category,description,payment_method,is_paid,due_date,paid_at,installment_number,installment_count").is("voided_at", null).order("occurred_on", { ascending: false }).limit(200),
    supabase.from("installment_balances").select("id,sale_id,installment_number,due_date,amount_cents,paid_cents,outstanding_cents,status").order("due_date"),
    supabase.from("payments").select("id,installment_id,amount_cents,paid_at,method").is("voided_at", null).order("paid_at", { ascending: false }).limit(100),
    supabase.from("sales").select("id,customer_id,description,sold_on,total_cents,mode").is("voided_at", null),
  ]);

  const customers = customersResult.data ?? [];
  const cash = cashResult.data ?? [];
  const installments = installmentsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const sales = salesResult.data ?? [];
  const customerMap = new Map(customers.map((customer) => [customer.id, customer.name]));
  const saleMap = new Map(sales.map((sale) => [sale.id, sale]));
  const installmentMap = new Map(installments.map((installment) => [installment.id, installment]));
  const alertDays = profileResult.data?.due_alert_days ?? 3;
  const alertLimit = new Date();
  alertLimit.setDate(alertLimit.getDate() + alertDays);
  const alertLimitDate = alertLimit.toISOString().slice(0, 10);

  const collections = installments.filter((item) => Number(item.outstanding_cents) > 0).map((item) => {
    const sale = saleMap.get(item.sale_id);
    return {
      id: item.id,
      customer: sale ? customerMap.get(sale.customer_id) ?? "Cliente" : "Cliente",
      description: sale?.description || "Venda",
      installmentNumber: item.installment_number,
      dueDate: item.due_date,
      amountCents: Number(item.amount_cents),
      paidCents: Number(item.paid_cents),
      outstandingCents: Number(item.outstanding_cents),
      status: String(item.status),
      overdue: item.due_date < today,
    };
  });

  const paymentMovements = payments.map((payment) => {
    const installment = installmentMap.get(payment.installment_id);
    const sale = installment ? saleMap.get(installment.sale_id) : undefined;
    return {
      id: `payment-${payment.id}`,
      source: "payment" as const,
      sourceId: payment.id,
      editable: true,
      kind: "income" as const,
      date: payment.paid_at.slice(0, 10),
      label: `Recebimento · ${sale ? customerMap.get(sale.customer_id) ?? "Cliente" : "Cliente"}`,
      detail: sale?.description || "Pagamento de venda",
      amountCents: Number(payment.amount_cents),
      paymentMethod: payment.method,
    };
  });
  const cashMovements = cash.map((entry) => ({
    id: `cash-${entry.id}`,
    source: "cash" as const,
    sourceId: entry.id,
    entryId: entry.id,
    editable: true,
    kind: entry.direction as "income" | "expense",
    date: entry.is_paid && entry.paid_at ? entry.paid_at.slice(0, 10) : entry.occurred_on,
    label: entry.description,
    detail: `${entry.category}${entry.installment_number ? ` · parcela ${entry.installment_number}/${entry.installment_count}` : ""}`,
    amountCents: Number(entry.amount_cents),
    occurredOn: entry.occurred_on,
    dueDate: entry.due_date,
    category: entry.category,
    description: entry.description,
    isPaid: entry.is_paid,
    paymentMethod: entry.payment_method,
  }));
  const movements = [...paymentMovements, ...cashMovements]
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);

  const currentDate = new Date(`${today}T12:00:00`);
  const chart = Array.from({ length: currentDate.getDate() }, (_, index) => {
    const day = index + 1;
    const key = `${today.slice(0, 8)}${String(day).padStart(2, "0")}`;
    const dayMovements = [...paymentMovements, ...cashMovements.filter((item) => item.isPaid)].filter((item) => item.date === key);
    return {
      key,
      label: String(day).padStart(2, "0"),
      incomeCents: dayMovements.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amountCents, 0),
      expenseCents: dayMovements.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amountCents, 0),
    };
  });

  const monthPayments = payments.filter((item) => item.paid_at.slice(0, 10) >= monthStart);
  const monthCash = cash.filter((item) => item.is_paid && (item.paid_at?.slice(0, 10) ?? item.occurred_on) >= monthStart);
  const incomeCents = monthPayments.reduce((sum, item) => sum + Number(item.amount_cents), 0)
    + monthCash.filter((item) => item.direction === "income").reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const expenseCents = monthCash.filter((item) => item.direction === "expense").reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const openCollections = collections.filter((item) => item.outstandingCents > 0);

  return <DashboardShell
    profile={{ displayName: profileResult.data?.display_name ?? "Bazar Casual", dueAlertDays: alertDays }}
    customers={customers.map((customer) => ({
      id: customer.id, name: customer.name, phone: customer.phone, birthDate: customer.birth_date, notes: customer.notes,
      isActive: customer.is_active, createdAt: customer.created_at,
    }))}
    collections={collections}
    movements={movements}
    chart={chart}
    summary={{
      incomeCents, expenseCents,
      receivableCents: openCollections.reduce((sum, item) => sum + item.outstandingCents, 0),
      overdueCents: openCollections.filter((item) => item.overdue).reduce((sum, item) => sum + item.outstandingCents, 0),
      soonCents: openCollections.filter((item) => item.dueDate >= today && item.dueDate <= alertLimitDate).reduce((sum, item) => sum + item.outstandingCents, 0),
    }}
  />;
}
