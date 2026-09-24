import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const email = `rls-test-${crypto.randomUUID().slice(0, 8)}@mailinator.com`;
  const password = crypto.randomUUID() + "Aa1!";
  const out: any = { email };
  const { data: c } = await admin.from("clients").select("id, company_name").eq("company_name", "4LIFE RESEARCH BRASIL LTDA").single();
  const { data: u, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return new Response(JSON.stringify({ error: error.message }));
  try {
    await admin.from("client_users").insert({ client_id: c!.id, user_id: u.user.id });
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    out.cliente_vinculado = c!.company_name; out.papel = role;
    const cli = createClient(url, anonKey);
    await cli.auth.signInWithPassword({ email, password });
    const { data: docs } = await cli.from("project_documents").select("id, title, visibility");
    out.docs_visiveis = docs;
    const { data: all } = await admin.from("project_documents").select("file_url, visibility, projects(client_id)");
    const internal = all!.find((d: any) => d.visibility === "internal");
    const other = all!.find((d: any) => d.projects.client_id !== c!.id);
    out.storage_interno = (await cli.storage.from("documents").createSignedUrl(internal!.file_url, 60)).error?.message ?? "ACESSOU";
    out.storage_outro_cliente = (await cli.storage.from("documents").createSignedUrl(other!.file_url, 60)).error?.message ?? "ACESSOU";
  } finally {
    await admin.from("client_users").delete().eq("user_id", u.user.id);
    const del = await admin.auth.admin.deleteUser(u.user.id);
    out.usuario_apagado = !del.error;
  }
  return new Response(JSON.stringify(out, null, 2));
});
