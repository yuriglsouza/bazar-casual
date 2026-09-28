alter table public.customers add column order_notes text not null default '' check (length(order_notes) <= 20000);
