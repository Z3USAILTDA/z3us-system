import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getStoredAuthSession } from "@/lib/authSession";
import { Card, CardContent } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

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
  pts?: number | null;
  iniPrev?: string;
  iniReal?: string;
  fimPrev?: string;
  fimReal?: string;
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
const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const diffDays = (a?: string, b?: string) => {
  if (!a || !b) return 0;
  return Math.round(
    (new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000
  );
};
const fmtBR = (iso?: string) => (iso ? iso.split("-").reverse().join("/") : "—");

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

    // fallback: revalida periodicamente e ao voltar o foco (TV ligada por horas)
    const interval = window.setInterval(load, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
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

  const kpis = useMemo(() => {
    const hoje = todayISO();
    const done = tarefas.filter((t) => t.fimReal);
    const totalPts = tarefas.reduce((a, t) => a + (t.pts || 0), 0);
    const donePts = done.reduce((a, t) => a + (t.pts || 0), 0);
    const leads = done
      .map((t) => {
        const ini = t.iniReal || t.iniPrev;
        if (!ini) return null;
        const d = diffDays(t.fimReal, ini) + 1;
        return d >= 1 ? d : null;
      })
      .filter((n): n is number => n !== null);
    const leadAvg = leads.length ? (leads.reduce((a, b) => a + b, 0) / leads.length).toFixed(1) : "—";
    const atrasadasAbertas = tarefas.filter((t) => !t.fimReal && t.fimPrev && t.fimPrev < hoje);
    const onTime = done.filter((t) => !t.fimPrev || (t.fimReal as string) <= t.fimPrev).length;
    const baseAvaliada = done.length + atrasadasAbertas.length;
    const pct = baseAvaliada ? Math.round((onTime / baseAvaliada) * 100) : 0;
    let diasRest: string | number = "—";
    if (sprintAtual) {
      const d = diffDays(sprintAtual.fim, hoje);
      diasRest = d < 0 ? "Encerrada" : d;
    }
    return {
      done: done.length,
      total: tarefas.length,
      donePts,
      totalPts,
      leadAvg,
      leadConsiderados: leads.length,
      pct,
      diasRest,
    };
  }, [tarefas, sprintAtual]);

  const fasesData = STAGES.map((st) => ({
    name: st.label,
    value: tarefas.filter((t) => t.stage === st.id).length,
    color: st.color,
  })).filter((d) => d.value > 0);

  const burndown = useMemo(() => {
    if (!sprintAtual) return [];
    const totalPts = tarefas.reduce((a, t) => a + (t.pts || 0), 0);
    const days: string[] = [];
    const d = new Date(sprintAtual.inicio + "T00:00:00");
    const end = new Date(sprintAtual.fim + "T00:00:00");
    while (d <= end) {
      const p = (n: number) => String(n).padStart(2, "0");
      days.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
      d.setDate(d.getDate() + 1);
    }
    const hoje = todayISO();
    return days.map((day, i) => ({
      dia: day.split("-").slice(1).reverse().join("/"),
      ideal: +(totalPts * (1 - i / (days.length - 1 || 1))).toFixed(1),
      real:
        day > hoje
          ? null
          : totalPts -
            tarefas
              .filter((t) => t.fimReal && (t.fimReal as string) <= day)
              .reduce((a, t) => a + (t.pts || 0), 0),
    }));
  }, [sprintAtual, tarefas]);

  const grupoDaTarefa = (t: Tarefa) => {
    const p = db.projetos.find((x) => x.id === t.projetoId);
    const c = p ? db.clientes.find((x) => x.id === p.clienteId) : undefined;
    return { cliente: c?.nome || "Sem cliente", produto: p?.nome || "Sem produto" };
  };

  const colunas = STAGES.map((st) => {
    const list = tarefas.filter((t) => t.stage === st.id);
    const grupos = new Map<string, { cliente: string; produto: string; itens: Tarefa[] }>();
    list.forEach((t) => {
      const { cliente, produto } = grupoDaTarefa(t);
      const key = `${cliente}||${produto}`;
      const cur = grupos.get(key) || { cliente, produto, itens: [] };
      cur.itens.push(t);
      grupos.set(key, cur);
    });
    return {
      stage: st,
      total: list.length,
      grupos: [...grupos.values()].sort((a, b) => b.itens.length - a.itens.length),
    };
  });

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-4">
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

      <div className="grid gap-4 lg:grid-cols-[240px_1fr_1fr]">
        <div className="grid gap-4 content-start order-first">
          <Card className="bg-card/60 border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Atividades</p>
              <p className="text-2xl font-bold text-primary mt-1">{`${kpis.done}/${kpis.total}`}</p>
              <p className="text-[11px] text-muted-foreground">concluídas / total</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Nível de Esforço</p>
              <p className="text-2xl font-bold text-primary mt-1">{`${kpis.donePts}/${kpis.totalPts}`}</p>
              <p className="text-[11px] text-muted-foreground">entregues / planejados</p>
            </CardContent>
          </Card>
        </div>


        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4">
            <h2 className="font-semibold">Distribuição por fase</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {sprintAtual ? `Atividades da Sprint ${sprintNum(sprintAtual.nome)}` : "Todas as atividades"}
            </p>
            <div className="h-[180px]">
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
                <p className="text-sm text-muted-foreground text-center pt-24">
                  {loaded ? "Sem atividades nesta sprint" : "Carregando..."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4">
            <h2 className="font-semibold">Burndown da sprint</h2>
            <p className="text-xs text-muted-foreground mb-4">Atividades restantes · ideal vs. real</p>
            <div className="h-[110px]">
              {burndown.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={burndown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <RTooltip />
                    <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="6 5" dot={false} />
                    <Line type="monotone" dataKey="real" stroke="#2dd4bf" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center pt-20">
                  {loaded ? "Sem sprint em andamento" : "Carregando..."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

      </div>



      <div className="overflow-x-auto pb-2 -mt-2">
        <div className="flex gap-4 min-w-max">
          {colunas.map(({ stage, total, grupos }) => (
            <div
              key={stage.id}
              className="w-[340px] shrink-0 rounded-xl border border-border/60 bg-card/40 p-4 min-h-[280px]"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${stage.badge}`}>
                  {stage.label}
                </span>
                <span className="text-2xl font-bold text-foreground">{total}</span>
              </div>

              {grupos.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Sem atividades</p>
              )}

              {grupos.map(({ cliente, produto, itens }) => (
                <div
                  key={`${cliente}-${produto}`}
                  className="mb-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-primary truncate">{cliente}</span>
                      <span className="block text-xs text-muted-foreground truncate">{produto}</span>
                    </div>
                    <span className="text-xl font-bold text-foreground shrink-0">{itens.length}</span>
                  </div>
                  <ul className="space-y-1">
                    {itens.map((t) => (
                      <li key={t.id} className="text-[13px] leading-snug text-muted-foreground">
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
