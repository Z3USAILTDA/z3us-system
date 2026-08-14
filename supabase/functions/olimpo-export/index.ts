import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Comparação em tempo constante (evita timing attack no token)
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

async function sha256Prefix(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

const CLIENT_FIELDS =
  "id, company_name, cnpj, contact_name, email, status, created_at, updated_at";
const PROJECT_FIELDS =
  "id, title, client_id, status, priority, progress, area, sprint, responsible, demanda, start_date, end_date, actual_start_date, actual_end_date, project_manager_id, client_project_id, observation, created_at, updated_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return new Response(JSON.stringify({ erro: "metodo_nao_permitido" }), {
        status: 405,
        headers: jsonHeaders,
      });
    }

    const expected = Deno.env.get("OLIMPO_EXPORT_TOKEN") ?? "";
    const provided = req.headers.get("x-olimpo-token") ?? "";
    if (!expected || !provided || !safeEqual(provided, expected)) {
      const [esperadoSha8, recebidoSha8] = await Promise.all([
        sha256Prefix(expected),
        sha256Prefix(provided),
      ]);
      return new Response(JSON.stringify({
        erro: "nao_autorizado",
        diag: {
          esperado_definido: expected.length > 0,
          esperado_len: expected.length,
          recebido_len: provided.length,
          esperado_sha8: esperadoSha8,
          recebido_sha8: recebidoSha8,
          headers_recebidos: Array.from(req.headers.keys()).map((name) => name.toLowerCase()),
        },
      }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    // Filtro incremental opcional
    const url = new URL(req.url);
    const desdeRaw = url.searchParams.get("desde");
    let desde: string | null = null;
    if (desdeRaw) {
      const parsed = new Date(desdeRaw);
      if (isNaN(parsed.getTime())) {
        return new Response(
          JSON.stringify({ erro: "parametro_desde_invalido" }),
          { status: 400, headers: jsonHeaders },
        );
      }
      desde = parsed.toISOString();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    let clientsQuery = supabase
      .from("clients")
      .select(CLIENT_FIELDS)
      .order("company_name", { ascending: true });
    let projectsQuery = supabase
      .from("projects")
      .select(PROJECT_FIELDS)
      .order("created_at", { ascending: true });

    if (desde) {
      clientsQuery = clientsQuery.gte("updated_at", desde);
      projectsQuery = projectsQuery.gte("updated_at", desde);
    }

    const [clients, projects, clientProjects, teams, docs] = await Promise.all([
      clientsQuery,
      projectsQuery,
      supabase
        .from("client_projects")
        .select("id, client_id, name, description")
        .order("name", { ascending: true }),
      supabase
        .from("teams")
        .select("id, name, role, status")
        .order("name", { ascending: true }),
      supabase.from("project_documents").select("project_id, updated_at"),
    ]);

    for (const r of [clients, projects, clientProjects, teams, docs]) {
      if (r.error) throw new Error("falha_ao_consultar_dados");
    }

    // Agregado de documentos por projeto (sem file_url/file_name)
    const resumoMap = new Map<string, { total: number; ultima_versao_em: string | null }>();
    for (const d of (docs.data ?? []) as Array<{ project_id: string; updated_at: string | null }>) {
      const atual = resumoMap.get(d.project_id) ?? { total: 0, ultima_versao_em: null };
      atual.total += 1;
      if (d.updated_at && (!atual.ultima_versao_em || d.updated_at > atual.ultima_versao_em)) {
        atual.ultima_versao_em = d.updated_at;
      }
      resumoMap.set(d.project_id, atual);
    }
    const documents_resumo = Array.from(resumoMap.entries()).map(
      ([project_id, v]) => ({ project_id, total: v.total, ultima_versao_em: v.ultima_versao_em }),
    );

    const body = {
      gerado_em: new Date().toISOString(),
      clients: clients.data ?? [],
      projects: projects.data ?? [],
      client_projects: clientProjects.data ?? [],
      teams: teams.data ?? [],
      documents_resumo,
      contagens: {
        clients: clients.data?.length ?? 0,
        projects: projects.data?.length ?? 0,
        teams: teams.data?.length ?? 0,
      },
    };

    return new Response(JSON.stringify(body), { status: 200, headers: jsonHeaders });
  } catch (_e) {
    return new Response(JSON.stringify({ erro: "erro_interno" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
