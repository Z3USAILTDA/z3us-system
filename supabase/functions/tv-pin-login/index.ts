import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { findMetricsUser } from "../_shared/metricsUser.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const WINDOW_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "metodo_invalido" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const pin = typeof body?.pin === "string" ? body.pin : "";
    if (!/^[0-9]{4}$/.test(pin)) return json({ error: "pin_invalido" }, 400);

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data: ipFails } = await admin
      .from("tv_pin_attempts")
      .select("created_at")
      .eq("ip", ip)
      .eq("success", false)
      .gte("created_at", since)
      .order("created_at", { ascending: true });
    if ((ipFails?.length ?? 0) >= 5) {
      const oldest = new Date(ipFails![ipFails!.length - 5].created_at).getTime();
      const minutos = Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 60000));
      return json({ error: "muitas_tentativas", minutos }, 429);
    }
    const { count: totalFails } = await admin
      .from("tv_pin_attempts")
      .select("id", { count: "exact", head: true })
      .eq("success", false)
      .gte("created_at", since);
    if ((totalFails ?? 0) >= 30) return json({ error: "muitas_tentativas", minutos: 15 }, 429);

    const { data: ok, error: vErr } = await admin.rpc("verify_tv_pin", { p_pin: pin });
    if (vErr) {
      if (vErr.message?.includes("pin_nao_configurado")) return json({ error: "pin_nao_configurado" }, 409);
      throw vErr;
    }

    await admin.from("tv_pin_attempts").insert({ ip, success: ok === true });
    if (ok !== true) return json({ error: "pin_incorreto" }, 401);

    const user = await findMetricsUser(admin);
    if (!user) return json({ error: "usuario_metricas_ausente" }, 500);

    const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    if (lErr || !link?.properties?.hashed_token) throw lErr ?? new Error("Falha ao gerar acesso");

    return json({ hashed_token: link.properties.hashed_token });
  } catch (e) {
    console.error("tv-pin-login erro:", e instanceof Error ? e.message : "desconhecido");
    return json({ error: "erro_interno" }, 500);
  }
});
