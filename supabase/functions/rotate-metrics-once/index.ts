import { createClient } from "npm:@supabase/supabase-js@2";
import { findMetricsUser } from "../_shared/metricsUser.ts";

// Temporária: troca única da senha do usuário de métricas. Apagada após o uso.
Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const user = await findMetricsUser(admin);
  if (!user) return new Response(JSON.stringify({ ok: false, motivo: "usuario_ausente" }), { status: 404 });
  const b = new Uint8Array(48);
  crypto.getRandomValues(b);
  const password = btoa(String.fromCharCode(...b)).replace(/[^A-Za-z0-9]/g, "") + "!Aa9";
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  await admin.from("user_roles").delete().eq("user_id", user.id).neq("role", "viewer");
  await admin.from("user_roles").upsert({ user_id: user.id, role: "viewer" }, { onConflict: "user_id,role" });
  return new Response(JSON.stringify({ ok: !error }), { status: error ? 500 : 200 });
});
