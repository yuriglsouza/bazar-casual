"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, MessageCircle, QrCode, Smartphone } from "lucide-react";
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

export function WhatsAppSettings({ settings }: { settings: WhatsAppSettingsData }) {
  const router = useRouter();
  const [phone, setPhone] = useState(settings.connectedPhone ?? "");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [status, setStatus] = useState(settings.sessionStatus);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
      <div className="template-list">
        <label>Mensagem de cobrança<textarea name="overdue_template" rows={5} defaultValue={settings.overdueTemplate} /><small>Variáveis: {"{{cliente_nome}}, {{total_em_atraso}}, {{vencimento_mais_antigo}}, {{nome_bazar}}"}</small></label>
        <label>Mensagem de aniversário<textarea name="birthday_template" rows={4} defaultValue={settings.birthdayTemplate} /><small>Variáveis: {"{{cliente_nome}}, {{nome_bazar}}"}</small></label>
        <label>Mensagem da compra<textarea name="purchase_template" rows={5} defaultValue={settings.purchaseTemplate} /><small>Variáveis: {"{{cliente_nome}}, {{descricao_compra}}, {{valor_total}}, {{resumo_parcelas}}, {{nome_bazar}}"}</small></label>
      </div>
      <button className="primary-button" disabled={!connected || busy}>{busy ? "Salvando..." : "Salvar automações"}</button>
    </form>
  </section>;
}
