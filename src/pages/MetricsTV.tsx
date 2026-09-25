import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  TrendingUp,
  Trophy,
  Users as UsersIcon,
  Calendar,
  Target,
  Zap,
} from "lucide-react";
import { getTodayLocalDate, formatDateBR } from "@/lib/utils";
import { clearAuthStorage, getStoredAuthSession, hasUsableStoredSession } from "@/lib/authSession";
import TvPinGate, { TV_SESSION_KEY, TV_SESSION_MS } from "@/components/TvPinGate";

// ----- Types -----
interface Project {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  start_date: string | null;
  end_date: string | null;
  actual_end_date: string | null;
  progress: number | null;
  responsible: string | null;
  project_manager_id: string | null;
  created_at: string;
  updated_at: string;
  client_id: string;
  client_project_id: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface Client {
  id: string;
  company_name: string;
}

interface ClientProject {
  id: string;
  client_id: string;
  name: string;
}


// ----- Constants -----
const STATUS_META: Record<string, { label: string; color: string }> = {
  planning: { label: "A iniciar", color: "hsl(var(--primary))" },
  in_progress: { label: "Em andamento", color: "hsl(var(--warning))" },
  waiting_client: { label: "Aguardando cliente", color: "hsl(var(--primary))" },
  on_hold: { label: "Pausado", color: "hsl(var(--muted-foreground))" },
  test: { label: "Teste", color: "hsl(var(--primary))" },
  completed: { label: "Concluído", color: "hsl(var(--success))" },
  cancelled: { label: "Cancelado", color: "hsl(var(--destructive))" },
  overdue: { label: "Atrasado", color: "hsl(var(--destructive))" },
};

const NON_OVERDUE_STATUSES = new Set([
  "completed",
  "waiting_client",
  "test",
  "on_hold",
  "cancelled",
]);

const isOverdue = (p: Project, today: string) =>
  !!p.end_date && p.end_date < today && !NON_OVERDUE_STATUSES.has(p.status);

// Usuários inativos — não devem aparecer em métricas/rankings
const INACTIVE_USERS = new Set(["Willian Renato", "Nicolas Freitas"]);
const isInactiveUser = (name: string) => INACTIVE_USERS.has(name.trim());

const daysBetween = (a: string, b: string) => {
  const d1 = new Date(a + "T00:00:00").getTime();
  const d2 = new Date(b + "T00:00:00").getTime();
  return Math.round((d2 - d1) / 86400000);
};

// ----- Small UI -----
const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md shadow-lg p-5 ${className}`}
  >
    {children}
  </div>
);

const KpiCard = ({
  icon: Icon,
  label,
  value,
  accent = "primary",
  hint,
  className = "",
}: {
  icon: any;
  label: string;
  value: string | number;
  accent?: string;
  hint?: string;
  className?: string;
}) => (
  <Card className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 ${className}`}>
    <div
      className="rounded-lg p-1.5 sm:p-2 shrink-0"
      style={{ background: `hsl(var(--${accent}) / 0.15)` }}
    >
      <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: `hsl(var(--${accent}))` }} />
    </div>
    <div className="min-w-0">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">
        {label}
      </div>
      <div className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold leading-tight tabular-nums num">
        {value}
      </div>
      {hint && <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight truncate">{hint}</div>}
    </div>
  </Card>
);

const StatusDot = ({ color }: { color: string }) => (
  <span
    className="inline-block w-2.5 h-2.5 rounded-full"
    style={{ backgroundColor: color }}
  />
);

