-- Mantém todo menor no módulo Kids e identifica também como Adolescente
-- quem tiver entre 12 e 17 anos no momento do cadastro familiar.

do $$
declare
  function_sql text;
  original_sql text := $original$sanitized_address, array['Pré-cadastro', 'Criança'], '{}',$original$;
  replacement_sql text := $replacement$sanitized_address,
      case
        when child_birth_date <= (current_date - interval '12 years')::date
          then array['Pré-cadastro', 'Criança', 'Adolescente']
        else array['Pré-cadastro', 'Criança']
      end,
      '{}',$replacement$;
begin
  select pg_get_functiondef(
    'public.submit_church_self_registration(uuid,jsonb)'::regprocedure
  ) into function_sql;

  if position(original_sql in function_sql) = 0 then
    raise exception 'Não foi possível habilitar a classificação de adolescentes no cadastro familiar.';
  end if;

  execute replace(function_sql, original_sql, replacement_sql);
end;
$$;
