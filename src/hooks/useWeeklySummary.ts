import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTodayLocalDate } from "@/lib/utils";

export interface WeeklyProject {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
  actual_end_date: string | null;
  priority: string;
  responsible: string | null;
  client_name: string;
  client_id: string;
  created_at: string;
  demanda: string | null;
  area: string | null;
  sprint: string | null;
}

export interface WeeklyKPIs {
  created: number;
  completed: number;
  overdue: number;
  inProgress: number;
  withoutDeadline: number;
  completionRate: number;
  avgLeadTimeDays: number;
  slaRate: number;
  prevCreated: number;
  prevCompleted: number;
}

export interface PersonRanking {
  name: string;
  completed: number;
  created: number;
  overdue: number;
  sla: number;
  avgLeadTimeDays: number;
  topClients: string[];
}

export interface TeamRanking {
  name: string;
  created: number;
  completed: number;
  overdue: number;
  sla: number;
  avgLeadTimeDays: number;
  sharePercent: number;
}

export interface DailyTrend {
  day: string;
  label: string;
  completed: number;
  created: number;
}

export interface InsightItem {
  type: "highlight" | "risk" | "bottleneck";
  text: string;
}

export interface ClientBreakdown {
  name: string;
  total: number;
}

export interface PriorityBreakdown {
  priority: string;
  label: string;
  total: number;
}