// ----- Main page -----
const MetricsTV = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientProjects, setClientProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [authed, setAuthed] = useState(false);

  // Auth gate: exige sessão do usuário de métricas (válida há <24h)
  useEffect(() => {
    const session = getStoredAuthSession();
    const loginAtStr = localStorage.getItem(TV_SESSION_KEY);
    const loginAt = loginAtStr ? parseInt(loginAtStr, 10) : 0;
    const expired = !loginAt || Date.now() - loginAt > TV_SESSION_MS;

    if (session && hasUsableStoredSession() && !expired) {
      setAuthed(true);
      return;
    }
    clearAuthStorage();
    localStorage.removeItem(TV_SESSION_KEY);
    setAuthed(false);
    setLoading(false);
  }, []);


  const fetchData = async () => {
    const [pj, pf, cl, cp] = await Promise.all([
      supabase
        .from("projects")
        .select(
          "id,title,status,priority,start_date,end_date,actual_end_date,progress,responsible,project_manager_id,created_at,updated_at,client_id,client_project_id"
        ),
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("clients").select("id,company_name"),
      (supabase as any).from("client_projects").select("id,client_id,name"),
    ]);
    if (pj.data) setProjects(pj.data as any);
    if (pf.data) setProfiles(pf.data as Profile[]);
    if (cl.data) setClients(cl.data as Client[]);
    if (cp.data) setClientProjects(cp.data as ClientProject[]);
    setLastUpdate(new Date());
    setLoading(false);
  };


  useEffect(() => {
    if (!authed) return;
    fetchData();
    const dataInterval = setInterval(fetchData, 60_000);
    const clockInterval = setInterval(() => setNow(new Date()), 1_000);
    // Verifica expiração 24h a cada minuto
    const expiryInterval = setInterval(() => {
      const loginAt = parseInt(localStorage.getItem(TV_SESSION_KEY) || "0", 10);
      if (!loginAt || Date.now() - loginAt > TV_SESSION_MS) {
        localStorage.removeItem(TV_SESSION_KEY);
        clearAuthStorage();
        setAuthed(false);
      }
    }, 60_000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(clockInterval);
      clearInterval(expiryInterval);
    };
  }, [authed]);

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const clientMap = useMemo(() => {
    const m = new Map<string, Client>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const clientProjectMap = useMemo(() => {
    const m = new Map<string, ClientProject>();
    clientProjects.forEach((c) => m.set(c.id, c));
    return m;
  }, [clientProjects]);


  const today = getTodayLocalDate();

  // Resolve responsible name (project_manager_id -> profile, else responsible text, else "Sem responsável")
  const responsibleName = (p: Project): string => {
    if (p.project_manager_id) {
      const pr = profileMap.get(p.project_manager_id);
      if (pr) return pr.full_name || pr.email;
    }
    if (p.responsible && p.responsible.trim()) return p.responsible;
    return "Sem responsável";
  };

  // ----- Aggregations -----
  const metrics = useMemo(() => {
    const total = projects.length;
    const byStatus: Record<string, number> = {};
    let active = 0;
    let completed = 0;
    let overdue = 0;
    let completedThisMonth = 0;
    let completedLastMonth = 0;
    let onTimeDeliveries = 0;
    let lateDeliveries = 0;
    let durationSum = 0;
    let durationCount = 0;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = monthStart;

    projects.forEach((p) => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      if (p.status === "completed") {
        completed++;
        const endRef = p.actual_end_date || p.end_date;
        if (endRef) {
          const d = new Date(endRef + "T00:00:00");
          if (d >= monthStart) completedThisMonth++;
          else if (d >= lastMonthStart && d < lastMonthEnd)
            completedLastMonth++;
        }
        if (p.actual_end_date && p.end_date) {
          if (p.actual_end_date <= p.end_date) onTimeDeliveries++;
          else lateDeliveries++;
        }
        if (p.start_date && (p.actual_end_date || p.end_date)) {
          const d = daysBetween(p.start_date, p.actual_end_date || p.end_date!);
          if (d >= 0) {
            durationSum += d;
            durationCount++;
          }
        }
      } else if (p.status !== "cancelled") {
        active++;
      }
      if (isOverdue(p, today)) overdue++;
    });

    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const onTimeRate =
      onTimeDeliveries + lateDeliveries
        ? Math.round(
            (onTimeDeliveries / (onTimeDeliveries + lateDeliveries)) * 100
          )
        : 0;
    const avgDuration = durationCount
      ? Math.round(durationSum / durationCount)
      : 0;

    return {
      total,
      active,
      completed,
      overdue,
      completedThisMonth,
      completedLastMonth,
      completionRate,
      onTimeRate,
      avgDuration,
      byStatus,
    };
  }, [projects, now, today]);

  // Status pie data
  const statusPieData = useMemo(() => {
    const arr = Object.entries(metrics.byStatus).map(([k, v]) => ({
      name: STATUS_META[k]?.label || k,
      value: v,
      color: STATUS_META[k]?.color || "hsl(var(--muted-foreground))",
      key: k,
    }));
    // adiciona "atrasado" virtual (não sobrepõe — apenas referência separada)
    return arr.sort((a, b) => b.value - a.value);
  }, [metrics]);

  // Delayed projects (ordered by days overdue desc)
  const delayedProjects = useMemo(() => {
    return projects
      .filter((p) => isOverdue(p, today))
      .map((p) => ({
        p,
        daysLate: daysBetween(p.end_date!, today),
      }))
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [projects, today]);

  const mostCritical = delayedProjects[0];

  // Recent completions this month
  const recentCompletions = useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return projects
      .filter((p) => {
        if (p.status !== "completed") return false;
        const endRef = p.actual_end_date || p.end_date;
        if (!endRef) return false;
        return new Date(endRef + "T00:00:00") >= monthStart;
      })
      .sort((a, b) => {
        const ea = a.actual_end_date || a.end_date || "";
        const eb = b.actual_end_date || b.end_date || "";
        return eb.localeCompare(ea);
      })
      .slice(0, 8);
  }, [projects, now]);

  // Weekly evolution within current month
  const weeklyDeliveries = useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const buckets: { name: string; entregues: number }[] = [
      { name: "Sem 1", entregues: 0 },
      { name: "Sem 2", entregues: 0 },
      { name: "Sem 3", entregues: 0 },
      { name: "Sem 4", entregues: 0 },
      { name: "Sem 5", entregues: 0 },
    ];
    projects.forEach((p) => {
      if (p.status !== "completed") return;
      const endRef = p.actual_end_date || p.end_date;
      if (!endRef) return;
      const d = new Date(endRef + "T00:00:00");
      if (d < monthStart) return;
      const week = Math.min(4, Math.floor((d.getDate() - 1) / 7));
      buckets[week].entregues++;
    });
    return buckets;
  }, [projects, now]);

  // 6-month evolution
  const monthlyEvolution = useMemo(() => {
    const months: {
      name: string;
      criados: number;
      concluidos: number;
      atrasados: number;
    }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: d.toLocaleDateString("pt-BR", { month: "short" }),
        criados: 0,
        concluidos: 0,
        atrasados: 0,
      });
    }
    const baseMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const idxOf = (d: Date) =>
      (d.getFullYear() - baseMonth.getFullYear()) * 12 +
      (d.getMonth() - baseMonth.getMonth());

    projects.forEach((p) => {
      const created = new Date(p.created_at);
      const ci = idxOf(created);
      if (ci >= 0 && ci < 6) months[ci].criados++;

      if (p.status === "completed") {
        const endRef = p.actual_end_date || p.end_date;
        if (endRef) {
          const ed = new Date(endRef + "T00:00:00");
          const ei = idxOf(ed);
          if (ei >= 0 && ei < 6) months[ei].concluidos++;
          if (p.end_date && p.actual_end_date && p.actual_end_date > p.end_date) {
            if (ei >= 0 && ei < 6) months[ei].atrasados++;
          }
        }
      }
    });
    return months;
  }, [projects, now]);

  // Per-user stats (apenas responsáveis — ignora project_manager)
  const userStats = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        total: number;
        completed: number;
        inProgress: number;
        overdue: number;
      }
    >();
    projects.forEach((p) => {
      const name = (p.responsible || "").trim();
      if (!name) return;
      if (isInactiveUser(name)) return;
      const cur =
        map.get(name) || {
          name,
          total: 0,
          completed: 0,
          inProgress: 0,
          overdue: 0,
        };
      cur.total++;
      if (p.status === "completed") cur.completed++;
      else if (p.status === "in_progress") cur.inProgress++;
      if (isOverdue(p, today)) cur.overdue++;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [projects, today]);

  const topUsers = userStats.slice(0, 8);
  const totalProjectsForPct = userStats.reduce((s, u) => s + u.total, 0) || 1;

  // Ranking projects: by progress desc + status weight
  const projectRanking = useMemo(() => {
    const score = (p: Project) => {
      let s = p.progress ?? 0;
      if (p.status === "completed") s += 100;
      if (p.status === "in_progress") s += 30;
      if (isOverdue(p, today)) s -= 50;
      return s;
    };
    return [...projects]
      .filter((p) => p.status !== "cancelled")
      .sort((a, b) => score(b) - score(a))
      .slice(0, 10);
  }, [projects, today]);

  // Distribuição por projeto (categoria) dentro de cada cliente
  const clientProjectStats = useMemo(() => {
    type Entry = { clientName: string; total: number; projects: Map<string, number> };
    const byClient = new Map<string, Entry>();
    projects.forEach((p) => {
      if (p.status === "cancelled") return;
      const clientName = clientMap.get(p.client_id)?.company_name || "—";
      if (!byClient.has(p.client_id)) {
        byClient.set(p.client_id, { clientName, total: 0, projects: new Map() });
      }
      const cb = byClient.get(p.client_id)!;
      cb.total++;
      const projName = p.client_project_id
        ? clientProjectMap.get(p.client_project_id)?.name || "—"
        : "Sem projeto";
      cb.projects.set(projName, (cb.projects.get(projName) || 0) + 1);
    });
    return Array.from(byClient.values())
      .sort((a, b) => b.total - a.total)
      .map((c) => ({
        clientName: c.clientName,
        total: c.total,
        projects: Array.from(c.projects.entries())
          .map(([name, count]) => ({
            name,
            count,
            pct: c.total ? Math.round((count / c.total) * 100) : 0,
          }))
          .sort((a, b) => b.count - a.count),
      }));
  }, [projects, clientMap, clientProjectMap]);



  // Alerts
  const alerts = useMemo(() => {
    const list: { icon: any; text: string; tone: string }[] = [];
    if (metrics.overdue > 0)
      list.push({
        icon: AlertTriangle,
        text: `${metrics.overdue} projeto(s) com prazo vencido`,
        tone: "destructive",
      });
    const noResp = projects.filter(
      (p) =>
        !p.project_manager_id &&
        (!p.responsible || !p.responsible.trim()) &&
        p.status !== "completed" &&
        p.status !== "cancelled"
    ).length;
    if (noResp > 0)
      list.push({
        icon: UsersIcon,
        text: `${noResp} projeto(s) ativos sem responsável`,
        tone: "warning",
      });

    // Próximos do vencimento (7 dias)
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toLocaleDateString("en-CA");
    const upcoming = projects.filter(
      (p) =>
        p.end_date &&
        p.end_date >= today &&
        p.end_date <= in7Str &&
        !NON_OVERDUE_STATUSES.has(p.status)
    ).length;
    if (upcoming > 0)
      list.push({
        icon: Clock,
        text: `${upcoming} projeto(s) vencem nos próximos 7 dias`,
        tone: "warning",
      });

    // Sem atualização há +14 dias
    const stale = projects.filter((p) => {
      if (p.status === "completed" || p.status === "cancelled") return false;
      const updated = new Date(p.updated_at);
      const diff = (now.getTime() - updated.getTime()) / 86400000;
      return diff > 14;
    }).length;
    if (stale > 0)
      list.push({
        icon: Zap,
        text: `${stale} projeto(s) sem atualização há mais de 14 dias`,
        tone: "info",
      });

    return list;
  }, [projects, metrics, now, today]);

  if (!authed) {
    return (
      <TvPinGate
        title="Painel de Métricas"
        onSuccess={() => {
          setLoading(true);
          setAuthed(true);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">
            Carregando métricas...
          </p>
        </div>
      </div>
    );
  }

  const monthDelta = metrics.completedThisMonth - metrics.completedLastMonth;

  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden tech-grid">
      <div className="h-full w-full p-2 sm:p-3 lg:p-4 flex flex-col gap-2 sm:gap-3 min-h-0">
        {/* Header */}
        <header className="shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className="rounded-xl p-2 glow-primary shrink-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold tracking-tight truncate">
                Métricas de Projetos
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                Painel executivo em tempo real
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold tabular-nums leading-none num">
              {now.toLocaleTimeString("pt-BR")}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              {now.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </div>
          </div>
        </header>

        {/* KPI strip */}
        <section className="shrink-0 grid gap-2 sm:gap-3 grid-cols-3 sm:grid-cols-5">
          <KpiCard icon={Target} label="Ativos" value={metrics.active} accent="primary" />
          <KpiCard
            icon={CheckCircle2}
            label="Mês"
            value={metrics.completedThisMonth}
            accent="success"
            hint={monthDelta >= 0 ? `+${monthDelta} vs ant.` : `${monthDelta} vs ant.`}
          />
          <KpiCard icon={AlertTriangle} label="Atraso" value={metrics.overdue} accent="destructive" />
          <KpiCard
            icon={TrendingUp}
            label="Conclusão"
            value={`${metrics.completionRate}%`}
            accent="secondary"
            hint={`${metrics.completed}/${metrics.total}`}
            className="hidden sm:flex"
          />
          <KpiCard
            icon={Calendar}
            label="No prazo"
            value={`${metrics.onTimeRate}%`}
            accent="info"
            hint={`${metrics.avgDuration}d médio`}
            className="hidden sm:flex"
          />
        </section>

        {/* Main grid — linha 1: 4 cards · linha 2: clientes ocupa largura total */}
        <section className="flex-1 min-h-0 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 grid-rows-[repeat(5,minmax(0,1fr))] sm:grid-rows-[repeat(3,minmax(0,1fr))] lg:grid-rows-2">

          {/* === Linha 1: Crítico · Status · Alertas === */}
          {/* Critical project */}
          {mostCritical && (
            <Card className="col-span-1 border-destructive/50 bg-destructive/10 p-3 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-1.5 mb-2 shrink-0">
                <Flame className="w-4 h-4 text-destructive" />
                <h2 className="text-sm lg:text-base font-bold text-destructive">Projeto mais crítico</h2>
              </div>
              <div className="flex-1 min-h-0 flex flex-col justify-center gap-2 overflow-hidden">
                <div className="min-w-0">
                  <div className="text-base lg:text-lg xl:text-xl font-bold truncate leading-tight">
                    {mostCritical.p.title}
                  </div>
                  <div className="text-[11px] lg:text-xs text-muted-foreground truncate mt-0.5">
                    {responsibleName(mostCritical.p)} · {clientMap.get(mostCritical.p.client_id)?.company_name || "—"}
                  </div>
                </div>
                <div className="flex items-end gap-4 lg:gap-6">
                  <div>
                    <div className="text-3xl lg:text-4xl xl:text-5xl font-bold text-destructive tabular-nums leading-none num">
                      {mostCritical.daysLate}<span className="text-xl lg:text-2xl">d</span>
                    </div>
                    <div className="text-[9px] lg:text-[10px] text-muted-foreground uppercase tracking-wider mt-1">de atraso</div>
                  </div>
                  <div className="pb-1">
                    <div className="text-sm lg:text-base font-semibold tabular-nums num">{formatDateBR(mostCritical.p.end_date)}</div>
                    <div className="text-[9px] lg:text-[10px] text-muted-foreground uppercase tracking-wider">prazo original</div>
                  </div>
                </div>
                {delayedProjects.length > 1 && (
                  <div className="text-[10px] lg:text-[11px] text-muted-foreground border-t border-destructive/20 pt-1.5 mt-1">
                    + {delayedProjects.length - 1} outro(s) projeto(s) atrasados
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Status + Evolução 6 meses (mesclados) */}
          <Card className="col-span-1 p-3 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-1 shrink-0">
              <h2 className="text-sm lg:text-base font-bold">Status & Evolução · 6m</h2>
              <span className="text-[10px] text-muted-foreground num">{metrics.total} total</span>
            </div>
            {/* Topo: pie + legenda compacta */}
            <div className="grid grid-cols-5 gap-2 items-center shrink-0" style={{ height: "45%" }}>
              <div className="col-span-2 h-full min-h-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" innerRadius="55%" outerRadius="95%" paddingAngle={2}>
                      {statusPieData.map((e) => (
                        <Cell key={e.key} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="col-span-3 space-y-0.5 overflow-hidden">
                {statusPieData.slice(0, 5).map((s) => {
                  const pct = metrics.total ? Math.round((s.value / metrics.total) * 100) : 0;
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-2 text-[10px] lg:text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <StatusDot color={s.color} />
                        <span className="truncate">{s.name}</span>
                      </div>
                      <div className="tabular-nums text-muted-foreground shrink-0">
                        <span className="font-semibold text-foreground num">{s.value}</span> · {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Divisor */}
            <div className="border-t border-border/40 my-1.5 shrink-0" />
            {/* Linha: evolução 6 meses */}
            <div className="flex items-center gap-1.5 mb-0.5 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Evolução · 6 meses
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer>
                <LineChart data={monthlyEvolution} margin={{ top: 2, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={9} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 9 }} iconSize={7} />
                  <Line type="monotone" dataKey="criados" stroke="hsl(var(--info))" strokeWidth={2} name="Criados" dot={false} />
                  <Line type="monotone" dataKey="concluidos" stroke="hsl(var(--success))" strokeWidth={2} name="Concluídos" dot={false} />
                  <Line type="monotone" dataKey="atrasados" stroke="hsl(var(--destructive))" strokeWidth={2} name="Atrasados" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Merged: Atrasos & Alertas */}
          <Card className="col-span-1 p-3 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <h2 className="text-sm lg:text-base font-bold">Atrasos & alertas</h2>
              </div>
              <span className="text-lg font-bold text-destructive tabular-nums leading-none num">
                {delayedProjects.length}
              </span>
            </div>
            <div className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-hidden">
              {/* Atrasos */}
              <div className="space-y-1 overflow-hidden">
                {delayedProjects.slice(0, 3).map(({ p, daysLate }) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-1.5 rounded-md bg-destructive/5 border border-destructive/20"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{p.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {responsibleName(p)} · {formatDateBR(p.end_date)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-destructive tabular-nums leading-none">
                        +{daysLate}d
                      </div>
                      <div className="text-[9px] text-muted-foreground uppercase">
                        {p.priority || "média"}
                      </div>
                    </div>
                  </div>
                ))}
                {delayedProjects.length === 0 && (
                  <div className="text-[11px] text-muted-foreground text-center py-1">
                    Nenhum projeto em atraso.
                  </div>
                )}
              </div>

              {/* Alertas */}
              {alerts.length > 0 && (
                <>
                  <div className="border-t border-border/40 pt-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                      Alertas operacionais
                    </div>
                    <ul className="space-y-1">
                      {alerts.slice(0, 3).map((a, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 p-1 rounded-md bg-background/60 border border-border/40"
                        >
                          <a.icon
                            className="w-3 h-3 mt-0.5 shrink-0"
                            style={{ color: `hsl(var(--${a.tone}))` }}
                          />
                          <span className="text-[10px] lg:text-[11px] leading-snug">
                            {a.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* === Linha 1 (4ª coluna): Ranking de responsáveis === */}
          <Card className="col-span-1 p-3 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-warning" />
                <h2 className="text-sm lg:text-base font-bold">Ranking responsáveis</h2>
              </div>
              <span className="text-[10px] text-muted-foreground">por taxa</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <table className="w-full text-[11px] lg:text-xs">
                <thead>
                  <tr className="text-left text-[9px] uppercase text-muted-foreground">
                    <th className="py-1 pr-1">#</th>
                    <th className="py-1 pr-1">Responsável</th>
                    <th className="py-1 px-1 text-center">Tot</th>
                    <th className="py-1 px-1 text-center hidden sm:table-cell">OK</th>
                    <th className="py-1 px-1 text-center hidden sm:table-cell">At.</th>
                    <th className="py-1 pl-1 text-right">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {[...userStats]
                    .map((u) => ({ ...u, rate: u.total ? Math.round((u.completed / u.total) * 100) : 0 }))
                    .sort((a, b) => b.rate - a.rate || b.completed - a.completed || a.overdue - b.overdue)
                    .slice(0, 6)
                    .map((u, i) => (
                      <tr key={u.name} className="border-t border-border/40">
                        <td className="py-1 pr-1 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="py-1 pr-1 font-medium truncate max-w-[120px]">{u.name}</td>
                        <td className="py-1 px-1 text-center tabular-nums num">{u.total}</td>
                        <td className="py-1 px-1 text-center tabular-nums text-success hidden sm:table-cell">{u.completed}</td>
                        <td className="py-1 px-1 text-center tabular-nums text-destructive hidden sm:table-cell">{u.overdue}</td>
                        <td className="py-1 pl-1 text-right">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              background:
                                u.rate >= 70
                                  ? "hsl(var(--success) / 0.2)"
                                  : u.rate >= 40
                                  ? "hsl(var(--warning) / 0.2)"
                                  : "hsl(var(--destructive) / 0.2)",
                              color:
                                u.rate >= 70
                                  ? "hsl(var(--success))"
                                  : u.rate >= 40
                                  ? "hsl(var(--warning))"
                                  : "hsl(var(--destructive))",
                            }}
                          >
                            {u.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {userStats.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">Sem dados.</div>
              )}
            </div>
          </Card>

          {/* === Linha 2: Projetos por cliente — largura total, sem scroll === */}
          <Card className="sm:col-span-2 lg:col-span-4 p-3 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="text-sm lg:text-base font-bold">Projetos por cliente</h2>
              </div>
              <span className="text-[10px] text-muted-foreground num">
                {clientProjectStats.length} cliente(s) · % por projeto
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {clientProjectStats.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Sem dados.
                </div>
              ) : (
                <div className="h-full grid gap-x-4 gap-y-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 auto-rows-min content-start overflow-hidden">
                  {clientProjectStats.map((c) => (
                    <div
                      key={c.clientName}
                      className="space-y-1 rounded-md border border-border/40 bg-background/40 p-2 min-w-0"
                    >
                      <div className="flex items-center justify-between text-[11px] lg:text-xs">
                        <span className="font-semibold truncate">{c.clientName}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0 ml-1 num">
                          {c.total}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {c.projects.slice(0, 4).map((proj) => (
                          <div
                            key={proj.name}
                            className="flex items-center gap-1.5 text-[10px] lg:text-[11px]"
                          >
                            <span className="truncate flex-1 text-muted-foreground">
                              {proj.name}
                            </span>
                            <div className="w-8 h-1 rounded-full bg-muted overflow-hidden shrink-0">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${proj.pct}%` }}
                              />
                            </div>
                            <span className="tabular-nums shrink-0 font-semibold w-5 text-right num">
                              {proj.count}
                            </span>
                          </div>
                        ))}
                        {c.projects.length > 4 && (
                          <div className="text-[9px] text-muted-foreground">
                            + {c.projects.length - 4} outro(s)
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Footer */}
        <footer className="shrink-0 flex items-center justify-between gap-2 text-[10px] sm:text-xs text-muted-foreground">
          <span className="truncate">Última atualização: {lastUpdate.toLocaleString("pt-BR")}</span>
          <span className="hidden sm:inline">Atualização automática a cada 60s</span>
        </footer>
      </div>
    </div>
  );
};

export default MetricsTV;
