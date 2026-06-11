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

// ----- Constants -----
const STATUS_META: Record<string, { label: string; color: string }> = {
  planning: { label: "A iniciar", color: "hsl(217 91% 60%)" },
  in_progress: { label: "Em andamento", color: "hsl(48 96% 53%)" },
  waiting_client: { label: "Aguardando cliente", color: "hsl(280 85% 65%)" },
  on_hold: { label: "Pausado", color: "hsl(215 20% 65%)" },
  test: { label: "Teste", color: "hsl(199 89% 55%)" },
  completed: { label: "Concluído", color: "hsl(142 76% 45%)" },
  cancelled: { label: "Cancelado", color: "hsl(0 63% 50%)" },
  overdue: { label: "Atrasado", color: "hsl(0 84% 60%)" },
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
}: {
  icon: any;
  label: string;
  value: string | number;
  accent?: string;
  hint?: string;
}) => (
  <Card className="flex items-center gap-4">
    <div
      className="rounded-xl p-3 shrink-0"
      style={{ background: `hsl(var(--${accent}) / 0.15)` }}
    >
      <Icon
        className="w-7 h-7"
        style={{ color: `hsl(var(--${accent}))` }}
      />
    </div>
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div className="text-3xl xl:text-4xl font-bold leading-tight">
        {value}
      </div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      )}
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
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Auth gate (mantém padrão do sistema; redireciona se não logado)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, [navigate]);

  const fetchData = async () => {
    const [pj, pf, cl] = await Promise.all([
      supabase
        .from("projects")
        .select(
          "id,title,status,priority,start_date,end_date,actual_end_date,progress,responsible,project_manager_id,created_at,updated_at,client_id"
        ),
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("clients").select("id,name"),
    ]);
    if (pj.data) setProjects(pj.data as Project[]);
    if (pf.data) setProfiles(pf.data as Profile[]);
    if (cl.data) setClients(cl.data as Client[]);
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 60_000);
    const clockInterval = setInterval(() => setNow(new Date()), 1_000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(clockInterval);
    };
  }, []);

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
      color: STATUS_META[k]?.color || "hsl(215 20% 65%)",
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

  // Per-user stats
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
      const name = responsibleName(p);
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
  }, [projects, profileMap, today]);

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
    <div className="min-h-screen w-full bg-background text-foreground overflow-x-hidden tech-grid">
      <div className="min-h-screen w-full p-4 lg:p-6 xl:p-8 flex flex-col gap-5">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="rounded-2xl p-3 glow-primary"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Activity className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                Métricas de Projetos
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                Painel executivo em tempo real
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:gap-5">
            <div className="text-right">
              <div className="text-2xl lg:text-3xl xl:text-4xl font-bold tabular-nums">
                {now.toLocaleTimeString("pt-BR")}
              </div>
              <div className="text-xs lg:text-sm text-muted-foreground">
                {now.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </header>

        {/* KPI strip */}
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <KpiCard
            icon={Target}
            label="Projetos ativos"
            value={metrics.active}
            accent="primary"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Concluídos no mês"
            value={metrics.completedThisMonth}
            accent="success"
            hint={
              monthDelta === 0
                ? "Igual ao mês anterior"
                : monthDelta > 0
                ? `+${monthDelta} vs mês anterior`
                : `${monthDelta} vs mês anterior`
            }
          />
          <KpiCard
            icon={AlertTriangle}
            label="Em atraso"
            value={metrics.overdue}
            accent="destructive"
          />
          <KpiCard
            icon={TrendingUp}
            label="Taxa de conclusão"
            value={`${metrics.completionRate}%`}
            accent="secondary"
            hint={`${metrics.completed}/${metrics.total} total`}
          />
          <KpiCard
            icon={Calendar}
            label="Entrega no prazo"
            value={`${metrics.onTimeRate}%`}
            accent="info"
            hint={`Média: ${metrics.avgDuration} dias`}
          />
        </section>

        {/* Main grid */}
        <section className="grid gap-5 grid-cols-1 lg:grid-cols-3 xl:grid-cols-12">
          {/* Critical project */}
          {mostCritical && (
            <Card className="xl:col-span-4 lg:col-span-3 border-destructive/50 bg-destructive/10">
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-3 bg-destructive/20">
                  <Flame className="w-7 h-7 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wider text-destructive font-bold">
                    Projeto mais crítico
                  </div>
                  <div className="text-xl xl:text-2xl font-bold mt-1 truncate">
                    {mostCritical.p.title}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 truncate">
                    {responsibleName(mostCritical.p)} ·{" "}
                    {clientMap.get(mostCritical.p.client_id)?.name || "—"}
                  </div>
                  <div className="mt-3 flex items-center gap-4 flex-wrap">
                    <div>
                      <div className="text-3xl xl:text-4xl font-bold text-destructive tabular-nums">
                        {mostCritical.daysLate}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        dias em atraso
                      </div>
                    </div>
                    <div>
                      <div className="text-base font-semibold">
                        {formatDateBR(mostCritical.p.end_date)}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        prazo previsto
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Status overview */}
          <Card className={mostCritical ? "xl:col-span-4 lg:col-span-3" : "xl:col-span-6 lg:col-span-3"}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg xl:text-xl font-bold">
                Status dos projetos
              </h2>
              <span className="text-xs text-muted-foreground">
                {metrics.total} total
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2 items-center">
              <div className="col-span-2 h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {statusPieData.map((e) => (
                        <Cell key={e.key} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="col-span-3 space-y-1.5">
                {statusPieData.map((s) => {
                  const pct = metrics.total
                    ? Math.round((s.value / metrics.total) * 100)
                    : 0;
                  return (
                    <div
                      key={s.key}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot color={s.color} />
                        <span className="truncate">{s.name}</span>
                      </div>
                      <div className="tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {s.value}
                        </span>{" "}
                        · {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Alerts */}
          <Card className="xl:col-span-4 lg:col-span-3">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <h2 className="text-lg xl:text-xl font-bold">
                Alertas operacionais
              </h2>
            </div>
            {alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Tudo sob controle. Nenhum alerta no momento.
              </div>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-2.5 rounded-lg bg-background/60 border border-border/40"
                  >
                    <a.icon
                      className="w-5 h-5 mt-0.5 shrink-0"
                      style={{ color: `hsl(var(--${a.tone}))` }}
                    />
                    <span className="text-sm lg:text-base">{a.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Project ranking */}
          <Card className="xl:col-span-7 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow" />
                <h2 className="text-lg xl:text-xl font-bold">
                  Ranking de projetos
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                Top {projectRanking.length}
              </span>
            </div>
            <div className="space-y-2">
              {projectRanking.map((p, i) => {
                const overdueFlag = isOverdue(p, today);
                const sm =
                  STATUS_META[overdueFlag ? "overdue" : p.status] ||
                  STATUS_META[p.status];
                const daysLate = overdueFlag
                  ? daysBetween(p.end_date!, today)
                  : 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-border/40"
                  >
                    <div className="w-7 text-center text-lg font-bold text-muted-foreground tabular-nums">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {responsibleName(p)}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <StatusDot color={sm?.color || "hsl(215 20% 65%)"} />
                      <span className="text-xs">
                        {sm?.label || p.status}
                      </span>
                    </div>
                    <div className="w-24 shrink-0">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${p.progress ?? 0}%`,
                            background:
                              p.status === "completed"
                                ? "hsl(var(--success))"
                                : overdueFlag
                                ? "hsl(var(--destructive))"
                                : "var(--gradient-primary)",
                          }}
                        />
                      </div>
                      <div className="text-xs text-right text-muted-foreground mt-0.5 tabular-nums">
                        {p.progress ?? 0}%
                        {daysLate > 0 && (
                          <span className="text-destructive ml-1">
                            · +{daysLate}d
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {projectRanking.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Sem projetos para ranquear.
                </div>
              )}
            </div>
          </Card>

          {/* Delayed projects */}
          <Card className="xl:col-span-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h2 className="text-lg xl:text-xl font-bold">
                  Projetos em atraso
                </h2>
              </div>
              <span className="text-2xl font-bold text-destructive tabular-nums">
                {delayedProjects.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-hidden">
              {delayedProjects.slice(0, 8).map(({ p, daysLate }) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {responsibleName(p)} · prazo {formatDateBR(p.end_date)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold text-destructive tabular-nums">
                      +{daysLate}d
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {p.priority || "média"}
                    </div>
                  </div>
                </div>
              ))}
              {delayedProjects.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Nenhum projeto em atraso.
                </div>
              )}
            </div>
          </Card>

          {/* Monthly evolution */}
          <Card className="xl:col-span-7 lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg xl:text-xl font-bold">
                Evolução dos últimos 6 meses
              </h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={monthlyEvolution}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="criados"
                    stroke="hsl(var(--info))"
                    strokeWidth={2}
                    name="Criados"
                  />
                  <Line
                    type="monotone"
                    dataKey="concluidos"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    name="Concluídos"
                  />
                  <Line
                    type="monotone"
                    dataKey="atrasados"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    name="Atrasados"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Weekly deliveries */}
          <Card className="xl:col-span-5 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <h2 className="text-lg xl:text-xl font-bold">
                Entregas do mês por semana
              </h2>
            </div>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={weeklyDeliveries}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    dataKey="entregues"
                    fill="hsl(var(--success))"
                    radius={[6, 6, 0, 0]}
                    name="Entregues"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5 max-h-40 overflow-hidden">
              {recentCompletions.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDateBR(p.actual_end_date || p.end_date)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* User distribution */}
          <Card className="xl:col-span-6 lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-secondary" />
                <h2 className="text-lg xl:text-xl font-bold">
                  Distribuição por responsável
                </h2>
              </div>
            </div>
            <div className="space-y-2.5">
              {topUsers.map((u) => {
                const pct = Math.round((u.total / totalProjectsForPct) * 100);
                return (
                  <div key={u.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium truncate pr-2">
                        {u.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        <span className="text-foreground font-semibold">
                          {u.total}
                        </span>{" "}
                        · {pct}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: "var(--gradient-primary)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {topUsers.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Sem dados de usuários.
                </div>
              )}
            </div>
          </Card>

          {/* User ranking */}
          <Card className="xl:col-span-6 lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow" />
                <h2 className="text-lg xl:text-xl font-bold">
                  Ranking de responsáveis
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                por taxa de conclusão
              </span>
            </div>
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Responsável</th>
                    <th className="py-2 px-2 text-center">Total</th>
                    <th className="py-2 px-2 text-center hidden sm:table-cell">
                      Concl.
                    </th>
                    <th className="py-2 px-2 text-center hidden sm:table-cell">
                      Atras.
                    </th>
                    <th className="py-2 pl-2 text-right">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {[...userStats]
                    .map((u) => ({
                      ...u,
                      rate: u.total
                        ? Math.round((u.completed / u.total) * 100)
                        : 0,
                    }))
                    .sort(
                      (a, b) =>
                        b.rate - a.rate ||
                        b.completed - a.completed ||
                        a.overdue - b.overdue
                    )
                    .slice(0, 8)
                    .map((u, i) => (
                      <tr
                        key={u.name}
                        className="border-t border-border/40"
                      >
                        <td className="py-2 pr-2 text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        <td className="py-2 pr-2 font-medium truncate max-w-[180px]">
                          {u.name}
                        </td>
                        <td className="py-2 px-2 text-center tabular-nums">
                          {u.total}
                        </td>
                        <td className="py-2 px-2 text-center tabular-nums text-success hidden sm:table-cell">
                          {u.completed}
                        </td>
                        <td className="py-2 px-2 text-center tabular-nums text-destructive hidden sm:table-cell">
                          {u.overdue}
                        </td>
                        <td className="py-2 pl-2 text-right">
                          <span
                            className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold"
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
                <div className="text-sm text-muted-foreground text-center py-4">
                  Sem dados.
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
          <span>
            Última atualização:{" "}
            {lastUpdate.toLocaleString("pt-BR")}
          </span>
          <span>Atualização automática a cada 60 segundos</span>
        </footer>
      </div>
    </div>
  );
};

export default MetricsTV;
