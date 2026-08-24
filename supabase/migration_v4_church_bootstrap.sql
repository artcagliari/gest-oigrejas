-- Corrige o bootstrap da primeira igreja sem enfraquecer o RLS.
-- O primeiro usuário autenticado pode criar a primeira igreja e torna-se Master.
-- Depois disso, somente usuários com app_metadata.platform_role = master podem criar igrejas.

create or replace function public.upsert_church_secure(
  church_id uuid,
  church_name text,
  church_document text default null,
  church_email text default null,
  church_phone text default null,
  church_city text default null,
  church_state text default null,
  church_active boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester uuid := auth.uid();
  first_setup boolean;
  requester_email text;
  requester_name text;
begin
  if requester is null then
    raise exception using errcode = '42501', message = 'Faça login para criar uma igreja.';
  end if;

  if length(trim(coalesce(church_name, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Informe o nome da igreja.';
  end if;

  select not exists(select 1 from public.churches) into first_setup;

  if not first_setup and not public.is_platform_master() then
    raise exception using errcode = '42501', message = 'Somente o Master pode criar ou alterar igrejas.';
  end if;

  insert into public.churches (id, name, document, email, phone, address, active)
  values (
    church_id,
    trim(church_name),
    nullif(trim(church_document), ''),
    nullif(trim(church_email), ''),
    nullif(trim(church_phone), ''),
    jsonb_strip_nulls(jsonb_build_object(
      'city', nullif(trim(church_city), ''),
      'state', nullif(trim(church_state), ''),
      'country', 'Brasil'
    )),
    church_active
  )
  on conflict (id) do update set
    name = excluded.name,
    document = excluded.document,
    email = excluded.email,
    phone = excluded.phone,
    address = excluded.address,
    active = excluded.active;

  if first_setup then
    select
      email,
      coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1), 'Administrador')
    into requester_email, requester_name
    from auth.users
    where id = requester;

    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('platform_role', 'master')
    where id = requester;

    insert into public.profiles (id, full_name)
    values (requester, requester_name)
    on conflict (id) do update set full_name = excluded.full_name;

    insert into public.church_memberships (church_id, user_id, role, active)
    values (church_id, requester, 'super', true)
    on conflict (church_id, user_id) do update set role = 'super', active = true;
  end if;

  return church_id;
end;
$$;

revoke all on function public.upsert_church_secure(uuid, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.upsert_church_secure(uuid, text, text, text, text, text, text, boolean) to authenticated;

