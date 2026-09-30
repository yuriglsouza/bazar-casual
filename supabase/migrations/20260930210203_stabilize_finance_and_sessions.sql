-- Public preferences never grant control of provider session identifiers.
revoke insert, update on public.whatsapp_settings from authenticated;
grant insert (owner_id, enabled, overdue_enabled, birthday_enabled, purchase_summary_enabled, overdue_template, birthday_template, purchase_template) on public.whatsapp_settings to authenticated;
grant update (owner_id, enabled, overdue_enabled, birthday_enabled, purchase_summary_enabled, overdue_template, birthday_template, purchase_template) on public.whatsapp_settings to authenticated;
create unique index whatsapp_session_exclusive_idx on public.whatsapp_settings(session_id) where session_id is not null;

-- Atomic creation: all sale records commit together or all roll back.
create or replace function public.create_sale_atomic(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid := auth.uid(); sale public.sales; part public.installments;
  n integer; total bigint; base bigint; first_due date; due date; frequency text;
  sale_mode public.sale_mode; parts jsonb := '[]'::jsonb; request_id uuid;
begin
  if owner is null then raise exception 'Sessão expirada'; end if;
  request_id := (payload->>'request_id')::uuid;
  if request_id is null then raise exception 'Identificador obrigatório'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text || request_id::text, 0));
  select * into sale from public.sales where id=request_id and owner_id=owner;
  if found then
    if sale.voided_at is not null then raise exception 'Esta venda já foi cancelada'; end if;
    return jsonb_build_object('id',sale.id,'replayed',true,'installments','[]'::jsonb);
  end if;
  total := (payload->>'total_cents')::bigint;
  sale_mode := (payload->>'mode')::public.sale_mode;
  n := case when sale_mode='installments' then (payload->>'installment_count')::integer else 1 end;
  first_due := (payload->>'due_date')::date;
  frequency := payload->>'installment_frequency';
  if total is null or n is null or n not between 1 and 12 or total<n or first_due is null or frequency not in ('monthly','biweekly','weekly') then raise exception 'Confira valor e parcelas'; end if;
  insert into public.sales(id,owner_id,customer_id,description,sold_on,total_cents,mode)
    values(request_id,owner,(payload->>'customer_id')::uuid,payload->>'description',(payload->>'sold_on')::date,total,sale_mode) returning * into sale;
  base := total/n;
  for k in 0..n-1 loop
    due := case frequency when 'weekly' then first_due + k*7 when 'biweekly' then first_due + k*15 else (first_due + make_interval(months=>k))::date end;
    insert into public.installments(owner_id,sale_id,installment_number,due_date,amount_cents)
      values(owner,sale.id,k+1,due,base+case when k=n-1 then total-base*n else 0 end) returning * into part;
    parts := parts || jsonb_build_array(jsonb_build_object('id',part.id,'installment_number',part.installment_number,'due_date',part.due_date,'amount_cents',part.amount_cents));
    if sale_mode='paid_now' then perform public.record_payment(part.id,part.amount_cents,((payload->>'sold_on')::date + time '12:00') at time zone 'America/Sao_Paulo',(payload->>'payment_method')::public.payment_method); end if;
  end loop;
  return jsonb_build_object('id',sale.id,'replayed',false,'installments',parts);
end; $$;
revoke all on function public.create_sale_atomic(jsonb) from public, anon;
grant execute on function public.create_sale_atomic(jsonb) to authenticated;

create or replace function public.update_payment_atomic(payment_id uuid, new_amount bigint, new_method public.payment_method, new_date date)
returns void language plpgsql security invoker set search_path = '' as $$
declare target public.payments; installment public.installments; total_paid bigint; sale_id uuid;
begin
  select * into target from public.payments where id=payment_id and owner_id=auth.uid() and voided_at is null;
  if not found then raise exception 'Pagamento não encontrado'; end if;
  select i.sale_id into sale_id from public.installments i where i.id=target.installment_id;
  perform 1 from public.sales where id=sale_id and owner_id=auth.uid() and voided_at is null for update;
  if not found then raise exception 'Venda cancelada'; end if;
  select * into installment from public.installments where id=target.installment_id and owner_id=auth.uid() and voided_at is null for update;
  if not found then raise exception 'Parcela cancelada'; end if;
  select coalesce(sum(amount_cents),0) into total_paid from public.payments where installment_id=installment.id and voided_at is null and id<>payment_id;
  if new_amount is null or new_amount<=0 or new_amount>installment.amount_cents-total_paid or new_date is null then raise exception 'Confira valor e data do pagamento'; end if;
  update public.payments set amount_cents=new_amount, method=new_method, paid_at=(new_date+time '12:00') at time zone 'America/Sao_Paulo'
    where id=payment_id and owner_id=auth.uid() and voided_at is null;
end; $$;
revoke all on function public.update_payment_atomic(uuid,bigint,public.payment_method,date) from public,anon;
grant execute on function public.update_payment_atomic(uuid,bigint,public.payment_method,date) to authenticated;
