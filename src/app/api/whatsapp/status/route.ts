import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, getWhatsAppStatus } from "@/lib/whatsapp";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const ownerId = data?.claims?.sub;
    if (!ownerId) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    const admin = createAdminClient();
    const { data: credential, error } = await admin.from("whatsapp_credentials")
      .select("session_api_key_ciphertext").eq("owner_id", ownerId).single();
    if (error) throw error;
    const result = await getWhatsAppStatus(decryptSecret(credential.session_api_key_ciphertext));
    const normalized = result.status.toLowerCase();
    const allowed = ["connecting", "need_scan", "connected", "disconnected", "logged_out", "expired"];
    const status = allowed.includes(normalized) ? normalized : "error";
    await admin.from("whatsapp_settings").update({
      session_status: status,
      ...(status === "connected" ? { last_connected_at: new Date().toISOString() } : {}),
    }).eq("owner_id", ownerId);
    return Response.json({ status }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível consultar o WhatsApp.";
    return Response.json({ error: message }, { status: 400 });
  }
}
