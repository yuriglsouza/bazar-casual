alter table public.customers
  add column whatsapp_enabled boolean not null default false,
  add column overdue_messages_enabled boolean not null default false,
  add column birthday_messages_enabled boolean not null default false,
  add column purchase_messages_enabled boolean not null default false,
  add column whatsapp_consent_at timestamptz;

create table public.whatsapp_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  overdue_enabled boolean not null default false,
  birthday_enabled boolean not null default false,
  purchase_summary_enabled boolean not null default false,
  session_id bigint,
  session_status text not null default 'not_connected'
    check (session_status in ('not_connected', 'connecting', 'need_scan', 'connected', 'disconnected', 'logged_out', 'expired', 'error')),
  connected_phone text,
  overdue_template text not null default 'Olá, {{cliente_nome}}! Identificamos um saldo de {{total_em_atraso}} em atraso desde {{vencimento_mais_antigo}}. Quando puder, fale com a gente para combinar o pagamento. — {{nome_bazar}}',
  birthday_template text not null default 'Feliz aniversário, {{cliente_nome}}! 🎉 Você ganhou 10% de desconto para usar no {{nome_bazar}}. Esperamos você!',
  purchase_template text not null default 'Olá, {{cliente_nome}}! Sua compra no {{nome_bazar}} foi registrada: {{descricao_compra}}, total {{valor_total}}. {{resumo_parcelas}}',
  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_credentials (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  session_api_key_ciphertext text not null,
  updated_at timestamptz not null default now()
);

create table public.whatsapp_message_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  installment_id uuid references public.installments(id) on delete set null,
  message_type text not null check (message_type in ('overdue', 'birthday', 'purchase_summary', 'manual')),
  idempotency_key text not null,
  phone text not null,
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'accepted', 'delivered', 'failed', 'cancelled', 'skipped')),
  provider_message_id text,
  error_message text,
  attempt_count smallint not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create index whatsapp_message_log_owner_created_idx on public.whatsapp_message_log (owner_id, created_at desc);
create index whatsapp_message_log_pending_idx on public.whatsapp_message_log (status, created_at) where status in ('pending', 'failed');

create trigger whatsapp_settings_touch_updated_at before update on public.whatsapp_settings
for each row execute function public.touch_updated_at();
create trigger whatsapp_message_log_touch_updated_at before update on public.whatsapp_message_log
for each row execute function public.touch_updated_at();

alter table public.whatsapp_settings enable row level security;
alter table public.whatsapp_message_log enable row level security;

revoke all on table public.whatsapp_settings, public.whatsapp_message_log from anon, authenticated;
grant select, insert, update on table public.whatsapp_settings to authenticated;
grant select on table public.whatsapp_message_log to authenticated;

create policy "whatsapp_settings_select_own" on public.whatsapp_settings for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "whatsapp_settings_insert_own" on public.whatsapp_settings for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "whatsapp_settings_update_own" on public.whatsapp_settings for update to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "whatsapp_message_log_select_own" on public.whatsapp_message_log for select to authenticated
using ((select auth.uid()) = owner_id);

alter table public.whatsapp_credentials enable row level security;
revoke all on table public.whatsapp_credentials from public, anon, authenticated;
