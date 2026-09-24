import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METRICS_EMAIL = "metricas@z3us.ai";
// Senha real armazenada no Auth (>=8 chars). A UI aceita "z3us" e
// traduz para esta credencial real ao chamar signInWithPassword.
const METRICS_PASSWORD = "z3us-metrics-tv-2026!";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1) Verifica se já existe
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email === METRICS_EMAIL);

    let userId = existing?.id;

    if (!existing) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: METRICS_EMAIL,
        password: METRICS_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Painel de Métricas", role: "viewer" },
      });
      if (createErr) throw createErr;
      userId = created.user?.id;
    } else {
      // Garante a senha conhecida (caso já exista com outra senha)
      await admin.auth.admin.updateUserById(existing.id, {
        password: METRICS_PASSWORD,
        email_confirm: true,
      });
    }

    if (!userId) throw new Error("Falha ao obter user id");

    // 2) Garante papel viewer (somente leitura) e remove qualquer outro papel
    await admin.from("user_roles").delete().eq("user_id", userId).neq("role", "viewer");
    await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "viewer" }, { onConflict: "user_id,role" });

    // 3) Garante profile admin
    await admin
      .from("profiles")
      .upsert(
        { id: userId, email: METRICS_EMAIL, full_name: "Painel de Métricas", role: "viewer" },
        { onConflict: "id" },
      );

    return new Response(
      JSON.stringify({ success: true, userId, email: METRICS_EMAIL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
