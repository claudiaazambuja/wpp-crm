-- ZapFlow v1. Run once in the Supabase SQL Editor. Legacy tables are preserved.
begin;

create table public.professionals (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  whatsapp_number text not null unique check (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.professionals(id),
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  whatsapp_number text not null check (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, whatsapp_number),
  unique (professional_id, id)
);

create table public.client_anamneses (
  client_id uuid primary key,
  professional_id uuid not null default auth.uid(),
  skin_type text,
  allergies text,
  medications text,
  care_restrictions text,
  notes text,
  updated_at timestamptz not null default now(),
  foreign key (professional_id, client_id) references public.clients(professional_id, id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid(),
  client_id uuid not null,
  service_description text not null default '' check (length(service_description) <= 2000),
  appointment_date date not null,
  follow_up_interval_days integer not null check (follow_up_interval_days between 1 and 3650),
  created_at timestamptz not null default now(),
  foreign key (professional_id, client_id) references public.clients(professional_id, id),
  unique (professional_id, client_id, id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid(),
  client_id uuid not null,
  appointment_id uuid not null unique,
  body text not null check (length(btrim(body)) between 1 and 4000),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  sent_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (professional_id, client_id, appointment_id) references public.appointments(professional_id, client_id, id),
  check ((status = 'sent') = (sent_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null))
);
create unique index one_pending_message_per_client on public.messages(professional_id, client_id) where status = 'pending';
create index messages_queue on public.messages(professional_id, status, scheduled_at);
create index appointments_timeline on public.appointments(professional_id, client_id, appointment_date desc);
create index anamneses_owner on public.client_anamneses(professional_id);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger professionals_updated before update on public.professionals for each row execute function public.touch_updated_at();
create trigger clients_updated before update on public.clients for each row execute function public.touch_updated_at();
create trigger anamneses_updated before update on public.client_anamneses for each row execute function public.touch_updated_at();
create trigger messages_updated before update on public.messages for each row execute function public.touch_updated_at();

alter table public.professionals enable row level security;
alter table public.clients enable row level security;
alter table public.client_anamneses enable row level security;
alter table public.appointments enable row level security;
alter table public.messages enable row level security;
create policy professionals_own on public.professionals for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy clients_own on public.clients for all to authenticated using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));
create policy anamneses_own on public.client_anamneses for all to authenticated using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));
create policy appointments_read on public.appointments for select to authenticated using (professional_id = (select auth.uid()));
create policy messages_read on public.messages for select to authenticated using (professional_id = (select auth.uid()));

revoke all on public.professionals, public.clients, public.client_anamneses, public.appointments, public.messages from anon, authenticated;
grant select, insert, update on public.professionals, public.clients, public.client_anamneses to authenticated;
grant select on public.appointments, public.messages to authenticated;

-- Writes to the timeline and queue are transactional; clients cannot bypass the rules.
create function public.record_appointment(p_client_id uuid, p_service_description text, p_appointment_date date, p_interval_days integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_client public.clients; v_id uuid; v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  select * into v_client from public.clients where id = p_client_id and professional_id = v_owner and archived_at is null for update;
  if not found then raise exception 'Client not available'; end if;
  if p_appointment_date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Appointment cannot be in the future'; end if;
  insert into public.appointments(professional_id, client_id, service_description, appointment_date, follow_up_interval_days)
  values (v_owner, p_client_id, coalesce(p_service_description, ''), p_appointment_date, p_interval_days) returning id into v_id;
  update public.messages set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'replaced_by_appointment'
  where professional_id = v_owner and client_id = p_client_id and status = 'pending';
  insert into public.messages(professional_id, client_id, appointment_id, body, scheduled_at)
  values (v_owner, p_client_id, v_id,
    'Olá, ' || v_client.full_name || '! Como você está após o nosso atendimento? Estou por aqui se precisar de alguma orientação.',
    ((p_appointment_date + p_interval_days) + time '09:00') at time zone 'America/Sao_Paulo');
  return v_id;
end;
$$;

create function public.create_client(p_full_name text, p_whatsapp_number text, p_service_description text, p_appointment_date date, p_interval_days integer, p_anamnesis jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  insert into public.clients(professional_id, full_name, whatsapp_number) values (v_owner, btrim(p_full_name), p_whatsapp_number) returning id into v_id;
  insert into public.client_anamneses(client_id, professional_id, skin_type, allergies, medications, care_restrictions, notes)
  values (v_id, v_owner, p_anamnesis->>'skin_type', p_anamnesis->>'allergies', p_anamnesis->>'medications', p_anamnesis->>'care_restrictions', p_anamnesis->>'notes');
  perform public.record_appointment(v_id, p_service_description, p_appointment_date, p_interval_days);
  return v_id;
end;
$$;

create function public.update_pending_message(p_message_id uuid, p_action text, p_body text default null, p_scheduled_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_client_id uuid; v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  select client_id into v_client_id from public.messages where id = p_message_id and professional_id = v_owner;
  if not found then raise exception 'Message not available'; end if;
  -- Same lock order as record_appointment, including concurrent send/replace operations.
  perform 1 from public.clients where id = v_client_id and professional_id = v_owner for update;
  perform 1 from public.messages where id = p_message_id and professional_id = v_owner and status = 'pending' for update;
  if not found then raise exception 'Message is no longer pending'; end if;
  if p_action = 'send' then
    update public.messages set status = 'sent', sent_at = now() where id = p_message_id;
  elsif p_action = 'cancel' then
    update public.messages set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'manual' where id = p_message_id;
  elsif p_action = 'edit' then
    if p_body is null then raise exception 'Message body required'; end if;
    update public.messages set body = p_body where id = p_message_id;
  elsif p_action = 'reschedule' then
    if p_scheduled_at is null or p_scheduled_at <= now() then raise exception 'Choose a future date'; end if;
    update public.messages set scheduled_at = p_scheduled_at where id = p_message_id;
  else raise exception 'Invalid action'; end if;
end;
$$;

revoke all on function public.touch_updated_at() from public;
revoke all on function public.record_appointment(uuid,text,date,integer) from public;
revoke all on function public.create_client(text,text,text,date,integer,jsonb) from public;
revoke all on function public.update_pending_message(uuid,text,text,timestamptz) from public;
grant execute on function public.record_appointment(uuid,text,date,integer) to authenticated;
grant execute on function public.create_client(text,text,text,date,integer,jsonb) to authenticated;
grant execute on function public.update_pending_message(uuid,text,text,timestamptz) to authenticated;
commit;
