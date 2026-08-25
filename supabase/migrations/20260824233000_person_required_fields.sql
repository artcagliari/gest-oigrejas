alter table public.people
  add column if not exists children_names text[] not null default '{}';

alter table public.people
  drop column if exists preferred_name,
  drop column if exists document_rg;

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
  normalized_cpf text := regexp_replace(coalesce(registration_data->>'document_cpf', ''), '[^0-9]', '', 'g');
  person_address jsonb := coalesce(registration_data->'address', '{}'::jsonb);
  person_categories text[];
  person_children text[];
  person_marital_status text := trim(coalesce(registration_data->>'marital_status', ''));
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
  if registration_data->>'birth_date' is null
    or coalesce(registration_data->>'gender', '') not in ('Homem', 'Mulher', 'Prefiro não informar')
    or trim(coalesce(registration_data->>'education', '')) = ''
    or person_marital_status = ''
    or registration_data->>'conversion_date' is null
    or not (registration_data ? 'baptized') then
    raise exception using errcode = '22023', message = 'Preencha todos os dados pessoais e da vida cristã.';
  end if;
  if person_marital_status in ('Casado(a)', 'União estável')
    and trim(coalesce(registration_data->>'spouse_name', '')) = '' then
    raise exception using errcode = '22023', message = 'Informe o nome do cônjuge.';
  end if;
  if char_length(normalized_cpf) <> 11 then
    raise exception using errcode = '22023', message = 'Informe um CPF com 11 dígitos.';
  end if;
  if char_length(normalized_phone) < 10 or person_email is null then
    raise exception using errcode = '22023', message = 'Informe telefone principal e e-mail.';
  end if;
  if person_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception using errcode = '22023', message = 'Informe um e-mail válido.';
  end if;
  if trim(coalesce(person_address->>'street', '')) = ''
    or trim(coalesce(person_address->>'number', '')) = ''
    or trim(coalesce(person_address->>'district', '')) = ''
    or trim(coalesce(person_address->>'zip', '')) = ''
    or trim(coalesce(person_address->>'city', '')) = ''
    or trim(coalesce(person_address->>'state', '')) = ''
    or trim(coalesce(person_address->>'country', '')) = '' then
    raise exception using errcode = '22023', message = 'Preencha todo o endereço.';
  end if;
  if jsonb_typeof(registration_data->'categories') <> 'array' then
    raise exception using errcode = '22023', message = 'Assinale Membro, Visitante ou Criança.';
  end if;
  select array_agg(distinct category)
  into person_categories
  from jsonb_array_elements_text(registration_data->'categories') category
  where category in ('Membro', 'Visitante', 'Criança');
  if coalesce(cardinality(person_categories), 0) = 0 then
    raise exception using errcode = '22023', message = 'Assinale Membro, Visitante ou Criança.';
  end if;
  if jsonb_typeof(registration_data->'children_names') <> 'array' then
    raise exception using errcode = '22023', message = 'Informe se possui filhos.';
  end if;
  select coalesce(array_agg(trim(child_name)) filter (where trim(child_name) <> ''), '{}')
  into person_children
  from jsonb_array_elements_text(registration_data->'children_names') child_name;

  if exists (
    select 1 from public.people person
    where person.church_id = target_church
      and (lower(person.email) = person_email
        or regexp_replace(coalesce(person.phone_primary, ''), '[^0-9]', '', 'g') = normalized_phone
        or regexp_replace(coalesce(person.document_cpf, ''), '[^0-9]', '', 'g') = normalized_cpf)
  ) then
    raise exception using errcode = '23505', message = 'Já existe uma pessoa com este CPF, e-mail ou telefone nesta igreja.';
  end if;

  insert into public.people (
    church_id, full_name, birth_date, gender, education, marital_status,
    spouse_name, children_names, conversion_date, baptized, document_cpf,
    email, phone_primary, phone_secondary, address, categories, ministry_roles,
    notes, active
  ) values (
    target_church, person_name, (registration_data->>'birth_date')::date,
    registration_data->>'gender', trim(registration_data->>'education'),
    person_marital_status, nullif(trim(coalesce(registration_data->>'spouse_name', '')), ''),
    person_children, (registration_data->>'conversion_date')::date,
    (registration_data->>'baptized')::boolean,
    nullif(trim(registration_data->>'document_cpf'), ''), person_email,
    person_phone, nullif(trim(coalesce(registration_data->>'phone_secondary', '')), ''),
    jsonb_build_object(
      'street', trim(person_address->>'street'), 'number', trim(person_address->>'number'),
      'district', trim(person_address->>'district'), 'zip', trim(person_address->>'zip'),
      'city', trim(person_address->>'city'), 'state', trim(person_address->>'state'),
      'country', trim(person_address->>'country')
    ),
    array_prepend('Pré-cadastro', person_categories), '{}',
    'Cadastro realizado pelo link público da igreja.', true
  ) returning id into person_id;

  insert into public.people_consents (
    person_id, church_id, messaging, data_processing, consented_at
  ) values (
    person_id, target_church,
    coalesce((registration_data->>'messaging_consent')::boolean, false), true, now()
  );
  return person_id;
end;
$$;

revoke all on function public.submit_church_self_registration(uuid, jsonb) from public;
grant execute on function public.submit_church_self_registration(uuid, jsonb) to anon, authenticated;
