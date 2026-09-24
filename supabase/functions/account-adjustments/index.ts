// Função de uso único para ajuste de contas. Operações fixas e idempotentes. Será removida após a execução.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const log: any[] = [];

async function allUsers() {
  const out: any[] = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 200) break;
  }
  return out;
}
const byEmail = (us: any[], e: string) => us.find((u) => u.email?.toLowerCase() === e);

async function setOnlyRole(uid: string, role: string) {
  await admin.from("user_roles").delete().eq("user_id", uid).neq("role", role);
  const { error } = await admin.from("user_roles").upsert({ user_id: uid, role }, { onConflict: "user_id,role" });
  if (error) throw error;
  const { error: pe } = await admin.from("profiles").update({ role }).eq("id", uid);
  if (pe) throw pe;
}

async function inactivate(us: any[], email: string) {
  const u = byEmail(us, email);
  if (!u) { log.push({ step: "inativar", email, result: "não encontrado" }); return; }
  const { error } = await admin.auth.admin.updateUserById(u.id, { ban_duration: "876000h" });
  if (error) throw error;
  await admin.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin");
  await setOnlyRole(u.id, "client"); // sem admin; sem vínculo com cliente => sem dados
  log.push({ step: "inativar", email, result: "bloqueado, admin removido" });
}

async function proveLogin(email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const pub = createClient(URL_, anonKey, { auth: { persistSession: false } });
  const { data: s, error: ve } = await pub.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (ve || !s.session) return { email, login: false, error: ve?.message };
  const asUser = createClient(URL_, anonKey, {
    global: { headers: { Authorization: `Bearer ${s.session.access_token}` } },
    auth: { persistSession: false },
  });
  const { data: roles } = await asUser.from("user_roles").select("role");
  await pub.auth.signOut();
  return { email, login: true, session_email: s.user?.email, user_id: s.user?.id, roles: roles?.map((r) => r.role) };
}

Deno.serve(async () => {
  try {
    let us = await allUsers();

    // 1) Larissa -> admin, sem vínculo de cliente
    const lar = byEmail(us, "larissa@z3us.ai");
    if (!lar) throw new Error("larissa@z3us.ai não encontrada");
    await setOnlyRole(lar.id, "admin");
    const { error: cuErr } = await admin.from("client_users").delete().eq("user_id", lar.id);
    if (cuErr) throw cuErr;
    await admin.from("clients").update({ user_id: null }).eq("user_id", lar.id);
    const { data: chk } = await admin.from("user_roles").select("role").eq("user_id", lar.id);
    const { count } = await admin.from("client_users").select("*", { count: "exact", head: true }).eq("user_id", lar.id);
    if (!chk?.some((r) => r.role === "admin") || (count ?? 0) > 0) throw new Error("Passo 1 não concluído");
    log.push({ step: 1, email: "larissa@z3us.ai", roles: chk.map((r) => r.role), client_links: count });

    // 2) Inativar
    for (const e of ["devs@z3us.ai", "robertomiranda11@icloud.com", "willian@z3us.ai", "asilva@z3us.ai"]) await inactivate(us, e);

    // 3) Troca de e-mail da Ana Beatriz
    const ana = byEmail(us, "anabeatrizpastori@gmail.com") ?? byEmail(us, "apastori@z3us.ai");
    if (!ana) throw new Error("Conta da Ana Beatriz não encontrada");
    if (ana.email !== "apastori@z3us.ai") {
      const { error } = await admin.auth.admin.updateUserById(ana.id, { email: "apastori@z3us.ai", email_confirm: true });
      if (error) throw error;
    }
    await admin.from("profiles").update({ email: "apastori@z3us.ai" }).eq("id", ana.id);
    log.push({ step: 3, id: ana.id, new_email: "apastori@z3us.ai" });

    // 4) metricas -> viewer
    const met = byEmail(us, "metricas@z3us.ai");
    if (!met) throw new Error("metricas@z3us.ai não encontrada");
    await setOnlyRole(met.id, "viewer");
    log.push({ step: 4, email: "metricas@z3us.ai", role: "viewer" });

    // 5) Contas de teste
    for (const e of ["test@example.com", "hunter@mailinator.com", "admin@z3us.ai"]) await inactivate(us, e);

    // Provas
    const proofs = [await proveLogin("larissa@z3us.ai"), await proveLogin("apastori@z3us.ai")];

    return Response.json({ ok: true, log, proofs });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message, log }, { status: 400 });
  }
});
