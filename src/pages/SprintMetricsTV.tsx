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

// Logos oficiais enviadas pelo cliente
import logoAgs from "@/assets/logos/logo-ags.avif.asset.json";
import logoAmazon from "@/assets/logos/logo-amazon.png.asset.json";
import logoAndreani from "@/assets/logos/logo-andreani.png.asset.json";
import logoBrasmeg from "@/assets/logos/logo-brasmeg.png.asset.json";
import logoDachser from "@/assets/logos/logo-dachser.svg.asset.json";
import logoFm from "@/assets/logos/logo-fm.png.asset.json";
import logoHandline from "@/assets/logos/logo-handline.png.asset.json";
import logoMorada from "@/assets/logos/logo-morada_madalena.png.asset.json";
import logoOlli from "@/assets/logos/logo-olli_sementes.png.asset.json";
import logoProton from "@/assets/logos/logo-proton.png.asset.json";
import logoRd from "@/assets/logos/logo-r_d.png.asset.json";
import logoSigraweb from "@/assets/logos/logo-sigraweb.png.asset.json";
import logoUni from "@/assets/logos/logo-uni.webp.asset.json";
import logoLuft from "@/assets/logos/logo-luft.png.asset.json";
import logoZ3us from "@/assets/logos/logo-z3us.jpg.asset.json";

const CLIENTE_LOGO: { match: string; url: string }[] = [
  { match: "unitrading", url: logoUni.url },
  { match: "uni trading", url: logoUni.url },
  { match: "amazon", url: logoAmazon.url },
  { match: "andreani", url: logoAndreani.url },
  { match: "brasmeg", url: logoBrasmeg.url },
  { match: "dachser", url: logoDachser.url },
  { match: "dasch", url: logoDachser.url },
  { match: "handline", url: logoHandline.url },
  { match: "morada", url: logoMorada.url },
  { match: "olli", url: logoOlli.url },
  { match: "proton", url: logoProton.url },
  { match: "sigraweb", url: logoSigraweb.url },
  { match: "sigra", url: logoSigraweb.url },
  { match: "luft", url: logoLuft.url },
  { match: "ags", url: logoAgs.url },
  { match: "r&d", url: logoRd.url },
  { match: "fm ", url: logoFm.url },
  { match: "z3us", url: logoZ3us.url },
];

const logoCliente = (nome: string) => {
  const n = (nome || "").toLowerCase();
  return CLIENTE_LOGO.find((c) => n.includes(c.match))?.url;
};

const ClienteLogo = ({ nome }: { nome: string }) => {
  const url = logoCliente(nome);
  const [erro, setErro] = useState(false);
  if (!url || erro) {
    return (
      <span className="size-7 shrink-0 rounded-md bg-primary/15 text-primary text-[11px] font-bold grid place-items-center">
        {(nome || "?").trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="size-8 shrink-0 rounded-md bg-[hsl(222_47%_8%)] ring-1 ring-primary/20 grid place-items-center overflow-hidden">
      <img
        src={url}
        alt={`Logo ${nome}`}
        loading="lazy"
        onError={() => setErro(true)}
        className="size-full object-contain p-0.5"
      />
    </span>
  );
};




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

  const renderColuna = ({ stage, total, grupos }: (typeof colunas)[number]) => (
    <div
      key={stage.id}
      className="w-[340px] shrink-0 rounded-xl border border-border/60 bg-card/40 p-4 min-h-[240px]"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${stage.badge}`}>{stage.label}</span>
        <span className="text-2xl font-bold text-foreground">{total}</span>
      </div>

      {grupos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">Sem atividades</p>
      )}

      {grupos.map(({ cliente, produto, itens }) => (
        <div
          key={`${cliente}-${produto}`}
          className="mb-3 rounded-xl border border-border/70 bg-gradient-to-b from-card to-card/60 p-3 shadow-sm transition-colors hover:border-primary/40"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <ClienteLogo nome={cliente} />
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-foreground truncate">{cliente}</span>
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground truncate">
                  {produto}
                </span>
              </div>
            </div>
            <span className="shrink-0 min-w-7 h-7 px-2 rounded-full bg-primary/10 text-primary text-sm font-bold grid place-items-center">
              {itens.length}
            </span>
          </div>
          <ul className="mt-2 pt-2 border-t border-border/60 space-y-1">
            {itens.map((t) => (
              <li
                key={t.id}
                className="text-[13px] leading-snug text-muted-foreground pl-3 relative before:absolute before:left-0 before:top-[0.5em] before:size-1.5 before:rounded-full before:bg-primary/50"
              >
                {t.titulo}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );


  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-2">
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

      <div className="overflow-x-auto pb-2">
        <div className="flex flex-col gap-4 min-w-max">
          {/* Linha superior: KPIs + gráficos */}
          <div className="flex gap-4 items-stretch">
            <div className="w-[340px] shrink-0 flex flex-col gap-3">
              <Card className="bg-card/60 border-border/60 min-w-0 flex-1">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground truncate">Atividades</p>
                  <p className="text-3xl font-bold text-primary mt-1 truncate">{`${kpis.done}/${kpis.total}`}</p>
                  <p className="text-xs text-muted-foreground truncate">concluídas / total</p>
                </CardContent>
              </Card>
              <Card className="bg-card/60 border-border/60 min-w-0 flex-1">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground truncate">Nível de Esforço</p>
                  <p className="text-3xl font-bold text-primary mt-1 truncate">{`${kpis.donePts}/${kpis.totalPts}`}</p>
                  <p className="text-xs text-muted-foreground truncate">entregues / planejados</p>
                </CardContent>
              </Card>
            </div>

              <Card className="bg-card/60 border-border/60 w-[696px] shrink-0">
                <CardContent className="p-3">
                  <h2 className="font-semibold text-center">Distribuição por fase</h2>
                  <p className="text-xs text-muted-foreground mb-2 text-center">
                    {sprintAtual ? `Atividades da Sprint ${sprintNum(sprintAtual.nome)}` : "Todas as atividades"}
                  </p>
                  <div className="relative h-[150px]">
                    {fasesData.length ? (
                      <>
                        <div className="absolute left-1 top-1/2 z-10 -translate-y-1/2 space-y-0.5 text-[10px] leading-[14px]">
                          {fasesData.map((fase) => (
                            <div key={fase.name} className="flex items-center gap-1.5 whitespace-nowrap">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: fase.color }}
                              />
                              <span>{fase.name}</span>
                            </div>
                          ))}
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={fasesData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              innerRadius="62%"
                              outerRadius="98%"
                              paddingAngle={2}
                            >
                              {fasesData.map((d) => (
                                <Cell key={d.name} fill={d.color} stroke="transparent" />
                              ))}
                            </Pie>
                            <RTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center pt-16">
                        {loaded ? "Sem atividades nesta sprint" : "Carregando..."}
                      </p>
                    )}
                  </div>
                </CardContent>


              </Card>

              <Card className="bg-card/60 border-border/60 w-[696px] shrink-0">
                <CardContent className="p-3">
                  <h2 className="font-semibold text-center">Burndown da sprint</h2>
                  <p className="text-xs text-muted-foreground mb-2 text-center">Atividades restantes · ideal vs. real</p>
                  <div className="h-[150px]">
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
                      <p className="text-sm text-muted-foreground text-center pt-12">
                        {loaded ? "Sem sprint em andamento" : "Carregando..."}
                      </p>
                    )}
                  </div>
                </CardContent>
            </Card>
          </div>

          <div className="flex gap-4 items-start">
            {colunas.map((c) => renderColuna(c))}
          </div>
        </div>

      </div>
    </div>
  );
}
