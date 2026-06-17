import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function readJsonBody(req: Request) {
  const text = await req.text();
  if (!text.trim()) return {};
  return JSON.parse(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const inviteToken = url.searchParams.get("invite_token") ?? "";
    const redirectUrl = new URL("/reset-password", APP_URL);
    if (inviteToken) redirectUrl.searchParams.set("invite_token", inviteToken);
    return Response.redirect(redirectUrl.toString(), 302);
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