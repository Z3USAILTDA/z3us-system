import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const LOGO_URL = "https://ssljlgmcoilghdyxqihu.supabase.co/storage/v1/object/public/email-assets/logo-z3us.png";
const APP_URL = "https://projetos.z3us.my";

const encoder = new TextEncoder();

function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
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
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64UrlEncode(signature);
}

async function createInviteToken(userId: string, email: string, clientId: string, nonce: string): Promise<string> {
  const payload = base64UrlEncode(JSON.stringify({
    purpose: "client-password",
    userId,
    email,
    clientId,
    nonce,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }));
  const signature = await signPayload(payload);
  return `${payload}.${signature}`;
}

function generateStrongPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "") + "A1!";
}

function buildEmailHtml(clientName: string, inviteUrl: string, recipientEmail: string, isResend: boolean): string {
  const title = isResend ? "Seu acesso ao portal Z3US" : "Bem-vindo(a) ao portal Z3US";
  const intro = isResend
    ? `Reenviamos seu link de acesso ao portal Z3US.`
    : `Você foi adicionado(a) como contato do cliente <strong>${clientName}</strong> no portal Z3US e já pode acompanhar os projetos em andamento.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="${LOGO_URL}" alt="Z3US" style="height:56px;width:auto;" />
    </div>
    <div style="background:#0f172a;border-radius:12px;padding:32px 28px;color:#e2e8f0;">
      <h1 style="margin:0 0 16px 0;font-size:22px;color:#ffffff;">${title}</h1>
      <p style="margin:0 0 16px 0;line-height:1.6;font-size:15px;">${intro}</p>
      <p style="margin:0 0 24px 0;line-height:1.6;font-size:15px;">
        Para começar, defina sua senha clicando no botão abaixo. Esse link é pessoal e expira em 7 dias.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${inviteUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Definir minha senha e acessar
        </a>
      </div>
      <p style="margin:24px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br/>
        <span style="word-break:break-all;color:#cbd5e1;">${inviteUrl}</span>
      </p>
      <p style="margin:24px 0 0 0;font-size:13px;color:#94a3b8;">
        Seu email de acesso: <strong style="color:#e2e8f0;">${recipientEmail}</strong>
      </p>
    </div>
    <p style="text-align:center;margin:24px 0 0 0;font-size:12px;color:#64748b;">
      Z3US · Portal de Projetos · Esta é uma mensagem automática, não responda.
    </p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Não autorizado");

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Apenas administradores podem convidar clientes");

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const clientId = String(body.clientId ?? "").trim();
    if (!email || !clientId) throw new Error("Dados incompletos");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido");

    // Busca o nome do cliente para personalização
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("company_name, contact_name")
      .eq("id", clientId)
      .maybeSingle();
    const clientName = client?.company_name ?? client?.contact_name ?? "Cliente";

    // Verifica se já existe usuário com este email
    const { data: listed } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed?.users?.find(u => (u.email ?? "").toLowerCase() === email);

    let isResend = false;

    let invitedUserId: string | null = existing?.id ?? null;
    const nonce = crypto.randomUUID();

    if (existing) {
      isResend = true;

      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        app_metadata: {
          ...(existing.app_metadata ?? {}),
          client_invite_nonce: nonce,
        },
      });
      if (metadataError) throw metadataError;
    } else {
      // Cria novo usuário com role 'client' e senha aleatória
      const password = generateStrongPassword();
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: email.split("@")[0], role: "client" },
        app_metadata: { client_invite_nonce: nonce },
      });
      if (createError) throw createError;
      invitedUserId = createdUser.user?.id ?? null;
    }

    if (!invitedUserId) throw new Error("Não foi possível preparar o acesso do cliente");

    // Garante que o usuário tenha perfil, role e vínculo com o cliente mesmo sem depender de triggers.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: invitedUserId,
        email,
        full_name: email.split("@")[0],
        role: "client",
      })
      .select("id")
      .maybeSingle();
    if (profileError && profileError.code !== "23505") throw profileError;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: invitedUserId, role: "client" }, { onConflict: "user_id,role" });
    if (roleError) throw roleError;

    const { error: clientUserError } = await supabaseAdmin
      .from("client_users")
      .upsert({ client_id: clientId, user_id: invitedUserId }, { onConflict: "client_id,user_id" });
    if (clientUserError) throw clientUserError;

    const inviteToken = await createInviteToken(invitedUserId, email, clientId, nonce);
    const inviteUrl = `${APP_URL}/reset-password?invite_token=${encodeURIComponent(inviteToken)}`;

    // Envia email via Hermes
    const { error: emailError } = await resend.emails.send({
      from: "Z3US <noreply@hermes.z3us.ai>",
      to: [email],
      subject: isResend ? "Seu acesso ao portal Z3US" : `Bem-vindo(a) ao portal Z3US - ${clientName}`,
      html: buildEmailHtml(clientName, inviteUrl, email, isResend),
    });
    if (emailError) throw emailError;

    return new Response(
      JSON.stringify({ success: true, status: isResend ? "resent" : "created" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("invite-client-user error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
