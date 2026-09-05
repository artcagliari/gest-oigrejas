-- Todos os campos da ficha de pessoa são opcionais. O banco mantém somente
-- um nome técnico quando o cadastro chega sem nome, pois people.full_name é
-- uma coluna NOT NULL usada nas listagens e vínculos.

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
  registered_person uuid;
  registered_child uuid;
  child_record jsonb;
  child_name text;
  child_birth_date date;
  child_cpf text;
  parent_name text := coalesce(
    nullif(trim(coalesce(registration_data->>'full_name', '')), ''),
    'Sem nome informado'
  );
  parent_email text := lower(nullif(trim(coalesce(registration_data->>'email', '')), ''));
  parent_phone text := nullif(trim(coalesce(registration_data->>'phone_primary', '')), '');
  parent_cpf text := nullif(trim(coalesce(registration_data->>'document_cpf', '')), '');
  parent_address jsonb := coalesce(registration_data->'address', '{}'::jsonb);
  person_categories text[] := '{}';
  children_names text[] := '{}';
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

  if jsonb_typeof(registration_data->'categories') = 'array' then
    select coalesce(array_agg(distinct category), '{}')
    into person_categories
    from jsonb_array_elements_text(registration_data->'categories') category
    where category in ('Membro', 'Visitante', 'Adolescente', 'Criança');
  end if;

  if parent_email is not null and exists (
    select 1 from public.people person
    where person.church_id = target_church and lower(person.email) = parent_email
  ) then
    raise exception using errcode = '23505', message = 'Já existe uma pessoa com este e-mail nesta igreja.';
  end if;
  if parent_phone is not null and exists (
    select 1 from public.people person
    where person.church_id = target_church
      and regexp_replace(coalesce(person.phone_primary, ''), '[^0-9]', '', 'g') =
          regexp_replace(parent_phone, '[^0-9]', '', 'g')
  ) then
    raise exception using errcode = '23505', message = 'Já existe uma pessoa com este telefone nesta igreja.';
  end if;
  if parent_cpf is not null and exists (
    select 1 from public.people person
    where person.church_id = target_church
      and regexp_replace(coalesce(person.document_cpf, ''), '[^0-9]', '', 'g') =
          regexp_replace(parent_cpf, '[^0-9]', '', 'g')
  ) then
    raise exception using errcode = '23505', message = 'Já existe uma pessoa com este CPF nesta igreja.';
  end if;

  for child_record in
    select value
    from jsonb_array_elements(coalesce(registration_data->'children', '[]'::jsonb))
  loop
    if trim(coalesce(child_record->>'full_name', '')) <> ''
      or trim(coalesce(child_record->>'birth_date', '')) <> ''
      or trim(coalesce(child_record->>'document_cpf', '')) <> ''
      or trim(coalesce(child_record->>'gender', '')) <> '' then
      children_names := array_append(
        children_names,
        coalesce(nullif(trim(child_record->>'full_name'), ''), 'Sem nome informado')
      );
    end if;
  end loop;

  insert into public.people (
    church_id, full_name, birth_date, gender, education, marital_status,
    spouse_name, children_names, baptized, baptism_date, document_cpf,
    email, phone_primary, phone_secondary, address, categories,
    ministry_roles, notes, active
  ) values (
    target_church,
    parent_name,
    nullif(registration_data->>'birth_date', '')::date,
    nullif(registration_data->>'gender', ''),
    nullif(trim(coalesce(registration_data->>'education', '')), ''),
    nullif(trim(coalesce(registration_data->>'marital_status', '')), ''),
    nullif(trim(coalesce(registration_data->>'spouse_name', '')), ''),
    children_names,
    case when registration_data ? 'baptized'
      then (registration_data->>'baptized')::boolean else null end,
    case when coalesce((registration_data->>'baptized')::boolean, false)
      then nullif(registration_data->>'baptism_date', '')::date else null end,
    parent_cpf,
    parent_email,
    parent_phone,
    nullif(trim(coalesce(registration_data->>'phone_secondary', '')), ''),
    parent_address,
    array_prepend('Pré-cadastro', person_categories),
    '{}',
    'Cadastro realizado pelo link público da igreja.',
    true
  ) returning id into registered_person;

  insert into public.people_consents (person_id, church_id)
  values (registered_person, target_church);

  for child_record in
    select value
    from jsonb_array_elements(coalesce(registration_data->'children', '[]'::jsonb))
  loop
    if trim(coalesce(child_record->>'full_name', '')) = ''
      and trim(coalesce(child_record->>'birth_date', '')) = ''
      and trim(coalesce(child_record->>'document_cpf', '')) = ''
      and trim(coalesce(child_record->>'gender', '')) = '' then
      continue;
    end if;

    child_name := coalesce(
      nullif(trim(coalesce(child_record->>'full_name', '')), ''),
      'Sem nome informado'
    );
    child_birth_date := nullif(child_record->>'birth_date', '')::date;
    child_cpf := nullif(trim(coalesce(child_record->>'document_cpf', '')), '');

    insert into public.people (
      church_id, full_name, birth_date, gender, document_cpf, address,
      categories, ministry_roles, notes, active
    ) values (
      target_church, child_name, child_birth_date,
      nullif(child_record->>'gender', ''), child_cpf, parent_address,
      array['Pré-cadastro', 'Criança'], '{}',
      'Cadastro criado junto com o responsável pelo link público.', true
    ) returning id into registered_child;

    insert into public.people_consents (person_id, church_id)
    values (registered_child, target_church);

    insert into public.child_profiles (
      person_id, church_id, emergency_contact_name, emergency_contact_phone,
      authorized_pickup_people, pickup_code_required, active
    ) values (
      registered_child, target_church, parent_name, parent_phone,
      jsonb_build_array(jsonb_build_object('name', parent_name, 'document', parent_cpf)),
      true, true
    );

    insert into public.child_guardians (
      church_id, child_id, guardian_person_id, relationship,
      legal_guardian, primary_contact, can_pickup
    ) values (
      target_church, registered_child, registered_person,
      'Pai, mãe ou responsável', true, true, true
    );
  end loop;

  return registered_person;
end;
$$;

revoke all on function public.submit_church_self_registration(uuid, jsonb) from public;
grant execute on function public.submit_church_self_registration(uuid, jsonb)
  to anon, authenticated;
