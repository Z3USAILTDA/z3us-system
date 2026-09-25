import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { findMetricsUser } from "../_shared/metricsUser.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const randomPassword = () => {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "") + "!Aa9";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Exige chamador admin
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado" }, 401);
    const { data: caller, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !caller?.user) return json({ error: "Não autenticado" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: caller.user.id, _role: "admin" });
    if (isAdmin !== true) return json({ error: "Apenas administradores" }, 403);

    const body = await req.json().catch(() => ({}));
    let user = await findMetricsUser(admin);
    const password = randomPassword();

    if (!user) {
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ error: "Usuário de métricas não existe; informe o e-mail para criá-lo" }, 400);
      }
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Painel de Métricas" },
      });
      if (error || !created.user) throw error ?? new Error("Falha ao criar usuário");
      user = { id: created.user.id, email };
    } else {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
      if (error) throw error;
    }

    // Papel somente leitura; nunca admin
    await admin.from("user_roles").delete().eq("user_id", user.id).neq("role", "viewer");
    await admin.from("user_roles").upsert({ user_id: user.id, role: "viewer" }, { onConflict: "user_id,role" });
    await admin
      .from("profiles")
      .upsert({ id: user.id, email: user.email, full_name: "Painel de Métricas", role: "viewer" }, { onConflict: "id" });

    return json({ success: true, senha_trocada: true });
  } catch (e) {
    console.error("setup-metrics-user erro:", e instanceof Error ? e.message : "desconhecido");
    return json({ error: "Falha ao configurar usuário de métricas" }, 400);
  }
});
