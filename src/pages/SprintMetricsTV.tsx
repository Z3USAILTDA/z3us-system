import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getStoredAuthSession } from "@/lib/authSession";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from "recharts";

type Stage = "backlog" | "todo" | "dev" | "homolog" | "done";

const STAGES: { id: Stage; label: string; color: string; badge: string }[] = [
  { id: "backlog", label: "Backlog da Sprint", color: "#94a3b8", badge: "bg-slate-400/15 text-slate-300" },
  { id: "todo", label: "A Fazer", color: "#a78bfa", badge: "bg-violet-400/15 text-violet-300" },
  { id: "dev", label: "Desenvolvimento", color: "#60a5fa", badge: "bg-blue-400/15 text-blue-300" },
  { id: "homolog", label: "Homologação", color: "#fbbf24", badge: "bg-amber-400/15 text-amber-300" },
  { id: "done", label: "Produção", color: "#34d399", badge: "bg-emerald-400/15 text-emerald-300" },
];

interface Tarefa {
  id: string;
  projetoId: string;
  sprintId: string;
  titulo: string;
  stage: Stage;
}
interface Sprint {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  encerrada?: boolean;
}
interface DB {
  clientes: { id: string; nome: string }[];
  projetos: { id: string; nome: string; clienteId: string }[];
  sprints: Sprint[];
  tarefas: Tarefa[];
}

const emptyDb: DB = { clientes: [], projetos: [], sprints: [], tarefas: [] };
const sprintNum = (nome?: string) => (nome || "").replace(/sprint/gi, "").trim();

export default function SprintMetricsTV() {
  const navigate = useNavigate();
  const [db, setDb] = useState<DB>(emptyDb);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!getStoredAuthSession()?.access_token) navigate("/auth", { replace: true });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("sprint_board")
        .select("data")
        .eq("id", "main")
        .maybeSingle();
      if (cancelled) return;
      setDb({ ...emptyDb, ...((data?.data as DB) || {}) });
      setLoaded(true);
    };
    load();

    const channel = supabase
      .channel("sprint-tv-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sprint_board", filter: "id=eq.main" },
        (payload: any) => {
          const incoming = payload.new?.data as DB | undefined;
          if (incoming) setDb({ ...emptyDb, ...incoming });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const sprintAtual = useMemo(() => {
    const abertas = db.sprints.filter((s) => !s.encerrada);
    return [...abertas].sort(
      (a, b) => Number(sprintNum(b.nome) || 0) - Number(sprintNum(a.nome) || 0)
    )[0];
  }, [db.sprints]);

  const tarefas = useMemo(
    () => (sprintAtual ? db.tarefas.filter((t) => t.sprintId === sprintAtual.id) : db.tarefas),
    [db.tarefas, sprintAtual]
  );

  const fasesData = STAGES.map((st) => ({
    name: st.label,
    value: tarefas.filter((t) => t.stage === st.id).length,
    color: st.color,
  })).filter((d) => d.value > 0);

  const clienteDoTarefa = (t: Tarefa) => {
    const p = db.projetos.find((x) => x.id === t.projetoId);
    const c = p ? db.clientes.find((x) => x.id === p.clienteId) : undefined;
    return c?.nome || "Sem cliente";
  };

  const colunas = STAGES.map((st) => {
    const list = tarefas.filter((t) => t.stage === st.id);
    const grupos = new Map<string, Tarefa[]>();
    list.forEach((t) => {
      const nome = clienteDoTarefa(t);
      grupos.set(nome, [...(grupos.get(nome) || []), t]);
    });
    return {
      stage: st,
      total: list.length,
      grupos: [...grupos.entries()].sort((a, b) => b[1].length - a[1].length),
    };
  });

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Métricas Sprint TV</h1>
          <p className="text-sm text-muted-foreground">
            {sprintAtual
              ? `Sprint ${sprintNum(sprintAtual.nome)} em andamento · ${tarefas.length} atividades`
              : "Todas as atividades"}
          </p>
        </div>
      </header>

      <Card className="bg-card/60 border-border/60">
        <CardContent className="p-5">
          <h2 className="font-semibold">Distribuição por fase</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {sprintAtual ? `Atividades da Sprint ${sprintNum(sprintAtual.nome)}` : "Todas as atividades"}
          </p>
          <div className="h-[320px]">
            {fasesData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fasesData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {fasesData.map((d) => (
                      <Cell key={d.name} fill={d.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <RTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-28">
                {loaded ? "Sem atividades nesta sprint" : "Carregando..."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {colunas.map(({ stage, total, grupos }) => (
            <div
              key={stage.id}
              className="w-[260px] shrink-0 rounded-xl border border-border/60 bg-card/40 p-3 min-h-[200px]"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${stage.badge}`}>
                  {stage.label}
                </span>
                <span className="text-xs text-muted-foreground">{total}</span>
              </div>

              {grupos.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Sem atividades</p>
              )}

              {grupos.map(([cliente, itens]) => (
                <div key={cliente} className="mb-3 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-primary truncate">{cliente}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {itens.length}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {itens.map((t) => (
                      <li key={t.id} className="text-[11px] leading-snug text-muted-foreground truncate">
                        • {t.titulo}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
