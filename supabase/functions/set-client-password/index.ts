import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const APP_URL = "https://projetos.z3us.my";
const LOGO_URL = "https://ssljlgmcoilghdyxqihu.supabase.co/storage/v1/object/public/email-assets/logo-z3us.png";

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

async function readJsonBody(req: Request) {
  const text = await req.text();
  if (!text.trim()) return {};
  if ((req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }
  return JSON.parse(text);
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderPasswordPage(inviteToken: string, error = "") {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Definir senha</title><style>body{margin:0;min-height:100vh;background:#0f172a;color:#e2e8f0;font-family:Arial,sans-serif;display:grid;place-items:center}main{width:min(92vw,420px);background:#111827;border:1px solid #334155;border-radius:14px;padding:28px;box-shadow:0 20px 60px #0008}.logo{display:block;margin:0 auto 18px;height:72px}h1{text-align:center;margin:0 0 8px;font-size:24px}p{color:#94a3b8;text-align:center;line-height:1.5}label{display:block;margin:16px 0 8px}input{box-sizing:border-box;width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#020617;color:#e2e8f0;font-size:16px}button{width:100%;margin-top:20px;padding:13px;border:0;border-radius:8px;background:#3b82f6;color:white;font-weight:700;font-size:15px;cursor:pointer}.error{background:#7f1d1d;color:#fecaca;border-radius:8px;padding:10px;margin:14px 0;text-align:center}.small{font-size:13px}</style></head><body><main><img class="logo" src="${LOGO_URL}" alt="Z3US"/><h1>Definir senha</h1><p>Crie sua senha para acessar o portal Z3US.</p>${error ? `<div class="error">${error}</div>` : ""}<form method="post"><input type="hidden" name="inviteToken" value="${inviteToken.replace(/"/g, "&quot;")}"/><label for="password">Nova senha</label><input id="password" name="password" type="password" minlength="8" required autocomplete="new-password"/><label for="confirmPassword">Confirmar senha</label><input id="confirmPassword" name="confirmPassword" type="password" minlength="8" required autocomplete="new-password"/><button type="submit">Definir senha e acessar</button></form><p class="small">A senha deve ter no mínimo 8 caracteres.</p></main></body></html>`;
}

function renderSuccessPage() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta http-equiv="refresh" content="3;url=${APP_URL}/auth"/><title>Senha definida</title><style>body{margin:0;min-height:100vh;background:#0f172a;color:#e2e8f0;font-family:Arial,sans-serif;display:grid;place-items:center}main{width:min(92vw,420px);background:#111827;border:1px solid #334155;border-radius:14px;padding:28px;text-align:center;box-shadow:0 20px 60px #0008}.logo{height:72px;margin-bottom:18px}a{color:#60a5fa}</style></head><body><main><img class="logo" src="${LOGO_URL}" alt="Z3US"/><h1>Senha definida com sucesso</h1><p>Você já pode acessar o portal com seu e-mail e a nova senha.</p><p><a href="${APP_URL}/auth">Ir para o login</a></p></main></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const inviteToken = url.searchParams.get("invite_token") ?? "";
    return htmlResponse(renderPasswordPage(inviteToken, inviteToken ? "" : "Link inválido. Solicite um novo convite ao administrador."), inviteToken ? 200 : 400);
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const body = await readJsonBody(req);
    const password = String(body.password ?? "");
    const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : undefined;

    if (typeof password !== "string" || password.length < 8) {
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
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});