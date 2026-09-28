"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Gift, LoaderCircle, MessageCircle, QrCode, ReceiptText, RotateCcw, Smartphone, type LucideIcon } from "lucide-react";
import { updateWhatsAppSettings } from "@/app/actions";

export type WhatsAppSettingsData = {
  enabled: boolean;
  overdueEnabled: boolean;
  birthdayEnabled: boolean;
  purchaseSummaryEnabled: boolean;
  sessionStatus: string;
  connectedPhone: string | null;
  overdueTemplate: string;
  birthdayTemplate: string;
  purchaseTemplate: string;
};

const statusLabels: Record<string, string> = {
  not_connected: "Não conectado", connecting: "Conectando", need_scan: "Aguardando leitura do QR Code",
  connected: "Conectado", disconnected: "Desconectado", logged_out: "Saiu do WhatsApp", expired: "Conexão expirada", error: "Verifique a conexão",
};

const friendlyFields: Record<string, string> = {
  cliente_nome: "Nome da cliente", total_em_atraso: "Valor em atraso",
  vencimento_mais_antigo: "Data do vencimento", nome_bazar: "Nome do bazar",
  descricao_compra: "Descrição da compra", valor_total: "Valor total", resumo_parcelas: "Parcelas e vencimentos",
};
const exampleFields: Record<string, string> = {
  "Nome da cliente": "Ana", "Valor em atraso": "R$ 75,00", "Data do vencimento": "15/09/2026",
  "Nome do bazar": "Bazar Casual", "Descrição da compra": "Vestido floral", "Valor total": "R$ 150,00",
  "Parcelas e vencimentos": "3 parcelas de R$ 50,00: 10/10, 10/11 e 10/12",
};
const defaults = {
  overdue: "Olá, [Nome da cliente]! Notamos que o valor de [Valor em atraso], com vencimento em [Data do vencimento], ainda está pendente. Quando puder, fale com a gente para combinar o pagamento. — [Nome do bazar]",
  birthday: "Feliz aniversário, [Nome da cliente]! 🎉 Você ganhou 10% de desconto para usar no [Nome do bazar]. Esperamos você!",
  purchase: "Olá, [Nome da cliente]! Sua compra no [Nome do bazar] foi registrada: [Descrição da compra], total de [Valor total]. [Parcelas e vencimentos]",
};

function toFriendly(template: string) {
  return template.replace(/{{\s*([a-z_]+)\s*}}/g, (match, key: string) => friendlyFields[key] ? `[${friendlyFields[key]}]` : match);
}

function toInternal(template: string) {
  return Object.entries(friendlyFields).reduce((text, [key, label]) => text.replaceAll(`[${label}]`, `{{${key}}}`), template);
}

function preview(template: string) {
  return Object.entries(exampleFields).reduce((text, [field, value]) => text.replaceAll(`[${field}]`, value), template);
}

function MessageTemplateEditor({ icon: Icon, title, description, name, value, onChange, fields, defaultText, tone }: {
  icon: LucideIcon; title: string; description: string; name: string; value: string; onChange: (value: string) => void;
  fields: string[]; defaultText: string; tone: "pink" | "green" | "amber";
}) {
  const addField = (field: string) => onChange(`${value}${value.endsWith(" ") || !value ? "" : " "}[${field}]`);
  return <article className="message-template-card">
    <div className="message-template-heading"><span className={`message-template-icon ${tone}`}><Icon size={19} /></span><div><strong>{title}</strong><p>{description}</p></div></div>
    <label className="friendly-message-label">Texto da mensagem<textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} /></label>
    <input type="hidden" name={name} value={toInternal(value)} />
    <div className="message-fields"><span>Adicionar informação:</span>{fields.map((field) => <button type="button" onClick={() => addField(field)} key={field}>+ {field}</button>)}</div>
    <div className="message-preview"><span>Prévia no WhatsApp</span><p>{preview(value)}</p></div>
    <button className="restore-message" type="button" onClick={() => onChange(defaultText)}><RotateCcw size={14} />Restaurar texto sugerido</button>
  </article>;
}

