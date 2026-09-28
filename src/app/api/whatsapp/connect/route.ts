import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  connectWhatsAppSession, createWhatsAppSession, encryptSecret, getWhatsAppQr, getWhatsAppSession,
  listWhatsAppSessions, normalizeBrazilianPhone,
} from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const ownerId = data?.claims?.sub;
    if (!ownerId) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    const body = await request.json() as { phone?: string };
    const phone = normalizeBrazilianPhone(body.phone ?? "");
    const admin = createAdminClient();
    const { data: existing } = await admin.from("whatsapp_settings").select("session_id").eq("owner_id", ownerId).maybeSingle();
    let sessionId = existing?.session_id ? Number(existing.session_id) : null;
    let sessionApiKey: string | null = null;

    if (!sessionId) {
      const sessions = await listWhatsAppSessions();
      const recovered = sessions.find((session) => normalizeBrazilianPhone(session.phone_number) === phone);
      const session = recovered ? await getWhatsAppSession(recovered.id) : await createWhatsAppSession(phone);
      sessionId = session.id;
      sessionApiKey = session.api_key;
      const { error: credentialError } = await admin.from("whatsapp_credentials").upsert({
        owner_id: ownerId, session_api_key_ciphertext: encryptSecret(session.api_key), updated_at: new Date().toISOString(),
      });
      if (credentialError) throw credentialError;
      const { error: settingError } = await admin.from("whatsapp_settings").upsert({
        owner_id: ownerId, session_id: sessionId, session_status: "connecting", connected_phone: phone,
      });
      if (settingError) throw settingError;
    } else {
      const { data: credential } = await admin.from("whatsapp_credentials").select("owner_id").eq("owner_id", ownerId).maybeSingle();
      if (!credential) {
        const session = await getWhatsAppSession(sessionId);
        sessionApiKey = session.api_key;
        const { error: credentialError } = await admin.from("whatsapp_credentials").upsert({
          owner_id: ownerId, session_api_key_ciphertext: encryptSecret(session.api_key), updated_at: new Date().toISOString(),
        });
        if (credentialError) throw credentialError;
      }
    }

    const connected = await connectWhatsAppSession(sessionId);
    const normalizedStatus = connected.status?.toLowerCase();
    const qrString = normalizedStatus === "connected" ? null : connected.qrCode || (await getWhatsAppQr(sessionId)).qrCode;
    const qrDataUrl = qrString ? await QRCode.toDataURL(qrString, { width: 320, margin: 2, errorCorrectionLevel: "M" }) : null;
    const { error } = await admin.from("whatsapp_settings").upsert({
      owner_id: ownerId, session_id: sessionId, session_status: normalizedStatus === "connected" ? "connected" : "need_scan",
      connected_phone: phone,
    });
    if (error) throw error;
    return Response.json({ qrDataUrl, status: connected.status, hasSessionKey: Boolean(sessionApiKey) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível conectar o WhatsApp.";
    return Response.json({ error: message }, { status: 400 });
  }
}