export interface StatusBreakdown {
  status: string;
  label: string;
  total: number;
}

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getSunday(d: Date): Date {
  const mon = getMonday(d);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

const statusLabels: Record<string, string> = {
  planning: "Planejamento",
  in_progress: "Em Andamento",
  completed: "Concluído",
  on_hold: "Pausado",
  waiting_client: "Aguardando cliente",
  test: "Teste",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export function useWeeklySummary() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<WeeklyKPIs>({
    created: 0, completed: 0, overdue: 0, inProgress: 0, withoutDeadline: 0,
    completionRate: 0, avgLeadTimeDays: 0, slaRate: 0, prevCreated: 0, prevCompleted: 0,
  });
  const [personRankings, setPersonRankings] = useState<PersonRanking[]>([]);
  const [teamRankings, setTeamRankings] = useState<TeamRanking[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [clientBreakdown, setClientBreakdown] = useState<ClientBreakdown[]>([]);
  const [priorityBreakdown, setPriorityBreakdown] = useState<PriorityBreakdown[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [detailProjects, setDetailProjects] = useState<WeeklyProject[]>([]);

  // Filters
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterResponsible, setFilterResponsible] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Options for filter dropdowns
  const [teamOptions, setTeamOptions] = useState<{ id: string; name: string }[]>([]);
  const [responsibleOptions, setResponsibleOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);

  const weekEnd = getSunday(weekStart);
  const startStr = toDateStr(weekStart);
  const endStr = toDateStr(weekEnd);
  const today = getTodayLocalDate();

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekEnd);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
  const prevStartStr = toDateStr(prevWeekStart);
  const prevEndStr = toDateStr(prevWeekEnd);

  const goToPrevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const goToNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goToCurrentWeek = () => {
    setWeekStart(getMonday(new Date()));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch filter options
      const [teamsRes, clientsRes] = await Promise.all([
        supabase.from("teams").select("id, name").eq("status", "active").order("name"),
        supabase.from("clients").select("id, company_name").eq("status", "active").order("company_name"),
      ]);

      setTeamOptions(teamsRes.data || []);
      setClientOptions((clientsRes.data || []).map(c => ({ id: c.id, name: c.company_name })));

      // Fetch all projects relevant to this week with client info
      const { data: allProjects } = await supabase
        .from("projects")
        .select(`
          id, title, status, end_date, actual_end_date, priority,
          responsible, created_at, client_id, demanda, area, sprint,
          clients(company_name)
        `);

      // Fetch team assignments
      const { data: teamAssignments } = await supabase
        .from("project_team_assignments")
        .select("project_id, team_id, teams(name)");

      // Build team map: project_id -> team names
      const projectTeamMap = new Map<string, string[]>();
      teamAssignments?.forEach(ta => {
        const teamName = (ta.teams as any)?.name || "Z3US";
        if (!projectTeamMap.has(ta.project_id)) {
          projectTeamMap.set(ta.project_id, []);
        }
        projectTeamMap.get(ta.project_id)!.push(teamName);
      });

      if (!allProjects) {
        setLoading(false);
        return;
      }

      // Map all projects
      const mapped: (WeeklyProject & { teamNames: string[] })[] = allProjects.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        end_date: p.end_date,
        actual_end_date: p.actual_end_date,
        priority: p.priority,
        responsible: p.responsible,
        client_name: (p.clients as any)?.company_name || "Sem cliente",
        client_id: p.client_id,
        created_at: p.created_at,
        demanda: p.demanda,
        area: p.area,
        sprint: p.sprint,
        teamNames: projectTeamMap.get(p.id) || [],
      }));

      // Apply filters
      let filtered = mapped;
      if (filterClient !== "all") filtered = filtered.filter(p => p.client_id === filterClient);
      if (filterResponsible !== "all") filtered = filtered.filter(p => p.responsible === filterResponsible);
      if (filterPriority !== "all") filtered = filtered.filter(p => p.priority === filterPriority);
      if (filterStatus !== "all") filtered = filtered.filter(p => p.status === filterStatus);
      if (filterTeam !== "all") filtered = filtered.filter(p => p.teamNames.some(t => t === filterTeam));

      // Extract responsible options from all (pre-filter)
      const respSet = new Set<string>();
      mapped.forEach(p => { if (p.responsible) respSet.add(p.responsible); });
      setResponsibleOptions(Array.from(respSet).sort());

      // Created this week
      const createdThisWeek = filtered.filter(p => {
        const d = p.created_at.slice(0, 10);
        return d >= startStr && d <= endStr;
      });

      // Completed this week
      const completedThisWeek = filtered.filter(p => {
        if (!p.actual_end_date) return false;
        return p.actual_end_date >= startStr && p.actual_end_date <= endStr;
      });

      // Overdue (end_date < today, not completed/waiting_client/test)
      const overdue = filtered.filter(p => {
        if (!p.end_date) return false;
        return p.end_date < today && p.status !== "completed" && p.status !== "waiting_client" && p.status !== "test" && p.status !== "on_hold" && p.status !== "cancelled";
      });

      // In progress
      const inProgress = filtered.filter(p => p.status === "in_progress");

      // Without deadline
      const withoutDeadline = filtered.filter(p => !p.end_date && p.status !== "completed");

      // Completion rate
      const pendingThisWeek = filtered.filter(p => {
        const createdInWeek = p.created_at.slice(0, 10) >= startStr && p.created_at.slice(0, 10) <= endStr;
        return createdInWeek && p.status !== "completed";
      });
      const completionDenom = completedThisWeek.length + pendingThisWeek.length;
      const completionRate = completionDenom > 0 ? (completedThisWeek.length / completionDenom) * 100 : 0;

      // Lead time (avg days from creation to completion)
      let totalLeadTime = 0;
      let leadTimeCount = 0;
      completedThisWeek.forEach(p => {
        if (p.actual_end_date && p.created_at) {
          const created = new Date(p.created_at);
          const completed = new Date(p.actual_end_date + "T12:00:00");
          const diff = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0) {
            totalLeadTime += diff;
            leadTimeCount++;
          }
        }
      });
      const avgLeadTimeDays = leadTimeCount > 0 ? totalLeadTime / leadTimeCount : 0;

      // SLA (completed on time / completed)
      const completedOnTime = completedThisWeek.filter(p => {
        if (!p.end_date || !p.actual_end_date) return false;
        return p.actual_end_date <= p.end_date;
      });
      const slaRate = completedThisWeek.length > 0 ? (completedOnTime.length / completedThisWeek.length) * 100 : 0;

      // Previous week comparison
      const prevCreated = filtered.filter(p => {
        const d = p.created_at.slice(0, 10);
        return d >= prevStartStr && d <= prevEndStr;
      });
      const prevCompleted = filtered.filter(p => {
        if (!p.actual_end_date) return false;
        return p.actual_end_date >= prevStartStr && p.actual_end_date <= prevEndStr;
      });

      setKpis({
        created: createdThisWeek.length,
        completed: completedThisWeek.length,
        overdue: overdue.length,
        inProgress: inProgress.length,
        withoutDeadline: withoutDeadline.length,
        completionRate,
        avgLeadTimeDays,
        slaRate,
        prevCreated: prevCreated.length,
        prevCompleted: prevCompleted.length,
      });

      // Daily trend (Mon to Sun)
      const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
      const trend: DailyTrend[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const ds = toDateStr(d);
        trend.push({
          day: ds,
          label: dayLabels[i],
          completed: completedThisWeek.filter(p => p.actual_end_date === ds).length,
          created: createdThisWeek.filter(p => p.created_at.slice(0, 10) === ds).length,
        });
      }
      setDailyTrend(trend);

      // Person rankings
      const personMap = new Map<string, PersonRanking>();
      const addToPerson = (name: string) => {
        if (!personMap.has(name)) {
          personMap.set(name, { name, completed: 0, created: 0, overdue: 0, sla: 0, avgLeadTimeDays: 0, topClients: [] });
        }
        return personMap.get(name)!;
      };

      // Track per-person lead times and on-time counts
      const personLeadTimes = new Map<string, number[]>();
      const personOnTime = new Map<string, number>();
      const personCompletedCount = new Map<string, number>();
      const personClientCount = new Map<string, Map<string, number>>();

      createdThisWeek.forEach(p => {
        if (!p.responsible) return;
        addToPerson(p.responsible).created++;
      });

      completedThisWeek.forEach(p => {
        if (!p.responsible) return;
        const pr = addToPerson(p.responsible);
        pr.completed++;
        personCompletedCount.set(p.responsible, (personCompletedCount.get(p.responsible) || 0) + 1);

        // Lead time
        if (p.actual_end_date && p.created_at) {
          const diff = (new Date(p.actual_end_date + "T12:00:00").getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
          if (!personLeadTimes.has(p.responsible)) personLeadTimes.set(p.responsible, []);
          personLeadTimes.get(p.responsible)!.push(diff >= 0 ? diff : 0);
        }

        // SLA
        if (p.end_date && p.actual_end_date && p.actual_end_date <= p.end_date) {
          personOnTime.set(p.responsible, (personOnTime.get(p.responsible) || 0) + 1);
        }

        // Client tracking
        if (!personClientCount.has(p.responsible)) personClientCount.set(p.responsible, new Map());
        const cc = personClientCount.get(p.responsible)!;
        cc.set(p.client_name, (cc.get(p.client_name) || 0) + 1);
      });

      overdue.forEach(p => {
        if (!p.responsible) return;
        addToPerson(p.responsible).overdue++;
      });

      // Compute averages
      personMap.forEach((pr, name) => {
        const lts = personLeadTimes.get(name);
        pr.avgLeadTimeDays = lts && lts.length > 0 ? lts.reduce((a, b) => a + b, 0) / lts.length : 0;
        const comp = personCompletedCount.get(name) || 0;
        const onTime = personOnTime.get(name) || 0;
        pr.sla = comp > 0 ? (onTime / comp) * 100 : 0;

        const cc = personClientCount.get(name);
        if (cc) {
          pr.topClients = Array.from(cc.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([n]) => n);
        }
      });

      setPersonRankings(
        Array.from(personMap.values()).sort((a, b) => b.completed - a.completed)
      );

      // Team rankings
      const teamMap = new Map<string, TeamRanking>();
      const totalTeamCompleted = { count: 0 };

      filtered.forEach(p => {
        const teams = p.teamNames.length > 0 ? p.teamNames : ["Z3US"];
        teams.forEach(teamName => {
          if (!teamMap.has(teamName)) {
            teamMap.set(teamName, { name: teamName, created: 0, completed: 0, overdue: 0, sla: 0, avgLeadTimeDays: 0, sharePercent: 0 });
          }
          const tr = teamMap.get(teamName)!;

          const createdInWeek = p.created_at.slice(0, 10) >= startStr && p.created_at.slice(0, 10) <= endStr;
          if (createdInWeek) tr.created++;

          const completedInWeek = p.actual_end_date && p.actual_end_date >= startStr && p.actual_end_date <= endStr;
          if (completedInWeek) {
            tr.completed++;
            totalTeamCompleted.count++;
          }

          const isOverdue = p.end_date && p.end_date < today && p.status !== "completed" && p.status !== "waiting_client" && p.status !== "test" && p.status !== "on_hold" && p.status !== "cancelled";
          if (isOverdue) tr.overdue++;
        });
      });

      teamMap.forEach(tr => {
        tr.sharePercent = totalTeamCompleted.count > 0 ? (tr.completed / totalTeamCompleted.count) * 100 : 0;
      });

      setTeamRankings(
        Array.from(teamMap.values()).filter(t => t.name !== "Z3US" || t.completed > 0 || t.created > 0).sort((a, b) => b.completed - a.completed)
      );

      // Client breakdown (top 10)
      const cbMap = new Map<string, number>();
      filtered.forEach(p => {
        cbMap.set(p.client_name, (cbMap.get(p.client_name) || 0) + 1);
      });
      setClientBreakdown(
        Array.from(cbMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 10)
      );

      // Priority breakdown
      const pbMap = new Map<string, number>();
      filtered.forEach(p => {
        pbMap.set(p.priority, (pbMap.get(p.priority) || 0) + 1);
      });
      setPriorityBreakdown(
        Array.from(pbMap.entries()).map(([priority, total]) => ({
          priority, label: priorityLabels[priority] || priority, total,
        })).sort((a, b) => b.total - a.total)
      );

      // Status breakdown
      const sbMap = new Map<string, number>();
      filtered.forEach(p => {
        sbMap.set(p.status, (sbMap.get(p.status) || 0) + 1);
      });
      setStatusBreakdown(
        Array.from(sbMap.entries()).map(([status, total]) => ({
          status, label: statusLabels[status] || status, total,
        })).sort((a, b) => b.total - a.total)
      );

      // Insights
      const newInsights: InsightItem[] = [];

      // Highlights: biggest growth
      const createdDiff = createdThisWeek.length - prevCreated.length;
      const completedDiff = completedThisWeek.length - prevCompleted.length;

      if (completedDiff > 0) {
        newInsights.push({ type: "highlight", text: `Concluídas subiram ${completedDiff} vs semana anterior (${prevCompleted.length} → ${completedThisWeek.length})` });
      }

      // Top performer
      const topPerformer = Array.from(personMap.values()).sort((a, b) => b.completed - a.completed)[0];
      if (topPerformer && topPerformer.completed > 0) {
        newInsights.push({ type: "highlight", text: `${topPerformer.name} liderou com ${topPerformer.completed} atividades concluídas` });
      }

      // Risks
      if (overdue.length > 5) {
        newInsights.push({ type: "risk", text: `${overdue.length} atividades em atraso no total` });
      }
      if (completedDiff < 0) {
        newInsights.push({ type: "risk", text: `Queda de ${Math.abs(completedDiff)} concluídas vs semana anterior` });
      }
      if (createdDiff > completedDiff && createdDiff > 0) {
        newInsights.push({ type: "risk", text: `Backlog crescendo: +${createdDiff} criadas vs +${completedDiff > 0 ? completedDiff : completedDiff} concluídas` });
      }

      // Bottlenecks
      const longOpen = filtered.filter(p => {
        if (p.status === "completed" || !p.created_at) return false;
        const days = (new Date().getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
        return days > 30;
      });
      if (longOpen.length > 0) {
        newInsights.push({ type: "bottleneck", text: `${longOpen.length} atividades abertas há mais de 30 dias` });
      }

      const highPriorityOverdue = overdue.filter(p => p.priority === "high");
      if (highPriorityOverdue.length > 0) {
        newInsights.push({ type: "bottleneck", text: `${highPriorityOverdue.length} atividades de alta prioridade em atraso` });
      }

      setInsights(newInsights);

      // Detail projects: all relevant to the week (created or with activity)
      const weekRelevant = filtered.filter(p => {
        const createdInWeek = p.created_at.slice(0, 10) >= startStr && p.created_at.slice(0, 10) <= endStr;
        const completedInWeek = p.actual_end_date && p.actual_end_date >= startStr && p.actual_end_date <= endStr;
        const dueInWeek = p.end_date && p.end_date >= startStr && p.end_date <= endStr;
        const isOverdue = p.end_date && p.end_date < today && p.status !== "completed" && p.status !== "waiting_client" && p.status !== "test" && p.status !== "on_hold" && p.status !== "cancelled";
        return createdInWeek || completedInWeek || dueInWeek || isOverdue;
      });
      setDetailProjects(weekRelevant);

    } catch (error) {
      console.error("Error fetching weekly summary:", error);
    } finally {
      setLoading(false);
    }
  }, [weekStart, filterTeam, filterResponsible, filterClient, filterPriority, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    weekStart, weekEnd, startStr, endStr,
    goToPrevWeek, goToNextWeek, goToCurrentWeek,
    loading, kpis, personRankings, teamRankings, dailyTrend,
    insights, clientBreakdown, priorityBreakdown, statusBreakdown, detailProjects,
    filterTeam, setFilterTeam,
    filterResponsible, setFilterResponsible,
    filterClient, setFilterClient,
    filterPriority, setFilterPriority,
    filterStatus, setFilterStatus,
    teamOptions, responsibleOptions, clientOptions,
  };
}
