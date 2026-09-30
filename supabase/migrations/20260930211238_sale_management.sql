-- Edit active sales atomically, preserving receipts and checking the edit version.
create or replace function public.edit_sale(sale_id_input uuid, description_input text, sold_on_input date, version_input timestamptz, parts_input jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare sale public.sales; part public.installments; item jsonb; paid bigint; total bigint:=0; amount bigint;
begin
  select * into sale from public.sales where id=sale_id_input and owner_id=auth.uid() and voided_at is null for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  if sale.updated_at is distinct from version_input then raise exception 'Esta venda mudou. Feche e abra a edição novamente.'; end if;
  if sold_on_input is null or coalesce(length(trim(description_input)),0)=0 then raise exception 'Confira descrição e data'; end if;
  if parts_input is null or jsonb_typeof(parts_input)<>'array' then raise exception 'Confira as parcelas'; end if;
  if jsonb_array_length(parts_input)=0 or jsonb_array_length(parts_input)<>(select count(*) from public.installments where sale_id=sale.id and voided_at is null) then raise exception 'Confira as parcelas'; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(parts_input) x)<>jsonb_array_length(parts_input) then raise exception 'Parcelas repetidas'; end if;
  perform 1 from public.installments where sale_id=sale.id and voided_at is null order by id for update;
  for item in select * from jsonb_array_elements(parts_input) loop
    select * into part from public.installments where id=(item->>'id')::uuid and sale_id=sale.id and owner_id=auth.uid() and voided_at is null;
    if not found then raise exception 'Parcela inválida'; end if;
    amount:=(item->>'amount_cents')::bigint;
    select coalesce(sum(amount_cents),0) into paid from public.payments where installment_id=part.id and voided_at is null;
    if amount is null or amount<=0 or amount<paid or (item->>'due_date') is null then raise exception 'A parcela não pode ser menor que o valor já recebido'; end if;
    update public.installments set amount_cents=amount,due_date=(item->>'due_date')::date where id=part.id;
    total:=total+amount;
  end loop;
  update public.sales set description=trim(description_input),sold_on=sold_on_input,total_cents=total,
    mode=case when mode='paid_now' and total>(select coalesce(sum(p.amount_cents),0) from public.payments p join public.installments i on i.id=p.installment_id where i.sale_id=sale.id and p.voided_at is null) then 'credit'::public.sale_mode else mode end
    where id=sale.id;
end $$;
revoke all on function public.edit_sale(uuid,text,date,timestamptz,jsonb) from public,anon;
grant execute on function public.edit_sale(uuid,text,date,timestamptz,jsonb) to authenticated;
