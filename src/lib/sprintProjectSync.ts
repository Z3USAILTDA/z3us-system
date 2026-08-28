import { supabase } from "@/integrations/supabase/client";

export type SprintStage = "backlog" | "todo" | "dev" | "homolog" | "done";

/** Fase do quadro de sprints -> status do módulo Projetos */
export const stageToStatus = (stage: SprintStage): string => {
  switch (stage) {
    case "dev":
      return "in_progress";
    case "homolog":
      return "test";
    case "done":
      return "completed";
    default:
      return "planning"; // backlog e "a fazer"
  }
};

/** Progresso sugerido por fase (única diferença em relação à gestão de sprints) */
export const stageToProgress = (stage: SprintStage): number => {
  switch (stage) {
    case "dev":
      return 50;
    case "homolog":
      return 80;
    case "done":
      return 100;
    default:
      return 0;
  }
};

export interface SprintTaskSyncPayload {
  titulo: string;
  desc?: string;
  cliente?: string;
  projeto?: string;
  sprint?: string;
  dev?: string;
  stage: SprintStage;
  iniPrev?: string;
  fimPrev?: string;
  iniReal?: string;
  fimReal?: string;
  /** título anterior, quando a atividade foi renomeada */
  tituloAnterior?: string;
}

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

/** Nomes usados na Gestão de Sprints -> razão social cadastrada em Clientes */
const CLIENTE_ALIAS: Record<string, string> = {
  "ags global logistic": "AGS Global Logistics",
  bewex: "Bewex Solutions Sistemas Ltda",
  dascher: "Dachser",
  z3us: "Z3US.ai",
};

const resolveCliente = (nome: string) => CLIENTE_ALIAS[nome.toLowerCase()] ?? nome;

/**
 * Espelha uma atividade da Gestão de Sprints no módulo Projetos.
 * Nunca lança erro — falhas são apenas registradas no console.
 */
export const syncTarefaToProjeto = async (t: SprintTaskSyncPayload): Promise<void> => {
  try {
    const titulo = clean(t.titulo);
    const nomeCliente = clean(t.cliente);
    if (!titulo || !nomeCliente) return;

    // cliente correspondente no cadastro de Clientes
    const { data: cli } = await supabase
      .from("clients")
      .select("id")
      .ilike("company_name", resolveCliente(nomeCliente))
      .limit(1)
      .maybeSingle();
    if (!cli?.id) return;

    // projeto do cliente (categoria) — cria se necessário
    let clientProjectId: string | null = null;
    const nomeProjeto = clean(t.projeto);
    if (nomeProjeto) {
      const { data: cp } = await supabase
        .from("client_projects")
        .select("id")
        .eq("client_id", cli.id)
        .ilike("name", nomeProjeto)
        .limit(1)
        .maybeSingle();
      if (cp?.id) clientProjectId = cp.id;
      else {
        const { data: novo } = await supabase
          .from("client_projects")
          .insert({ client_id: cli.id, name: nomeProjeto })
          .select("id")
          .maybeSingle();
        clientProjectId = novo?.id ?? null;
      }
    }

    const status = stageToStatus(t.stage);
    const progress = stageToProgress(t.stage);

    const dados = {
      title: titulo,
      description: clean(t.desc),
      client_id: cli.id,
      client_project_id: clientProjectId,
      status,
      progress,
      sprint: clean(t.sprint),
      responsible: clean(t.dev),
      start_date: clean(t.iniPrev),
      end_date: clean(t.fimPrev),
      actual_start_date: clean(t.iniReal),
      actual_end_date: status === "completed" ? clean(t.fimReal) || clean(t.fimPrev) : clean(t.fimReal),
    };

    // localiza o projeto espelhado (por título anterior ou atual, dentro do cliente)
    const alvo = clean(t.tituloAnterior) || titulo;
    const { data: existente } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", cli.id)
      .ilike("title", alvo)
      .limit(1)
      .maybeSingle();

    if (existente?.id) {
      await supabase.from("projects").update(dados).eq("id", existente.id);
    } else {
      await supabase.from("projects").insert({ ...dados, priority: "medium" });
    }
  } catch (e) {
    console.warn("Falha ao sincronizar atividade com Projetos", e);
  }
};
