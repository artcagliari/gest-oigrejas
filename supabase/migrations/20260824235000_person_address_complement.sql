do $$
declare
  function_sql text;
  old_fragment text := '''district'', trim(person_address->>''district''), ''zip'', trim(person_address->>''zip'')';
  new_fragment text := '''district'', trim(person_address->>''district''), ''complement'', trim(person_address->>''complement''), ''zip'', trim(person_address->>''zip'')';
begin
  select pg_get_functiondef(
    'public.submit_church_self_registration(uuid,jsonb)'::regprocedure
  ) into function_sql;

  if position(old_fragment in function_sql) = 0 then
    raise exception 'Não foi possível atualizar o endereço da função de pré-cadastro.';
  end if;

  execute replace(function_sql, old_fragment, new_fragment);
end;
$$;

