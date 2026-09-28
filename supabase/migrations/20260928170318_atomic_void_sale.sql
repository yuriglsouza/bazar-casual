create or replace function public.void_sale(sale_id_input uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  voided_time timestamptz := now();
begin
  if owner is null then
    raise exception 'Sessão expirada';
  end if;

  perform 1
  from public.sales
  where id = sale_id_input
    and owner_id = owner
    and voided_at is null
  for update;

  if not found then
    raise exception 'Venda não encontrada';
  end if;

  update public.payments
  set voided_at = coalesce(voided_at, voided_time)
  where owner_id = owner
    and installment_id in (
      select id from public.installments
      where sale_id = sale_id_input and owner_id = owner
    );

  update public.installments
  set voided_at = coalesce(voided_at, voided_time)
  where sale_id = sale_id_input and owner_id = owner;

  update public.sales
  set voided_at = voided_time
  where id = sale_id_input and owner_id = owner;
end;
$$;

revoke all on function public.void_sale(uuid) from public, anon;
grant execute on function public.void_sale(uuid) to authenticated;