export function WhatsAppSettings({ settings }: { settings: WhatsAppSettingsData }) {
  const router = useRouter();
  const [phone, setPhone] = useState(settings.connectedPhone ?? "");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [status, setStatus] = useState(settings.sessionStatus);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [overdueTemplate, setOverdueTemplate] = useState(() => toFriendly(settings.overdueTemplate));
  const [birthdayTemplate, setBirthdayTemplate] = useState(() => toFriendly(settings.birthdayTemplate));
  const [purchaseTemplate, setPurchaseTemplate] = useState(() => toFriendly(settings.purchaseTemplate));

  useEffect(() => {
    if (!qrDataUrl || status === "connected") return;
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/whatsapp/status", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { status: string };
      setStatus(data.status);
      if (data.status === "connected") {
        setQrDataUrl("");
        setMessage("WhatsApp conectado com sucesso.");
        router.refresh();
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [qrDataUrl, router, status]);

  const connect = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/whatsapp/connect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }),
      });
      const data = await response.json() as { qrDataUrl?: string | null; status?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível gerar o QR Code.");
      const nextStatus = data.status?.toLowerCase() === "connected" ? "connected" : "need_scan";
      if (nextStatus !== "connected" && !data.qrDataUrl) throw new Error("O WaSender não retornou um QR Code. Tente novamente em alguns segundos.");
      setQrDataUrl(data.qrDataUrl ?? "");
      setStatus(nextStatus);
      if (nextStatus === "connected") { setMessage("WhatsApp já está conectado."); router.refresh(); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível conectar."); }
    finally { setBusy(false); }
  };

  const save = async (formData: FormData) => {
    setBusy(true); setError(""); setMessage("");
    const result = await updateWhatsAppSettings(formData);
    if (result.ok) { setMessage("Preferências do WhatsApp salvas."); router.refresh(); }
    else setError(result.error);
    setBusy(false);
  };

  const connected = status === "connected";
  return <section className="settings-card whatsapp-settings">
    <div className="settings-intro">
      <span className="settings-icon whatsapp"><MessageCircle size={22} /></span>
      <div><strong>WhatsApp automático</strong><p>Recurso opcional. O controle financeiro continua funcionando mesmo quando estiver desligado.</p></div>
      <span className={connected ? "connection-pill connected" : "connection-pill"}>{connected && <CheckCircle2 size={14} />}{statusLabels[status] ?? "Não conectado"}</span>
    </div>

    <div className="whatsapp-connect">
      <div><h3>Conectar número da loja</h3><p>Abra esta tela no computador. No celular, vá em WhatsApp → Aparelhos conectados → Conectar aparelho.</p></div>
      <label>Número com DDD<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="(00) 00000-0000" disabled={connected} /></label>
      {!connected && <button className="secondary-button" type="button" onClick={connect} disabled={busy || !phone.trim()}>{busy ? <LoaderCircle className="spin" size={18} /> : <QrCode size={18} />}Gerar QR Code</button>}
      {connected && <p className="connected-copy"><Smartphone size={17} />Número conectado: {settings.connectedPhone || phone}</p>}
    </div>

    {qrDataUrl && <div className="qr-panel"><Image src={qrDataUrl} alt="QR Code para conectar o WhatsApp" width={280} height={280} unoptimized /><div><strong>Escaneie este código</strong><p>O código é temporário. Esta tela confirmará automaticamente quando o WhatsApp estiver conectado.</p></div></div>}
    {error && <p className="form-message error">{error}</p>}
    {message && <p className="form-message success">{message}</p>}

    <form className="entry-form whatsapp-form" action={save}>
      <fieldset disabled={!connected || busy}>
        <legend>Automações</legend>
        <label className="toggle-row"><span><strong>Ativar integração</strong><small>Botão geral para pausar todos os envios</small></span><input type="checkbox" name="enabled" defaultChecked={settings.enabled} /></label>
        <label className="toggle-row"><span><strong>Cobranças atrasadas</strong><small>Mensagem cordial uma vez por parcela atrasada</small></span><input type="checkbox" name="overdue_enabled" defaultChecked={settings.overdueEnabled} /></label>
        <label className="toggle-row"><span><strong>Feliz aniversário + 10%</strong><small>Uma mensagem por cliente a cada ano</small></span><input type="checkbox" name="birthday_enabled" defaultChecked={settings.birthdayEnabled} /></label>
        <label className="toggle-row"><span><strong>Resumo após a compra</strong><small>Informa valor, quantidade e datas das parcelas</small></span><input type="checkbox" name="purchase_summary_enabled" defaultChecked={settings.purchaseSummaryEnabled} /></label>
      </fieldset>
      <div className="message-section-heading"><div><span>Mensagens automáticas</span><h3>Escolha como falar com suas clientes</h3></div><p>Os campos entre colchetes são preenchidos automaticamente antes do envio.</p></div>
      <div className="template-list">
        <MessageTemplateEditor icon={BellRing} tone="amber" title="Lembrete de pagamento" description="Enviada quando uma parcela estiver atrasada." name="overdue_template" value={overdueTemplate} onChange={setOverdueTemplate} fields={["Nome da cliente", "Valor em atraso", "Data do vencimento", "Nome do bazar"]} defaultText={defaults.overdue} />
        <MessageTemplateEditor icon={Gift} tone="pink" title="Feliz aniversário" description="Enviada no aniversário com o desconto de 10%." name="birthday_template" value={birthdayTemplate} onChange={setBirthdayTemplate} fields={["Nome da cliente", "Nome do bazar"]} defaultText={defaults.birthday} />
        <MessageTemplateEditor icon={ReceiptText} tone="green" title="Confirmação da compra" description="Enviada após uma venda nova ser registrada." name="purchase_template" value={purchaseTemplate} onChange={setPurchaseTemplate} fields={["Nome da cliente", "Descrição da compra", "Valor total", "Parcelas e vencimentos", "Nome do bazar"]} defaultText={defaults.purchase} />
      </div>
      <button className="primary-button" disabled={!connected || busy}>{busy ? "Salvando..." : "Salvar automações"}</button>
    </form>
  </section>;
}
