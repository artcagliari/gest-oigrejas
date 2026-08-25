-- O pré-cadastro público passa a criar, em uma única transação, o responsável,
-- as pessoas menores de idade, seus perfis Kids e os vínculos familiares.

create table if not exists public.child_profiles (
  person_id uuid primary key references public.people(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  allergies text,
  medical_notes text,
  special_needs text,
  emergency_contact_name text,
  emergency_contact_phone text,
  authorized_pickup_people jsonb not null default '[]'::jsonb,
  pickup_code_required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_guardians (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  child_id uuid not null references public.child_profiles(person_id) on delete cascade,
  guardian_person_id uuid not null references public.people(id) on delete cascade,
  relationship text not null,
  legal_guardian boolean not null default false,
  primary_contact boolean not null default false,
  can_pickup boolean not null default true,
  created_at timestamptz not null default now(),
  unique (child_id, guardian_person_id)
);

alter table public.child_profiles enable row level security;
alter table public.child_guardians enable row level security;

drop policy if exists "read kids" on public.child_profiles;
create policy "read kids" on public.child_profiles for select
  using (public.has_church_access(church_id));
drop policy if exists "manage kids" on public.child_profiles;
create policy "manage kids" on public.child_profiles for all
  using (public.has_church_role(church_id, array['super','people']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));

drop policy if exists "read guardians" on public.child_guardians;
create policy "read guardians" on public.child_guardians for select
  using (public.has_church_access(church_id));
drop policy if exists "manage guardians" on public.child_guardians;
create policy "manage guardians" on public.child_guardians for all
  using (public.has_church_role(church_id, array['super','people']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));

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
  parent_id uuid;
  child_id uuid;
  child_record jsonb;
  child_name text;
  child_cpf text;
  child_birth_date date;
  parent_name text := trim(coalesce(registration_data->>'full_name', ''));
  parent_email text := lower(nullif(trim(coalesce(registration_data->>'email', '')), ''));
  parent_phone text := nullif(trim(coalesce(registration_data->>'phone_primary', '')), '');
  normalized_phone text := regexp_replace(coalesce(registration_data->>'phone_primary', ''), '[^0-9]', '', 'g');
  normalized_cpf text := regexp_replace(coalesce(registration_data->>'document_cpf', ''), '[^0-9]', '', 'g');
  parent_address jsonb := coalesce(registration_data->'address', '{}'::jsonb);
  sanitized_address jsonb;
  person_categories text[];
  children_names text[] := '{}';
  parent_marital_status text := trim(coalesce(registration_data->>'marital_status', ''));
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
  if char_length(parent_name) < 3 or char_length(parent_name) > 160 then
    raise exception using errcode = '22023', message = 'Informe o nome completo.';
  end if;
  if coalesce((registration_data->>'data_processing_consent')::boolean, false) is not true then
    raise exception using errcode = '22023', message = 'O consentimento para tratamento de dados é obrigatório.';
  end if;
  if nullif(registration_data->>'birth_date', '') is null
    or coalesce(registration_data->>'gender', '') not in ('Homem', 'Mulher', 'Prefiro não informar')
    or trim(coalesce(registration_data->>'education', '')) = ''
    or parent_marital_status = '' then
    raise exception using errcode = '22023', message = 'Preencha todos os dados pessoais obrigatórios.';
  end if;
  if parent_marital_status in ('Casado(a)', 'União estável')
    and trim(coalesce(registration_data->>'spouse_name', '')) = '' then
    raise exception using errcode = '22023', message = 'Informe o nome do cônjuge.';
  end if;
  if char_length(normalized_cpf) <> 11 then
    raise exception using errcode = '22023', message = 'Informe um CPF com 11 dígitos.';
  end if;
  if char_length(normalized_phone) < 10 or parent_email is null then
    raise exception using errcode = '22023', message = 'Informe telefone WhatsApp e e-mail.';
  end if;
  if parent_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception using errcode = '22023', message = 'Informe um e-mail válido.';
  end if;
  if trim(coalesce(parent_address->>'street', '')) = ''
    or trim(coalesce(parent_address->>'number', '')) = ''
    or trim(coalesce(parent_address->>'district', '')) = ''
    or trim(coalesce(parent_address->>'complement', '')) = ''
    or trim(coalesce(parent_address->>'zip', '')) = ''
    or trim(coalesce(parent_address->>'city', '')) = ''
    or trim(coalesce(parent_address->>'state', '')) = ''
    or trim(coalesce(parent_address->>'country', '')) = '' then
    raise exception using errcode = '22023', message = 'Preencha todo o endereço.';
  end if;

  sanitized_address := jsonb_build_object(
    'street', trim(parent_address->>'street'),
    'number', trim(parent_address->>'number'),
    'district', trim(parent_address->>'district'),
    'complement', trim(parent_address->>'complement'),
    'zip', trim(parent_address->>'zip'),
    'city', trim(parent_address->>'city'),
    'state', trim(parent_address->>'state'),
    'country', trim(parent_address->>'country')
  );

  if jsonb_typeof(registration_data->'categories') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Assinale Membro, Visitante, Adolescente ou Criança.';
  end if;
  select array_agg(distinct category)
  into person_categories
  from jsonb_array_elements_text(registration_data->'categories') category
  where category in ('Membro', 'Visitante', 'Adolescente', 'Criança');
  if coalesce(cardinality(person_categories), 0) = 0 then
    raise exception using errcode = '22023', message = 'Assinale Membro, Visitante, Adolescente ou Criança.';
  end if;
  if jsonb_typeof(registration_data->'children') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Informe se possui filhos.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(registration_data->'children') child
    group by regexp_replace(coalesce(child->>'document_cpf', ''), '[^0-9]', '', 'g')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'Cada criança precisa ter um CPF diferente.';
  end if;

  if exists (
    select 1 from public.people person
    where person.church_id = target_church
      and (lower(person.email) = parent_email
        or regexp_replace(coalesce(person.phone_primary, ''), '[^0-9]', '', 'g') = normalized_phone
        or regexp_replace(coalesce(person.document_cpf, ''), '[^0-9]', '', 'g') = normalized_cpf)
  ) then
    raise exception using errcode = '23505', message = 'Já existe uma pessoa com este CPF, e-mail ou telefone nesta igreja.';
  end if;

  for child_record in select value from jsonb_array_elements(registration_data->'children') loop
    child_name := trim(coalesce(child_record->>'full_name', ''));
    child_cpf := regexp_replace(coalesce(child_record->>'document_cpf', ''), '[^0-9]', '', 'g');
    begin
      child_birth_date := nullif(child_record->>'birth_date', '')::date;
    exception when others then
      raise exception using errcode = '22023', message = 'Informe uma data de nascimento válida para cada criança.';
    end;
    if char_length(child_name) < 3 or char_length(child_name) > 160
      or char_length(child_cpf) <> 11
      or child_birth_date is null
      or child_birth_date > current_date
      or child_birth_date <= (current_date - interval '18 years')::date then
      raise exception using errcode = '22023', message = 'Preencha nome, nascimento de menor de 18 anos e CPF de cada criança.';
    end if;
    if child_cpf = normalized_cpf
      or exists (
        select 1 from public.people person
        where person.church_id = target_church
          and regexp_replace(coalesce(person.document_cpf, ''), '[^0-9]', '', 'g') = child_cpf
      ) then
      raise exception using errcode = '23505', message = 'O CPF do responsável e de cada criança deve ser único.';
    end if;
    children_names := array_append(children_names, child_name);
  end loop;

  insert into public.people (
    church_id, full_name, birth_date, gender, education, marital_status,
    spouse_name, children_names, conversion_date, baptism_date, baptized,
    document_cpf, email, phone_primary, phone_secondary, address, categories,
    ministry_roles, notes, active
  ) values (
    target_church, parent_name, (registration_data->>'birth_date')::date,
    registration_data->>'gender', trim(registration_data->>'education'),
    parent_marital_status, nullif(trim(coalesce(registration_data->>'spouse_name', '')), ''),
    children_names, nullif(registration_data->>'conversion_date', '')::date,
    nullif(registration_data->>'baptism_date', '')::date,
    nullif(registration_data->>'baptism_date', '') is not null,
    nullif(trim(registration_data->>'document_cpf'), ''), parent_email,
    parent_phone, nullif(trim(coalesce(registration_data->>'phone_secondary', '')), ''),
    sanitized_address, array_prepend('Pré-cadastro', person_categories), '{}',
    'Cadastro realizado pelo link público da igreja.', true
  ) returning id into parent_id;

  insert into public.people_consents (
    person_id, church_id, messaging, data_processing, consented_at
  ) values (
    parent_id, target_church,
    coalesce((registration_data->>'messaging_consent')::boolean, false), true, now()
  );

  for child_record in select value from jsonb_array_elements(registration_data->'children') loop
    child_name := trim(child_record->>'full_name');
    child_cpf := regexp_replace(child_record->>'document_cpf', '[^0-9]', '', 'g');
    child_birth_date := (child_record->>'birth_date')::date;

    insert into public.people (
      church_id, full_name, birth_date, children_names, document_cpf,
      address, categories, ministry_roles, notes, active
    ) values (
      target_church, child_name, child_birth_date, '{}', child_cpf,
      sanitized_address, array['Pré-cadastro', 'Criança'], '{}',
      'Cadastro criado junto com o responsável pelo link público.', true
    ) returning id into child_id;

    insert into public.people_consents (
      person_id, church_id, data_processing, consented_at
    ) values (child_id, target_church, true, now());

    insert into public.child_profiles (
      person_id, church_id, emergency_contact_name, emergency_contact_phone,
      authorized_pickup_people, pickup_code_required, active
    ) values (
      child_id, target_church, parent_name, parent_phone,
      jsonb_build_array(jsonb_build_object(
        'name', parent_name,
        'document', nullif(trim(registration_data->>'document_cpf'), '')
      )),
      true, true
    );

    insert into public.child_guardians (
      church_id, child_id, guardian_person_id, relationship,
      legal_guardian, primary_contact, can_pickup
    ) values (
      target_church, child_id, parent_id, 'Pai, mãe ou responsável',
      true, true, true
    );
  end loop;

  return parent_id;
end;
$$;

revoke all on function public.submit_church_self_registration(uuid, jsonb) from public;
grant execute on function public.submit_church_self_registration(uuid, jsonb) to anon, authenticated;
