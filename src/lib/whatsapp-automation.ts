import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, normalizeBrazilianPhone, renderTemplate, sendWhatsAppText } from "@/lib/whatsapp";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateLabel = (date: string) => new Date(`${date}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function sendPurchaseSummary(input: {
  ownerId: string;
  saleId: string;
  customerId: string;
  description: string | undefined;
  totalCents: number;
  paid?: boolean;
  installments: Array<{ id: string; installment_number: number; due_date: string; amount_cents: number }>;
}) {
  const admin = createAdminClient();
  const [{ data: setting }, { data: customer }, { data: profile }, { data: credential }, { data: sale }] = await Promise.all([
    admin.from("whatsapp_settings").select("purchase_summary_enabled,purchase_template,enabled,session_status").eq("owner_id", input.ownerId).maybeSingle(),
    admin.from("customers").select("name,phone,whatsapp_enabled,purchase_messages_enabled").eq("id", input.customerId).eq("owner_id", input.ownerId).maybeSingle(),
    admin.from("profiles").select("display_name").eq("id", input.ownerId).maybeSingle(),
    admin.from("whatsapp_credentials").select("session_api_key_ciphertext").eq("owner_id", input.ownerId).maybeSingle(),
    admin.from("sales").select("id").eq("id", input.saleId).eq("owner_id", input.ownerId).is("voided_at", null).maybeSingle(),
  ]);
  if (!setting?.enabled || !setting.purchase_summary_enabled || setting.session_status !== "connected" ||
      !customer?.whatsapp_enabled || !customer.purchase_messages_enabled || !customer.phone || !credential || !sale) return;

  const phone = normalizeBrazilianPhone(customer.phone);
  const schedule = input.paid ? "Pagamento recebido. Sua compra está quitada." : input.installments.length === 1
    ? `Vencimento: ${dateLabel(input.installments[0].due_date)}.`
    : `${input.installments.length} parcelas: ${input.installments.map((item) => `${item.installment_number}ª ${money(Number(item.amount_cents))} em ${dateLabel(item.due_date)}`).join("; ")}.`;
  const content = renderTemplate(setting.purchase_template, {
    cliente_nome: customer.name, nome_bazar: profile?.display_name ?? "Bazar Casual",
    descricao_compra: input.description || "Compra", valor_total: money(input.totalCents), resumo_parcelas: schedule,
  });
  const { data: log, error } = await admin.from("whatsapp_message_log").insert({
    owner_id: input.ownerId, customer_id: input.customerId, sale_id: input.saleId,
    message_type: "purchase_summary", idempotency_key: `purchase_summary:${input.saleId}:original`,
    phone, content, status: "processing", attempt_count: 1,
  }).select("id").single();
  if (error?.code === "23505") return;
  if (error || !log) throw error ?? new Error("Não foi possível reservar o resumo da compra.");
  try {
    const result = await sendWhatsAppText(decryptSecret(credential.session_api_key_ciphertext), phone, content);
    await admin.from("whatsapp_message_log").update({ status: "accepted", provider_message_id: String(result.msgId), sent_at: new Date().toISOString() }).eq("id", log.id);
  } catch (sendError) {
    await admin.from("whatsapp_message_log").update({ status: "failed", error_message: sendError instanceof Error ? sendError.message.slice(0, 300) : "Falha no envio" }).eq("id", log.id);
  }
}
