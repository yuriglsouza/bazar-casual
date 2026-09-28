import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const API_BASE = "https://www.wasenderapi.com/api";

function encryptionKey() {
  const secret = process.env.WHATSAPP_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error("A chave de proteção do WhatsApp não foi configurada.");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Credencial do WhatsApp inválida.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null) as { success?: boolean; data?: T; message?: string } | null;
  if (!response.ok || !body?.success) throw new Error(body?.message || `WaSender respondeu com erro (${response.status}).`);
  return body.data as T;
}

export function createWhatsAppSession(phone: string) {
  const token = process.env.WASENDER_PERSONAL_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("O token seguro do WaSender ainda não foi configurado.");
  return request<{ id: number; api_key: string; status: string; phone_number: string }>("/whatsapp-sessions", token, {
    method: "POST",
    body: JSON.stringify({
      name: "Bazar Casual", phone_number: phone, account_protection: true, log_messages: true,
      webhook_enabled: false,
      read_incoming_messages: false, auto_reject_calls: false, ignore_groups: true, ignore_channels: true, ignore_broadcasts: true,
    }),
  });
}

export function listWhatsAppSessions() {
  const token = process.env.WASENDER_PERSONAL_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("O token seguro do WaSender ainda não foi configurado.");
  return request<Array<{ id: number; phone_number: string; status: string }>>("/whatsapp-sessions", token);
}

export function getWhatsAppSession(sessionId: number) {
  const token = process.env.WASENDER_PERSONAL_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("O token seguro do WaSender ainda não foi configurado.");
  return request<{ id: number; api_key: string; phone_number: string; status: string }>(`/whatsapp-sessions/${sessionId}`, token);
}

export function connectWhatsAppSession(sessionId: number) {
  const token = process.env.WASENDER_PERSONAL_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("O token seguro do WaSender ainda não foi configurado.");
  return request<{ status: string; qrCode?: string }>(`/whatsapp-sessions/${sessionId}/connect`, token, {
    method: "POST", body: JSON.stringify({ linkMethod: "qr" }),
  });
}

export function getWhatsAppQr(sessionId: number) {
  const token = process.env.WASENDER_PERSONAL_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("O token seguro do WaSender ainda não foi configurado.");
  return request<{ qrCode: string }>(`/whatsapp-sessions/${sessionId}/qrcode`, token);
}

export function getWhatsAppStatus(sessionApiKey: string) {
  return request<{ status: string }>("/status", sessionApiKey);
}

export function sendWhatsAppText(sessionApiKey: string, phone: string, text: string) {
  return request<{ msgId: string | number; jid: string; status: string }>("/send-message", sessionApiKey, {
    method: "POST", body: JSON.stringify({ to: phone, text }),
  });
}

export function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  throw new Error("Informe um WhatsApp com DDD válido.");
}

export function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key: string) => values[key] ?? "");
}
