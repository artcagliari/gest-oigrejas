-- Filhos maiores de idade informados no cadastro familiar viram apenas
-- pré-cadastro de pessoa. Menores continuam com perfil Kids e responsável.

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
  child_age int;
  child_categories text[];
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
  if normalized_cpf !~ '^[0-9]{11}$' then
    raise exception using errcode = '22023', message = 'Informe um CPF válido.';
  end if;
  if parent_email is null or parent_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = '22023', message = 'Informe um e-mail válido.';
  end if;
  if char_length(normalized_phone) < 10 then
    raise exception using errcode = '22023', message = 'Informe um telefone WhatsApp válido.';
  end if;
  if coalesce((registration_data->>'data_processing_consent')::boolean, false) is not true then
    raise exception using errcode = '22023', message = 'Autorize o tratamento dos dados pessoais para enviar o cadastro.';
  end if;
  if not ((registration_data->>'birth_date')::date <= current_date) then
    raise exception using errcode = '22023', message = 'Informe uma data de nascimento valida.';
  end if;
  if parent_marital_status in ('Casado(a)', 'União estável')
    and char_length(trim(coalesce(registration_data->>'spouse_name', ''))) < 3 then
    raise exception using errcode = '22023', message = 'Informe o nome completo do cônjuge.';
  end if;

  select array_agg(distinct category)
  into person_categories
  from jsonb_array_elements_text(coalesce(registration_data->'categories', '[]'::jsonb)) category
  where category in ('Membro', 'Visitante', 'Criança', 'Adolescente');
  if person_categories is null or array_length(person_categories, 1) is null then
    raise exception using errcode = '22023', message = 'Assinale Membro, Visitante, Adolescente ou Criança.';
  end if;

  sanitized_address := jsonb_build_object(
    'zip', trim(coalesce(parent_address->>'zip', '')),
    'street', trim(coalesce(parent_address->>'street', '')),
    'number', trim(coalesce(parent_address->>'number', '')),
    'complement', trim(coalesce(parent_address->>'complement', '')),
    'district', trim(coalesce(parent_address->>'district', '')),
    'city', trim(coalesce(parent_address->>'city', '')),
    'state', trim(coalesce(parent_address->>'state', '')),
    'country', coalesce(nullif(trim(coalesce(parent_address->>'country', '')), ''), 'Brasil')
  );
  if char_length(sanitized_address->>'zip') < 8
    or char_length(sanitized_address->>'street') < 3
    or char_length(sanitized_address->>'number') < 1
    or char_length(sanitized_address->>'district') < 2
    or char_length(sanitized_address->>'city') < 2
    or char_length(sanitized_address->>'state') < 2 then
    raise exception using errcode = '22023', message = 'Preencha o endereço completo.';
  end if;

  if exists (
    select 1 from public.people person
    where person.church_id = target_church
      and (
        lower(coalesce(person.email, '')) = parent_email
        or regexp_replace(coalesce(person.phone_primary, ''), '[^0-9]', '', 'g') = normalized_phone
        or regexp_replace(coalesce(person.document_cpf, ''), '[^0-9]', '', 'g') = normalized_cpf
      )
  ) then
    raise exception using errcode = '23505', message = 'Ja existe uma pessoa com este e-mail, telefone ou CPF nesta igreja.';
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
    raise exception using errcode = '23505', message = 'O CPF do responsável e de cada filho deve ser único.';
  end if;

  for child_record in select value from jsonb_array_elements(registration_data->'children') loop
    child_name := trim(coalesce(child_record->>'full_name', ''));
    child_cpf := regexp_replace(coalesce(child_record->>'document_cpf', ''), '[^0-9]', '', 'g');
    begin
      child_birth_date := nullif(child_record->>'birth_date', '')::date;
    exception when others then
      raise exception using errcode = '22023', message = 'Informe uma data de nascimento válida para cada filho.';
    end;
    if char_length(child_name) < 3 or char_length(child_name) > 160
      or char_length(child_cpf) <> 11
      or child_birth_date is null
      or child_birth_date > current_date then
      raise exception using errcode = '22023', message = 'Preencha nome completo, data de nascimento e CPF de cada filho.';
    end if;
    if child_cpf = normalized_cpf
      or exists (
        select 1 from public.people person
        where person.church_id = target_church
          and regexp_replace(coalesce(person.document_cpf, ''), '[^0-9]', '', 'g') = child_cpf
      ) then
      raise exception using errcode = '23505', message = 'O CPF do responsável e de cada filho deve ser único.';
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
    child_age := date_part('year', age(current_date, child_birth_date))::int;
    child_categories := case
      when child_age < 18 and child_age >= 12 then array['Pré-cadastro', 'Criança', 'Adolescente']
      when child_age < 18 then array['Pré-cadastro', 'Criança']
      else array['Pré-cadastro']
    end;

    insert into public.people (
      church_id, full_name, birth_date, children_names, document_cpf,
      address, categories, ministry_roles, notes, active
    ) values (
      target_church, child_name, child_birth_date, '{}', child_cpf,
      sanitized_address, child_categories, '{}',
      'Cadastro criado junto com o responsável pelo link público.', true
    ) returning id into child_id;

    insert into public.people_consents (
      person_id, church_id, data_processing, consented_at
    ) values (child_id, target_church, true, now());

    if child_age < 18 then
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
    end if;
  end loop;

  return parent_id;
end;
$$;

revoke all on function public.submit_church_self_registration(uuid, jsonb) from public;
grant execute on function public.submit_church_self_registration(uuid, jsonb) to anon, authenticated;
