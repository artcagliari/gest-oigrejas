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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = request.headers.get("Authorization") ?? "";
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const admin = createClient(url, serviceKey);
  let createdChurchId: string | null = null;
  let createdUserId: string | null = null;

  try {
    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser();
    if (userError || !user) throw new Error("Sessão inválida.");
    if (user.app_metadata?.platform_role !== "master")
      throw new Error(
        "Somente o Administrador da Plataforma pode criar igrejas.",
      );

    const { church, manager } = await request.json();
    if (!church?.id || !church?.name?.trim())
      throw new Error("Informe os dados da igreja.");
    if (!manager?.fullName?.trim() || !manager?.email?.trim())
      throw new Error("Informe o nome e o e-mail do Gestor Geral.");
    if (!manager?.password || manager.password.length < 8)
      throw new Error("A senha provisória deve ter no mínimo 8 caracteres.");

    const { error: churchError } = await admin.from("churches").insert({
      id: church.id,
      name: church.name.trim(),
      document: church.document?.trim() || null,
      email: church.email?.trim() || null,
      phone: church.phone?.trim() || null,
      address: {
        city: church.city?.trim() || null,
        state: church.state?.trim() || null,
        country: "Brasil",
      },
      active: true,
    });
    if (churchError) throw churchError;
    createdChurchId = church.id;

    const { data: invited, error: inviteError } =
      await admin.auth.admin.createUser({
        email: manager.email.trim().toLowerCase(),
        password: manager.password,
        email_confirm: true,
        user_metadata: {
          full_name: manager.fullName.trim(),
          initial_church_id: church.id,
        },
      });
    if (inviteError || !invited.user)
      throw inviteError ?? new Error("Não foi possível criar o Gestor Geral.");
    createdUserId = invited.user.id;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: invited.user.id,
      full_name: manager.fullName.trim(),
    });
    if (profileError) throw profileError;

    const { error: membershipError } = await admin
      .from("church_memberships")
      .insert({
        church_id: church.id,
        user_id: invited.user.id,
        role: "super",
        active: true,
      });
    if (membershipError) throw membershipError;

    return json({ ok: true, churchId: church.id });
  } catch (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
    if (createdChurchId)
      await admin.from("churches").delete().eq("id", createdChurchId);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a igreja.",
      },
      400,
    );
  }
});
