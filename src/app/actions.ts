"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const requiredText = z.string().trim().min(1);
const optionalText = z.string().trim().optional();
const paymentMethod = z.enum(["pix", "cash", "credit_card", "debit_card", "transfer", "other"]);
const installmentFrequency = z.enum(["monthly", "biweekly", "weekly"]);

function cents(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").replace(/\./g, "").replace(",", ".");
  return Math.round(Number(normalized) * 100);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.";
}

function scheduledDate(firstDate: string, index: number, frequency: z.infer<typeof installmentFrequency>) {
  const date = new Date(`${firstDate}T12:00:00`);
  if (frequency === "weekly") date.setDate(date.getDate() + index * 7);
  else if (frequency === "biweekly") date.setDate(date.getDate() + index * 15);
  else date.setMonth(date.getMonth() + index);
  return date.toISOString().slice(0, 10);
}

async function authenticated() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;
  if (!ownerId) throw new Error("Sua sessão expirou. Entre novamente.");
  return { supabase, ownerId };
}

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = z.object({ name: requiredText, phone: optionalText, birth_date: z.string().date().optional() }).safeParse({
      name: formData.get("name"), phone: formData.get("phone"), birth_date: formData.get("birth_date") || undefined,
    });
    if (!parsed.success) return { ok: false, error: "Informe o nome da cliente." };
    const { supabase, ownerId } = await authenticated();
    const { error } = await supabase.from("customers").insert({ owner_id: ownerId, ...parsed.data });
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function updateCustomer(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = z.object({
      id: z.string().uuid(), name: requiredText, phone: optionalText,
      birth_date: z.string().date().nullable(), notes: optionalText,
    }).safeParse({
      id: formData.get("id"), name: formData.get("name"), phone: formData.get("phone"),
      birth_date: formData.get("birth_date") || null, notes: formData.get("notes"),
    });
    if (!parsed.success) return { ok: false, error: "Confira os dados da cliente." };
    const { supabase, ownerId } = await authenticated();
    const { id, ...changes } = parsed.data;
    const { error } = await supabase.from("customers").update(changes).eq("id", id).eq("owner_id", ownerId).select("id").single();
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function createCashEntry(formData: FormData): Promise<ActionResult> {
  try {
    const amountCents = cents(formData.get("amount"));
    const parsed = z.object({
      direction: z.enum(["income", "expense"]), description: requiredText,
      category: requiredText, occurred_on: z.string().date(),
      payment_state: z.enum(["paid_now", "unpaid", "installments"]),
      payment_method: paymentMethod,
      due_date: z.string().date(),
      installment_count: z.coerce.number().int().min(2).max(24),
      installment_frequency: installmentFrequency,
    }).safeParse({
      direction: formData.get("direction"), description: formData.get("description"),
      category: formData.get("category"), occurred_on: formData.get("occurred_on"),
      payment_state: formData.get("payment_state") || "paid_now",
      payment_method: formData.get("payment_method") || "pix",
      due_date: formData.get("due_date") || formData.get("occurred_on"),
      installment_count: formData.get("installment_count") || 2,
      installment_frequency: formData.get("installment_frequency") || "monthly",
    });
    if (!parsed.success || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return { ok: false, error: "Preencha os dados e informe um valor válido." };
    }
    const { supabase, ownerId } = await authenticated();
    const state = parsed.data.direction === "income" ? "paid_now" : parsed.data.payment_state;
    const count = state === "installments" ? parsed.data.installment_count : 1;
    const base = Math.floor(amountCents / count);
    const groupId = state === "installments" ? crypto.randomUUID() : null;
    const entries = Array.from({ length: count }, (_, index) => {
      const paid = state === "paid_now";
      const dueDate = state === "installments"
        ? scheduledDate(parsed.data.due_date, index, parsed.data.installment_frequency)
        : parsed.data.due_date;
      return {
        owner_id: ownerId,
        direction: parsed.data.direction,
        description: parsed.data.description,
        category: parsed.data.category,
        occurred_on: parsed.data.occurred_on,
        amount_cents: base + (index === count - 1 ? amountCents - base * count : 0),
        payment_method: paid ? parsed.data.payment_method : null,
        is_paid: paid,
        due_date: dueDate,
        paid_at: paid ? `${parsed.data.occurred_on}T12:00:00-03:00` : null,
        installment_group_id: groupId,
        installment_number: state === "installments" ? index + 1 : null,
        installment_count: state === "installments" ? count : null,
        installment_frequency: state === "installments" ? parsed.data.installment_frequency : null,
      };
    });
    const { error } = await supabase.from("cash_entries").insert(entries);
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function updateCashEntry(formData: FormData): Promise<ActionResult> {
  try {
    const amountCents = cents(formData.get("amount"));
    const parsed = z.object({
      id: z.string().uuid(), description: requiredText, category: requiredText,
      occurred_on: z.string().date(), due_date: z.string().date(), payment_method: paymentMethod,
    }).safeParse({
      id: formData.get("id"), description: formData.get("description"), category: formData.get("category"),
      occurred_on: formData.get("occurred_on"), due_date: formData.get("due_date") || formData.get("occurred_on"),
      payment_method: formData.get("payment_method") || "pix",
    });
    if (!parsed.success || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return { ok: false, error: "Confira os dados e o valor da movimentação." };
    }
    const { supabase, ownerId } = await authenticated();
    const { id, payment_method, ...changes } = parsed.data;
    const { data: current, error: currentError } = await supabase.from("cash_entries")
      .select("is_paid").eq("id", id).eq("owner_id", ownerId).single();
    if (currentError) throw currentError;
    const { error } = await supabase.from("cash_entries").update({
      ...changes, amount_cents: amountCents, payment_method: current.is_paid ? payment_method : null,
    }).eq("id", id).eq("owner_id", ownerId).select("id").single();
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function markCashEntryPaid(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = z.object({ id: z.string().uuid(), payment_method: paymentMethod }).safeParse({
      id: formData.get("id"), payment_method: formData.get("payment_method"),
    });
    if (!parsed.success) return { ok: false, error: "Escolha uma forma de pagamento." };
    const { supabase, ownerId } = await authenticated();
    const { error } = await supabase.from("cash_entries").update({
      is_paid: true, paid_at: new Date().toISOString(), payment_method: parsed.data.payment_method,
    }).eq("id", parsed.data.id).eq("owner_id", ownerId).eq("is_paid", false).select("id").single();
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function createSale(formData: FormData): Promise<ActionResult> {
  try {
    const amountCents = cents(formData.get("amount"));
    const parsed = z.object({
      customer_id: z.string().uuid(), description: optionalText,
      sold_on: z.string().date(), mode: z.enum(["paid_now", "credit", "installments"]),
      due_date: z.string().date(), installment_count: z.coerce.number().int().min(1).max(12),
      installment_frequency: installmentFrequency,
      payment_method: paymentMethod,
    }).safeParse({
      customer_id: formData.get("customer_id"), description: formData.get("description"),
      sold_on: formData.get("sold_on"), mode: formData.get("mode"),
      due_date: formData.get("due_date"), installment_count: formData.get("installment_count") || 1,
      installment_frequency: formData.get("installment_frequency") || "monthly",
      payment_method: formData.get("payment_method") || "pix",
    });
    if (!parsed.success || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return { ok: false, error: "Confira cliente, valor e datas da venda." };
    }

    const { supabase, ownerId } = await authenticated();
    const { data: sale, error: saleError } = await supabase.from("sales").insert({
      owner_id: ownerId, customer_id: parsed.data.customer_id,
      description: parsed.data.description, sold_on: parsed.data.sold_on,
      total_cents: amountCents, mode: parsed.data.mode,
    }).select("id").single();
    if (saleError) throw saleError;

    const count = parsed.data.mode === "installments" ? parsed.data.installment_count : 1;
    const base = Math.floor(amountCents / count);
    const installments = Array.from({ length: count }, (_, index) => {
      return {
        owner_id: ownerId, sale_id: sale.id, installment_number: index + 1,
        due_date: scheduledDate(parsed.data.due_date, index, parsed.data.installment_frequency),
        amount_cents: base + (index === count - 1 ? amountCents - base * count : 0),
      };
    });
    const { data: created, error: installmentError } = await supabase.from("installments").insert(installments).select("id, amount_cents");
    if (installmentError) throw installmentError;

    if (parsed.data.mode === "paid_now") {
      const first = created?.[0];
      if (!first) throw new Error("Não foi possível registrar o recebimento.");
      const { error } = await supabase.rpc("record_payment", {
        installment_id_input: first.id, amount_cents_input: first.amount_cents, method_input: parsed.data.payment_method,
      });
      if (error) throw error;
    }
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function recordPayment(formData: FormData): Promise<ActionResult> {
  try {
    const amountCents = cents(formData.get("amount"));
    const parsed = z.object({
      installment_id: z.string().uuid(),
      method: paymentMethod,
    }).safeParse({ installment_id: formData.get("installment_id"), method: formData.get("method") });
    if (!parsed.success || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return { ok: false, error: "Informe um valor de pagamento válido." };
    }
    const { supabase } = await authenticated();
    const { error } = await supabase.rpc("record_payment", {
      installment_id_input: parsed.data.installment_id,
      amount_cents_input: amountCents,
      method_input: parsed.data.method,
    });
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = z.object({
      display_name: requiredText.max(80),
      due_alert_days: z.coerce.number().int().min(0).max(30),
    }).safeParse({
      display_name: formData.get("display_name"),
      due_alert_days: formData.get("due_alert_days"),
    });
    if (!parsed.success) return { ok: false, error: "Confira o nome e os dias de antecedência." };
    const { supabase, ownerId } = await authenticated();
    const { error } = await supabase.from("profiles").update(parsed.data).eq("id", ownerId);
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}
