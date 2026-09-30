begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.account_invitations (
  email text primary key check (email = lower(btrim(email))),
  invited_by uuid not null references auth.users(id),
  user_id uuid references auth.users(id),
  status text not null check (status in ('processing','sent','failed','setup_failed')),
  created_at timestamptz not null default now()
);
alter table public.account_invitations enable row level security;
revoke all on public.account_invitations from public, anon, authenticated;
grant select, insert, update on public.account_invitations to service_role;

create function private.require_initial_password() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"must_change_password":true}'::jsonb;
  return new;
end;
$$;
create trigger proxima_initial_password before insert on auth.users
for each row execute function private.require_initial_password();

update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"must_change_password":true}'::jsonb
where raw_app_meta_data->>'must_change_password' is null;

create function public.account_ready() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = auth.uid()
    and raw_app_meta_data->>'must_change_password' = 'false');
$$;
revoke all on function public.account_ready() from public;
grant execute on function public.account_ready() to authenticated;

create policy password_ready on public.professionals as restrictive for all to authenticated
using ((select public.account_ready())) with check ((select public.account_ready()));
create policy password_ready on public.clients as restrictive for all to authenticated
using ((select public.account_ready())) with check ((select public.account_ready()));
create policy password_ready on public.client_anamneses as restrictive for all to authenticated
using ((select public.account_ready())) with check ((select public.account_ready()));
create policy password_ready on public.appointments as restrictive for all to authenticated
using ((select public.account_ready()));
create policy password_ready on public.messages as restrictive for all to authenticated
using ((select public.account_ready()));

-- Preserve the existing transactional implementations behind guarded entry points.
alter function public.record_appointment(uuid,text,date,integer) set schema private;
alter function public.create_client(text,text,text,date,integer,jsonb) set schema private;
alter function public.update_pending_message(uuid,text,text,timestamptz) set schema private;
revoke all on function private.record_appointment(uuid,text,date,integer) from authenticated, anon, public;
revoke all on function private.create_client(text,text,text,date,integer,jsonb) from authenticated, anon, public;
revoke all on function private.update_pending_message(uuid,text,text,timestamptz) from authenticated, anon, public;

create function public.record_appointment(p_client_id uuid, p_service_description text, p_appointment_date date, p_interval_days integer)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_ready() then raise exception 'Initial password required'; end if;
  return private.record_appointment(p_client_id,p_service_description,p_appointment_date,p_interval_days);
end; $$;
create function public.create_client(p_full_name text,p_whatsapp_number text,p_service_description text,p_appointment_date date,p_interval_days integer,p_anamnesis jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_ready() then raise exception 'Initial password required'; end if;
  return private.create_client(p_full_name,p_whatsapp_number,p_service_description,p_appointment_date,p_interval_days,p_anamnesis);
end; $$;
create function public.update_pending_message(p_message_id uuid,p_action text,p_body text default null,p_scheduled_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_ready() then raise exception 'Initial password required'; end if;
  perform private.update_pending_message(p_message_id,p_action,p_body,p_scheduled_at);
end; $$;
revoke all on function public.record_appointment(uuid,text,date,integer) from public;
revoke all on function public.create_client(text,text,text,date,integer,jsonb) from public;
revoke all on function public.update_pending_message(uuid,text,text,timestamptz) from public;
grant execute on function public.record_appointment(uuid,text,date,integer) to authenticated;
grant execute on function public.create_client(text,text,text,date,integer,jsonb) to authenticated;
grant execute on function public.update_pending_message(uuid,text,text,timestamptz) to authenticated;
commit;
