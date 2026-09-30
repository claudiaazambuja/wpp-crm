begin;

create table public.follow_up_templates (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.professionals(id),
  title text not null check (length(btrim(title)) between 1 and 100),
  body text not null check (length(btrim(body)) between 1 and 3000),
  days integer[] not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.follow_up_templates enable row level security;
revoke all on public.follow_up_templates from public, anon, authenticated;
grant select on public.follow_up_templates to authenticated;
create policy templates_read on public.follow_up_templates for select to authenticated
using (professional_id = (select auth.uid()) and (select public.account_ready()));
create trigger templates_updated before update on public.follow_up_templates
for each row execute function public.touch_updated_at();

create function public.save_follow_up_template(p_title text,p_body text,p_days integer[],p_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(p_id,gen_random_uuid()); v_owner uuid := auth.uid();
begin
  if not public.account_ready() then raise exception 'Initial password required'; end if;
  perform 1 from public.professionals where id = v_owner for update;
  if not found then raise exception 'Configure seu perfil antes de cadastrar mensagens.'; end if;
  if coalesce(cardinality(p_days),0) not between 1 and 30
    or exists(select 1 from unnest(p_days) d where d is null or d not between 1 and 3650)
    or (select count(distinct d) from unnest(p_days) d) <> cardinality(p_days)
    then raise exception 'Escolha de 1 a 30 dias diferentes, entre 1 e 3650.'; end if;
  if p_id is not null and not exists(select 1 from public.follow_up_templates where id = p_id and professional_id = v_owner)
    then raise exception 'Modelo não disponível.'; end if;
  if exists(select 1 from public.follow_up_templates where professional_id = v_owner and id <> v_id and archived_at is null and days && p_days)
    then raise exception 'Um desses dias já está em outro modelo. Edite o modelo existente ou escolha outro dia.'; end if;
  insert into public.follow_up_templates(id,professional_id,title,body,days)
  values(v_id,v_owner,btrim(p_title),btrim(p_body),array(select d from unnest(p_days) d order by d))
  on conflict(id) do update set title=excluded.title,body=excluded.body,days=excluded.days,archived_at=null;
  return v_id;
end; $$;

create function public.archive_follow_up_template(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_ready() then raise exception 'Initial password required'; end if;
  perform 1 from public.professionals where id=auth.uid() for update;
  update public.follow_up_templates set archived_at=now() where id=p_id and professional_id=auth.uid();
  if not found then raise exception 'Modelo não disponível.'; end if;
end; $$;

-- Keep every existing message and its status; only relax the former one-message model.
alter table public.messages add column follow_up_day integer;
alter table public.messages add column template_title text not null default 'Acompanhamento';
update public.messages m set follow_up_day=a.follow_up_interval_days from public.appointments a where a.id=m.appointment_id;
alter table public.messages alter column follow_up_day set not null;
alter table public.messages add constraint messages_follow_up_day_check check(follow_up_day between 1 and 3650);
alter table public.messages drop constraint messages_appointment_id_key;
drop index public.one_pending_message_per_client;
create unique index one_message_per_appointment_day on public.messages(appointment_id,follow_up_day);
create unique index one_pending_message_per_client_day on public.messages(professional_id,client_id,follow_up_day) where status='pending';
alter table public.appointments add column request_id uuid;
create unique index appointments_request on public.appointments(professional_id,request_id) where request_id is not null;

create function private.record_follow_up(p_client_id uuid,p_service_description text,p_appointment_date date,p_schedule jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_client public.clients; v_id uuid; v_existing_client uuid; v_owner uuid:=auth.uid(); v_step jsonb; v_days integer[] := '{}'; v_day integer; v_body text;
begin
  if not public.account_ready() then raise exception 'Initial password required'; end if;
  select * into v_client from public.clients where id=p_client_id and professional_id=v_owner and archived_at is null for update;
  if not found then raise exception 'Client not available'; end if;
  if p_request_id is not null then
    select id,client_id into v_id,v_existing_client from public.appointments where professional_id=v_owner and request_id=p_request_id;
    if found then
      if v_existing_client <> p_client_id then raise exception 'Solicitação já utilizada para outro cliente.'; end if;
      return v_id;
    end if;
  end if;
  if p_appointment_date is null or p_appointment_date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Appointment cannot be in the future'; end if;
  if p_schedule is null or jsonb_typeof(p_schedule) <> 'array' then raise exception 'Selecione os dias de acompanhamento.'; end if;
  if jsonb_array_length(p_schedule) not between 1 and 30 then raise exception 'Selecione de 1 a 30 contatos.'; end if;
  for v_step in select value from jsonb_array_elements(p_schedule) loop
    if coalesce(v_step->>'day','') !~ '^[0-9]{1,4}$' then raise exception 'Dia inválido.'; end if;
    v_day := (v_step->>'day')::integer;
    if v_day not between 1 and 3650 or v_day=any(v_days) then raise exception 'Os dias devem ser diferentes e estar entre 1 e 3650.'; end if;
    if coalesce(length(btrim(v_step->>'body')),0) not between 1 and 3000 or coalesce(length(btrim(v_step->>'title')),0) not between 1 and 100
      then raise exception 'Preencha o nome e o texto de cada mensagem.'; end if;
    v_days := array_append(v_days,v_day);
  end loop;
  insert into public.appointments(professional_id,client_id,service_description,appointment_date,follow_up_interval_days,request_id)
  values(v_owner,p_client_id,coalesce(p_service_description,''),p_appointment_date,(select max(d) from unnest(v_days) d),p_request_id) returning id into v_id;
  update public.messages set status='cancelled',cancelled_at=now(),cancellation_reason='replaced_by_appointment'
  where professional_id=v_owner and client_id=p_client_id and status='pending';
  for v_step in select value from jsonb_array_elements(p_schedule) loop
    v_day := (v_step->>'day')::integer;
    v_body := replace(replace(btrim(v_step->>'body'),'{nome}',v_client.full_name),'{servico}',coalesce(nullif(p_service_description,''),'atendimento'));
    if length(v_body)>4000 then raise exception 'Mensagem muito longa após preencher nome e serviço.'; end if;
    insert into public.messages(professional_id,client_id,appointment_id,body,scheduled_at,follow_up_day,template_title)
    values(v_owner,p_client_id,v_id,v_body,((p_appointment_date+v_day)+time '09:00') at time zone 'America/Sao_Paulo',v_day,btrim(v_step->>'title'));
  end loop;
  return v_id;
end; $$;

create function public.record_appointment_sequence(p_client_id uuid,p_service_description text,p_appointment_date date,p_schedule jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if p_request_id is null then raise exception 'Identificador da solicitação obrigatório.'; end if;
  return private.record_follow_up(p_client_id,p_service_description,p_appointment_date,p_schedule,p_request_id);
end; $$;

create function public.create_client_sequence(p_full_name text,p_whatsapp_number text,p_service_description text,p_appointment_date date,p_schedule jsonb,p_request_id uuid,p_anamnesis jsonb default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_owner uuid:=auth.uid();
begin
  if not public.account_ready() then raise exception 'Initial password required'; end if;
  if p_request_id is null then raise exception 'Identificador da solicitação obrigatório.'; end if;
  select client_id into v_id from public.appointments where professional_id=v_owner and request_id=p_request_id;
  if found then return v_id; end if;
  insert into public.clients(professional_id,full_name,whatsapp_number) values(v_owner,btrim(p_full_name),p_whatsapp_number) returning id into v_id;
  insert into public.client_anamneses(client_id,professional_id,skin_type,allergies,medications,care_restrictions,notes)
  values(v_id,v_owner,p_anamnesis->>'skin_type',p_anamnesis->>'allergies',p_anamnesis->>'medications',p_anamnesis->>'care_restrictions',p_anamnesis->>'notes');
  perform private.record_follow_up(v_id,p_service_description,p_appointment_date,p_schedule,p_request_id);
  return v_id;
end; $$;

-- Older open browser tabs may still call the original single-contact RPC.
create or replace function private.record_appointment(p_client_id uuid,p_service_description text,p_appointment_date date,p_interval_days integer)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return private.record_follow_up(p_client_id,p_service_description,p_appointment_date,
    jsonb_build_array(jsonb_build_object('day',p_interval_days,'title','Acompanhamento','body','Olá, {nome}! Como você está após o nosso atendimento? Estou por aqui se precisar de alguma orientação.')),null);
end; $$;

revoke all on function private.record_follow_up(uuid,text,date,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.save_follow_up_template(text,text,integer[],uuid) from public;
revoke all on function public.archive_follow_up_template(uuid) from public;
revoke all on function public.record_appointment_sequence(uuid,text,date,jsonb,uuid) from public;
revoke all on function public.create_client_sequence(text,text,text,date,jsonb,uuid,jsonb) from public;
grant execute on function public.save_follow_up_template(text,text,integer[],uuid) to authenticated;
grant execute on function public.archive_follow_up_template(uuid) to authenticated;
grant execute on function public.record_appointment_sequence(uuid,text,date,jsonb,uuid) to authenticated;
grant execute on function public.create_client_sequence(text,text,text,date,jsonb,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
