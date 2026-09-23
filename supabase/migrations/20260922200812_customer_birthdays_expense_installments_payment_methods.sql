alter type public.payment_method add value if not exists 'credit_card';
alter type public.payment_method add value if not exists 'debit_card';

alter table public.customers
  add column birth_date date;

alter table public.cash_entries
  add column payment_method public.payment_method,
  add column is_paid boolean not null default true,
  add column due_date date,
  add column paid_at timestamptz,
  add column installment_group_id uuid,
  add column installment_number smallint check (installment_number is null or installment_number > 0),
  add column installment_count smallint check (installment_count is null or installment_count > 0),
  add column installment_frequency text check (installment_frequency is null or installment_frequency in ('weekly', 'biweekly', 'monthly'));

update public.cash_entries
set paid_at = occurred_on::timestamp at time zone 'America/Sao_Paulo',
    due_date = occurred_on
where paid_at is null;

create index cash_entries_owner_unpaid_due_idx
  on public.cash_entries (owner_id, due_date)
  where is_paid = false and voided_at is null;
