import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = request.headers.get("Authorization") ?? "";
    const callerClient = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(url, service);
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error("Sessão inválida.");

    const { churchId, email, fullName, role } = await request.json();
    const allowedRoles = [
      "super",
      "people",
      "teaching",
      "finance",
      "agenda",
      "viewer",
    ];
    if (!churchId || !email || !fullName || !allowedRoles.includes(role))
      throw new Error("Dados do convite inválidos.");

    const master = user.app_metadata?.platform_role === "master";
    if (master)
      throw new Error(
        "O Administrador da Plataforma cria somente a igreja e seu Gestor Geral.",
      );
    const { data: membership } = await admin
      .from("church_memberships")
      .select("id")
      .eq("church_id", churchId)
      .eq("user_id", user.id)
      .eq("role", "super")
      .eq("active", true)
      .maybeSingle();
    if (!membership)
      throw new Error("Apenas o Gestor Geral pode convidar usuários.");

    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
      });
    if (inviteError) throw inviteError;
    if (!invited.user) throw new Error("Usuário não criado.");
    const { error: memberError } = await admin
      .from("church_memberships")
      .upsert(
        { church_id: churchId, user_id: invited.user.id, role, active: true },
        { onConflict: "church_id,user_id" },
      );
    if (memberError) throw memberError;
    const { error: personLinkError } = await admin
      .from("people")
      .update({ auth_user_id: invited.user.id })
      .eq("church_id", churchId)
      .ilike("email", email.trim());
    if (personLinkError) throw personLinkError;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro inesperado.",
      }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
