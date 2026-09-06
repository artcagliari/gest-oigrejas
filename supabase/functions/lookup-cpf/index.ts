import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function normalizedDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function firstText(source: Record<string, unknown>, keys: string[]) {
  const normalizedKeys = new Set(keys.map(normalizedKey));
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  for (const [key, value] of Object.entries(source)) {
    if (
      normalizedKeys.has(normalizedKey(key)) &&
      typeof value === "string" &&
      value.trim()
    )
      return value.trim();
  }
  return null;
}

function normalizedKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (Array.isArray(value)) {
    const record = value.find(
      (item) => item && typeof item === "object" && !Array.isArray(item),
    );
    return (record as Record<string, unknown> | undefined) ?? null;
  }
  return null;
}

function hasValidCpfDigits(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1)
      sum += Number(cpf[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST")
    return json({ error: "Método inválido." }, 405);

  try {
    const apiToken = Deno.env.get("HUB_DESENVOLVEDOR_TOKEN");
    if (!apiToken)
      throw new Error("Serviço de consulta de CPF não configurado.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = request.headers.get("Authorization") ?? "";
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await request.json();
    const cpf = String(body?.cpf ?? "").replace(/\D/g, "");
    const registrationToken = String(body?.registrationToken ?? "");
    if (!hasValidCpfDigits(cpf))
      return json({ error: "Informe um CPF válido com 11 dígitos." }, 400);

    const { data: userData } = await caller.auth.getUser();
    if (userData.user) {
      const { data: memberships } = await admin
        .from("church_memberships")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("active", true)
        .limit(1);
      if (!memberships?.length)
        return json(
          { error: "Usuário sem vínculo ativo com uma igreja." },
          403,
        );
    } else {
      const { data: link } = await admin
        .from("church_registration_links")
        .select("id")
        .eq("token", registrationToken)
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle();
      if (!link)
        return json({ error: "Link de cadastro inválido ou expirado." }, 401);
    }

    const endpoint = new URL("https://ws.hubdodesenvolvedor.com.br/v2/cpf/");
    endpoint.searchParams.set("cpf", cpf);
    endpoint.searchParams.set("token", apiToken);
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok || !payload)
      throw new Error("O serviço de CPF está temporariamente indisponível.");

    const result =
      firstRecord(payload.result) ??
      firstRecord(payload.data) ??
      firstRecord(payload.retorno) ??
      payload;
    const success = payload.status;
    if (success === false || success === 0 || payload.return === "error") {
      const message = firstText(payload, ["message", "mensagem", "error"]);
      throw new Error(message ?? "CPF não encontrado.");
    }

    const name = firstText(result, [
      "nome",
      "name",
      "nome_completo",
      "nome_da_pf",
      "nome_pf",
      "razao_social",
    ]);
    const birthDate = normalizedDate(
      firstText(result, [
        "data_de_nascimento",
        "data_nascimento",
        "nascimento",
        "birth_date",
        "birthDate",
      ]),
    );
    const status = firstText(result, [
      "situacao",
      "status",
      "situacao_cadastral",
    ]);
    const genderValue = firstText(result, ["sexo", "genero", "gender"]);
    const gender = genderValue
      ? /^(m|masculino|homem)$/i.test(genderValue)
        ? "Homem"
        : /^(f|feminino|mulher)$/i.test(genderValue)
          ? "Mulher"
          : null
      : null;
    if (!name && !birthDate)
      throw new Error("A consulta não retornou dados para preencher a ficha.");

    return json({ cpf, name, birthDate, status, gender });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar o CPF.",
      },
      400,
    );
  }
});
