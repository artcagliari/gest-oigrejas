-- Somente o Gestor Geral pode excluir uma pessoa e seus vínculos em cascata.

create or replace function public.delete_person_as_manager(target_person uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_church uuid;
begin
  select church_id into target_church
  from public.people
  where id = target_person;

  if target_church is null then
    raise exception using errcode = '22023', message = 'Pessoa não encontrada.';
  end if;

  if not public.has_church_role(
    target_church,
    array['super']::public.platform_role[]
  ) then
    raise exception using errcode = '42501', message = 'Somente o Gestor Geral pode excluir pessoas.';
  end if;

  delete from public.people where id = target_person;
  return true;
end
$$;

revoke all on function public.delete_person_as_manager(uuid) from public, anon;
grant execute on function public.delete_person_as_manager(uuid) to authenticated;
