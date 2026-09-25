// Localiza o usuário "Painel de Métricas" (papel viewer) sem manter o e-mail no código.
// deno-lint-ignore no-explicit-any
export async function findMetricsUser(admin: any): Promise<{ id: string; email: string } | null> {
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "viewer");
  const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
  if (!ids.length) return null;
  const { data: profs } = await admin
    .from("profiles")
    .select("id,email,full_name")
    .in("id", ids)
    .eq("full_name", "Painel de Métricas");
  const p = profs?.[0];
  return p ? { id: p.id, email: p.email } : null;
}
