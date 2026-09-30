import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  connectWhatsAppSession, createWhatsAppSession, encryptSecret, getWhatsAppQr, getWhatsAppSession,
  decryptSecret, normalizeBrazilianPhone,
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
    const { data: existing, error: existingError } = await admin.from("whatsapp_settings").select("session_id,connected_phone").eq("owner_id", ownerId).maybeSingle();
    if (existingError) throw existingError;
    let sessionId = existing?.session_id ? Number(existing.session_id) : null;
    let sessionApiKey: string | null = null;

    if (!sessionId) {
      const session = await createWhatsAppSession(phone);
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
      const { data: credential, error: credentialError } = await admin.from("whatsapp_credentials").select("session_api_key_ciphertext").eq("owner_id", ownerId).maybeSingle();
      if (credentialError || !credential) throw new Error("Não foi possível confirmar a conexão desta loja. Entre em contato com o suporte.");
      const session = await getWhatsAppSession(sessionId);
      if (decryptSecret(credential.session_api_key_ciphertext) !== session.api_key || normalizeBrazilianPhone(session.phone_number) !== phone) {
        throw new Error("Este número não corresponde à conexão desta loja.");
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
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error && typeof error.message === "string"
        ? error.message
        : "Não foi possível conectar o WhatsApp.";
    return Response.json({ error: message }, { status: 400 });
  }
}
