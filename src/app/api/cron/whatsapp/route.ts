import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, normalizeBrazilianPhone, renderTemplate, sendWhatsAppText } from "@/lib/whatsapp";

export const maxDuration = 60;

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const localDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const brDate = (date: string) => new Date(`${date}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  const today = localDate();
  const { data: settings, error: settingsError } = await admin.from("whatsapp_settings")
    .select("owner_id,overdue_enabled,birthday_enabled,overdue_template,birthday_template")
    .eq("enabled", true).eq("session_status", "connected");
  if (settingsError) throw settingsError;
  let sent = 0; let skipped = 0; let failed = 0;

  for (const setting of settings ?? []) {
    const [{ data: credential }, { data: profile }, { data: customers }, { data: balances }, { data: sales }] = await Promise.all([
      admin.from("whatsapp_credentials").select("session_api_key_ciphertext").eq("owner_id", setting.owner_id).maybeSingle(),
      admin.from("profiles").select("display_name").eq("id", setting.owner_id).maybeSingle(),
      admin.from("customers").select("id,name,phone,birth_date,overdue_messages_enabled,birthday_messages_enabled")
        .eq("owner_id", setting.owner_id).eq("is_active", true).eq("whatsapp_enabled", true),
      admin.from("installment_balances").select("id,sale_id,due_date,outstanding_cents,status").eq("owner_id", setting.owner_id),
      admin.from("sales").select("id,customer_id").eq("owner_id", setting.owner_id).is("voided_at", null),
    ]);
    if (!credential) { failed++; continue; }
    const token = decryptSecret(credential.session_api_key_ciphertext);
    const saleCustomers = new Map((sales ?? []).map((sale) => [sale.id, sale.customer_id]));

    for (const customer of customers ?? []) {
      const jobs: Array<{ type: "overdue" | "birthday"; key: string; content: string; installmentId?: string }> = [];
      if (setting.overdue_enabled && customer.overdue_messages_enabled) {
        const overdue = (balances ?? []).filter((item) => saleCustomers.get(item.sale_id) === customer.id && item.due_date < today && Number(item.outstanding_cents) > 0);
        if (overdue.length) {
          const oldest = overdue.toSorted((a, b) => a.due_date.localeCompare(b.due_date))[0];
          const total = overdue.reduce((sum, item) => sum + Number(item.outstanding_cents), 0);
          jobs.push({
            type: "overdue", key: `overdue:${customer.id}:${oldest.due_date}`,
            installmentId: oldest.id,
            content: renderTemplate(setting.overdue_template, {
              cliente_nome: customer.name, nome_bazar: profile?.display_name ?? "Bazar Casual",
              total_em_atraso: money(total), vencimento_mais_antigo: brDate(oldest.due_date),
            }),
          });
        }
      }
      if (setting.birthday_enabled && customer.birthday_messages_enabled && customer.birth_date?.slice(5) === today.slice(5)) {
        jobs.push({
          type: "birthday", key: `birthday:${customer.id}:${today.slice(0, 4)}`,
          content: renderTemplate(setting.birthday_template, { cliente_nome: customer.name, nome_bazar: profile?.display_name ?? "Bazar Casual" }),
        });
      }

      for (const job of jobs) {
        try {
          const phone = normalizeBrazilianPhone(customer.phone ?? "");
          const { data: log, error: insertError } = await admin.from("whatsapp_message_log").insert({
            owner_id: setting.owner_id, customer_id: customer.id, installment_id: job.installmentId,
            message_type: job.type, idempotency_key: job.key, phone, content: job.content, status: "processing", attempt_count: 1,
          }).select("id").single();
          if (insertError?.code === "23505") { skipped++; continue; }
          if (insertError || !log) throw insertError ?? new Error("Não foi possível reservar a mensagem.");
          try {
            const result = await sendWhatsAppText(token, phone, job.content);
            await admin.from("whatsapp_message_log").update({ status: "accepted", provider_message_id: String(result.msgId), sent_at: new Date().toISOString() }).eq("id", log.id);
            sent++;
          } catch (sendError) {
            await admin.from("whatsapp_message_log").update({ status: "failed", error_message: sendError instanceof Error ? sendError.message.slice(0, 300) : "Falha no envio" }).eq("id", log.id);
            failed++;
          }
        } catch { failed++; }
      }
    }
  }
  return Response.json({ ok: true, sent, skipped, failed, date: today });
}
