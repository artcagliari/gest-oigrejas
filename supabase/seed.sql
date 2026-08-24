-- Seed limpo de instalação do Comunhão.
-- Não cria igrejas nem dados operacionais: isso será feito pelo Administrador
-- da Plataforma pela interface.
--
-- Segurança: o seed exige que exista exatamente um usuário no Supabase Auth.
-- Esse primeiro usuário torna-se o Administrador da Plataforma (Master).

do $$
declare
  master_id uuid;
  master_name text;
  users_count integer;
begin
  select count(*) into users_count from auth.users;

  if users_count = 0 then
    raise exception 'Crie primeiro o usuário Administrador da Plataforma em Authentication > Users.';
  end if;

  if users_count > 1 then
    raise exception 'Há mais de um usuário no Auth. Para segurança, deixe somente a conta que será Master antes de executar o seed.';
  end if;

  select
    id,
    coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1), 'Administrador da Plataforma')
  into master_id, master_name
  from auth.users
  limit 1;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('platform_role', 'master')
  where id = master_id;

  insert into public.profiles (id, full_name)
  values (master_id, master_name)
  on conflict (id) do update set full_name = excluded.full_name;

  -- O Master não pertence a igreja alguma e, portanto, não acessa Pessoas,
  -- Kids, Ensino, Agenda, Departamentos ou Financeiro.
  delete from public.church_memberships where user_id = master_id;
end
$$;

