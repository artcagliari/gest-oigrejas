create table if not exists public.church_registration_links (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists church_registration_links_one_active_idx
  on public.church_registration_links (church_id) where active;

alter table public.church_registration_links enable row level security;

drop policy if exists "church staff reads registration links" on public.church_registration_links;
create policy "church staff reads registration links"
  on public.church_registration_links for select
  using (public.has_church_role(church_id, array['super','people']::public.platform_role[]));

drop policy if exists "church staff manages registration links" on public.church_registration_links;
create policy "church staff manages registration links"
  on public.church_registration_links for all
  using (public.has_church_role(church_id, array['super','people']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));

create or replace function public.get_or_create_church_registration_link(target_church uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_token uuid;
begin
  if not public.has_church_role(target_church, array['super','people']::public.platform_role[]) then
    raise exception using errcode = '42501', message = 'Sem permissão para gerar o link desta igreja.';
  end if;

  update public.church_registration_links
  set active = false
  where church_id = target_church and active and expires_at is not null and expires_at <= now();

  select token into result_token
  from public.church_registration_links
  where church_id = target_church and active
  order by created_at desc
  limit 1;

  if result_token is null then
    insert into public.church_registration_links (church_id, expires_at, created_by)
    values (target_church, now() + interval '90 days', auth.uid())
    returning token into result_token;
  end if;

  return result_token;
end;
$$;

create or replace function public.get_church_registration_by_token(registration_token uuid)
returns table (church_id uuid, church_name text, active boolean, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select link.church_id, church.name, link.active, link.expires_at
  from public.church_registration_links link
  join public.churches church on church.id = link.church_id
  where link.token = registration_token
    and link.active
    and church.active
    and (link.expires_at is null or link.expires_at > now())
  limit 1
$$;

create or replace function public.submit_church_self_registration(
  registration_token uuid,
  registration_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_church uuid;
  person_id uuid;
  person_name text := trim(coalesce(registration_data->>'full_name', ''));
  person_email text := lower(nullif(trim(coalesce(registration_data->>'email', '')), ''));
  person_phone text := nullif(trim(coalesce(registration_data->>'phone_primary', '')), '');
  normalized_phone text := regexp_replace(coalesce(registration_data->>'phone_primary', ''), '[^0-9]', '', 'g');
  person_address jsonb := coalesce(registration_data->'address', '{}'::jsonb);
begin
  select link.church_id into target_church
  from public.church_registration_links link
  join public.churches church on church.id = link.church_id and church.active
  where link.token = registration_token
    and link.active
    and (link.expires_at is null or link.expires_at > now());

  if target_church is null then
    raise exception using errcode = '22023', message = 'Link de cadastro inválido ou expirado.';
  end if;
  if char_length(person_name) < 3 or char_length(person_name) > 160 then
    raise exception using errcode = '22023', message = 'Informe o nome completo.';
  end if;
  if coalesce((registration_data->>'data_processing_consent')::boolean, false) is not true then
    raise exception using errcode = '22023', message = 'O consentimento para tratamento de dados é obrigatório.';
  end if;
  if person_email is null and char_length(normalized_phone) < 8 then
    raise exception using errcode = '22023', message = 'Informe um e-mail ou telefone válido.';
  end if;
  if person_email is not null and person_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception using errcode = '22023', message = 'Informe um e-mail válido.';
  end if;

  if exists (
    select 1 from public.people person
    where person.church_id = target_church
      and (
        (person_email is not null and lower(person.email) = person_email)
        or
        (char_length(normalized_phone) >= 8 and regexp_replace(coalesce(person.phone_primary, ''), '[^0-9]', '', 'g') = normalized_phone)
      )
  ) then
    raise exception using errcode = '23505', message = 'Já existe uma pessoa com este e-mail ou telefone nesta igreja.';
  end if;

  insert into public.people (
    church_id, full_name, birth_date, gender, marital_status,
    conversion_date, baptized, email, phone_primary, phone_secondary, address,
    categories, ministry_roles, notes, active
  ) values (
    target_church,
    person_name,
    nullif(registration_data->>'birth_date', '')::date,
    nullif(trim(coalesce(registration_data->>'gender', '')), ''),
    nullif(trim(coalesce(registration_data->>'marital_status', '')), ''),
    nullif(registration_data->>'conversion_date', '')::date,
    case when registration_data ? 'baptized' then (registration_data->>'baptized')::boolean else null end,
    person_email,
    person_phone,
    nullif(trim(coalesce(registration_data->>'phone_secondary', '')), ''),
    jsonb_build_object(
      'street', nullif(trim(coalesce(person_address->>'street', '')), ''),
      'number', nullif(trim(coalesce(person_address->>'number', '')), ''),
      'district', nullif(trim(coalesce(person_address->>'district', '')), ''),
      'complement', nullif(trim(coalesce(person_address->>'complement', '')), ''),
      'zip', nullif(trim(coalesce(person_address->>'zip', '')), ''),
      'city', nullif(trim(coalesce(person_address->>'city', '')), ''),
      'state', nullif(trim(coalesce(person_address->>'state', '')), ''),
      'country', coalesce(nullif(trim(coalesce(person_address->>'country', '')), ''), 'Brasil')
    ),
    array['Pré-cadastro'],
    '{}'::text[],
    'Cadastro realizado pelo link público da igreja.',
    true
  ) returning id into person_id;

  insert into public.people_consents (
    person_id, church_id, messaging, data_processing, consented_at
  ) values (
    person_id,
    target_church,
    coalesce((registration_data->>'messaging_consent')::boolean, false),
    true,
    now()
  );

  return person_id;
end;
$$;

revoke all on function public.get_or_create_church_registration_link(uuid) from public, anon;
grant execute on function public.get_or_create_church_registration_link(uuid) to authenticated;

revoke all on function public.get_church_registration_by_token(uuid) from public;
grant execute on function public.get_church_registration_by_token(uuid) to anon, authenticated;

revoke all on function public.submit_church_self_registration(uuid, jsonb) from public;
grant execute on function public.submit_church_self_registration(uuid, jsonb) to anon, authenticated;
