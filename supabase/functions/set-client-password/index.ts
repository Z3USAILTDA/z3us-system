import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://projetos.z3us.my";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return decoder.decode(bytes);
}

function base64UrlEncode(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signPayload(payload: string): Promise<string> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret) throw new Error("Configuração do servidor indisponível");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64UrlEncode(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

async function readInviteToken(inviteToken: string) {
  const [payload, signature] = inviteToken.split(".");
  if (!payload || !signature) throw new Error("Link inválido. Solicite um novo convite ao administrador.");
  const expectedSignature = await signPayload(payload);
  if (signature !== expectedSignature) throw new Error("Link inválido. Solicite um novo convite ao administrador.");
  const parsed = JSON.parse(base64UrlDecode(payload));
  if (parsed?.purpose !== "client-password" || !parsed?.userId || !parsed?.email || !parsed?.clientId || !parsed?.nonce) {
    throw new Error("Link inválido. Solicite um novo convite ao administrador.");
  }
  if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
    throw new Error("Link expirado. Solicite um novo convite ao administrador.");
  }
  return parsed as { userId: string; email: string; clientId: string; nonce: string };
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderPasswordForm(inviteToken: string, error = "") {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Definir senha</title><style>
    body{margin:0;min-height:100vh;background:#020817;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;display:grid;place-items:center;padding:24px}body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 20% 15%,rgba(59,130,246,.18),transparent 30%),radial-gradient(circle at 80% 85%,rgba(20,184,166,.16),transparent 32%);pointer-events:none}.card{position:relative;width:min(100%,420px);background:#060b16;border:1px solid rgba(59,130,246,.25);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.35);padding:28px}.logo{width:76px;height:76px;margin:0 auto 18px;display:block}h1{text-align:center;margin:0 0 8px;font-size:24px}p{text-align:center;color:#94a3b8;line-height:1.5;margin:0 0 22px}.field{margin-bottom:14px}label{display:block;margin-bottom:8px;font-size:14px;font-weight:600}input{box-sizing:border-box;width:100%;height:44px;border-radius:8px;border:1px solid #1e293b;background:#020817;color:#e5e7eb;padding:0 12px;font-size:15px}button{width:100%;height:46px;border:0;border-radius:8px;background:#3b82f6;color:white;font-weight:700;font-size:15px;cursor:pointer}.error{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#fecaca;border-radius:8px;padding:10px 12px;margin-bottom:14px;text-align:left;font-size:14px}.success{text-align:center}.success a{color:#93c5fd;font-weight:700}</style></head><body><main class="card"><img class="logo" src="https://ssljlgmcoilghdyxqihu.supabase.co/storage/v1/object/public/email-assets/logo-z3us.png" alt="Z3US"><h1>Definir senha</h1><p>Crie uma senha para acessar o portal Z3US.</p>${error ? `<div class="error">${error}</div>` : ""}<form method="post"><input type="hidden" name="inviteToken" value="${inviteToken.replace(/"/g, "&quot;")}"><div class="field"><label for="password">Nova senha</label><input id="password" name="password" type="password" minlength="8" required autocomplete="new-password"></div><div class="field"><label for="confirm">Confirmar senha</label><input id="confirm" name="confirm" type="password" minlength="8" required autocomplete="new-password"></div><button type="submit">Definir senha e entrar</button></form></main></body></html>`;
}

function renderSuccess() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="2;url=${APP_URL}/auth"><title>Senha definida</title><style>body{margin:0;min-height:100vh;background:#020817;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;display:grid;place-items:center;padding:24px}.card{width:min(100%,420px);background:#060b16;border:1px solid rgba(59,130,246,.25);border-radius:12px;padding:28px;text-align:center}a{color:#93c5fd;font-weight:700}</style></head><body><main class="card"><h1>Senha definida com sucesso</h1><p>Você será direcionado para o login.</p><a href="${APP_URL}/auth">Ir para login</a></main></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (req.method === "GET") {
      const inviteToken = url.searchParams.get("invite_token") ?? "";
      if (!inviteToken) return htmlResponse(renderPasswordForm("", "Link inválido. Solicite um novo convite ao administrador."), 400);
      return htmlResponse(renderPasswordForm(inviteToken));
    }

    const isForm = req.headers.get("content-type")?.includes("application/x-www-form-urlencoded") || req.headers.get("content-type")?.includes("multipart/form-data");
    const body = isForm ? Object.fromEntries(await req.formData()) : await req.json();
    const password = String(body.password ?? "");
    const confirm = body.confirm ? String(body.confirm) : password;
    const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : undefined;

    if (password !== confirm) {
      if (isForm) return htmlResponse(renderPasswordForm(inviteToken ?? "", "As senhas não conferem."), 400);
      throw new Error("As senhas não conferem");
    }

    if (typeof password !== "string" || password.length < 8) {
      if (isForm) return htmlResponse(renderPasswordForm(inviteToken ?? "", "A senha deve ter no mínimo 8 caracteres."), 400);
      throw new Error("A senha deve ter no mínimo 8 caracteres");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let userId: string;
    let email: string | undefined;
    let clientId: string | undefined;
    let appMetadata: Record<string, unknown> = {};

    if (typeof inviteToken === "string" && inviteToken.trim()) {
      const invite = await readInviteToken(inviteToken.trim());
      const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(invite.userId);
      const user = userData?.user;
      if (getUserError || !user || (user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
        throw new Error("Link inválido. Solicite um novo convite ao administrador.");
      }
      if (user.app_metadata?.client_invite_nonce !== invite.nonce) {
        throw new Error("Link expirado. Solicite um novo convite ao administrador.");
      }
      userId = invite.userId;
      email = invite.email;
      clientId = invite.clientId;
      appMetadata = user.app_metadata ?? {};
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Link expirado. Solicite um novo convite ao administrador.");
      const token = authHeader.replace("Bearer ", "").trim();
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) throw new Error("Link expirado. Solicite um novo convite ao administrador.");
      userId = user.id;
      email = user.email ?? undefined;
      appMetadata = user.app_metadata ?? {};
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      app_metadata: { ...appMetadata, client_invite_nonce: null },
    });
    if (updateError) throw updateError;

    if (email) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({ id: userId, email, full_name: email.split("@")[0], role: "client" })
        .select("id")
        .maybeSingle();
      if (profileError && profileError.code !== "23505") throw profileError;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "client" }, { onConflict: "user_id,role" });
      if (roleError) throw roleError;
    }
    if (clientId) {
      const { error: clientUserError } = await supabaseAdmin
        .from("client_users")
        .upsert({ client_id: clientId, user_id: userId }, { onConflict: "client_id,user_id" });
      if (clientUserError) throw clientUserError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao definir senha";
    console.error("set-client-password error:", message);
    if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded") || req.headers.get("content-type")?.includes("multipart/form-data")) {
      return htmlResponse(renderPasswordForm("", message), 400);
    }
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});