import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTodayLocalDate, getYesterdayLocalDate } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, FolderKanban, AlertTriangle, CheckCircle2, Clock, Flag, ArrowUpDown, ArrowUp, ArrowDown, Printer, CalendarX } from "lucide-react";
import TodayDemandsByPerson from "./TodayDemandsByPerson";
import TodayDemandsByClient from "./TodayDemandsByClient";
import YesterdaySummary from "./YesterdaySummary";
import TodayDeliveries from "./TodayDeliveries";

interface Project {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
  priority: string;
  responsible: string | null;
  client_name?: string;
  created_at: string;
  client_id: string;
}

interface PersonDemands {
  responsible: string;
  total: number;
  completed: number;
  inProgress: number;
  delayed: number;
  projects: Project[];
}

interface ClientDemands {
  clientName: string;
  total: number;
  completed: number;
  inProgress: number;
  projects: Project[];
}

interface YesterdayProject {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
  priority: string;
  responsible: string | null;
  client_name?: string;
  created_at: string;
  actual_end_date?: string | null;
}

interface YesterdayStats {
  created: number;
  completed: number;
  delayed: number;
  topResponsibles: Array<{ name: string; count: number }>;
  topClients: Array<{ name: string; count: number }>;
  highlights: Array<{ type: "blocked" | "delayed" | "completed"; text: string; priority?: string }>;
  createdProjects: YesterdayProject[];
  completedProjects: YesterdayProject[];
  delayedProjects: YesterdayProject[];
}

// Helper to translate status labels
const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    planning: "Planejamento",
    in_progress: "Em Andamento",
    completed: "Concluído",
    on_hold: "Pausado",
    waiting_client: "Aguardando cliente",
  };
  return statusMap[status] || status;
};

const AdminDashboard = () => {
  const [printMode, setPrintMode] = useState(false);
  const [stats, setStats] = useState({
    clients: 0,
    projects: 0,
    activeProjects: 0,
    delayed: 0,
    completed: 0,
    open: 0,
    withoutDeadline: 0,
  });

  const [clients, setClients] = useState<Array<{ id: string; company_name: string }>>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");

  const [projectsByPerson, setProjectsByPerson] = useState<Array<{
    responsible: string;
    total: number;
    onTime: number;
    delayed: number;
    delayedDays: number;
    projects: Project[];
  }>>([]);

  const [selectedPersonProjects, setSelectedPersonProjects] = useState<{
    responsible: string;
    projects: Project[];
  } | null>(null);

  const [projectsByClient, setProjectsByClient] = useState<Array<{
    clientName: string;
    total: number;
  }>>([]);

  const [projectsByPriority, setProjectsByPriority] = useState<Array<{
    priority: string;
    total: number;
  }>>([]);

  // New states for today's demands
  const [todayDemandsByPerson, setTodayDemandsByPerson] = useState<PersonDemands[]>([]);
  const [todayDemandsByClient, setTodayDemandsByClient] = useState<ClientDemands[]>([]);
  const [todayProjects, setTodayProjects] = useState<Project[]>([]);
  const [yesterdayStats, setYesterdayStats] = useState<YesterdayStats>({
    created: 0,
    completed: 0,
    delayed: 0,
    topResponsibles: [],
    topClients: [],
    highlights: [],
    createdProjects: [],
    completedProjects: [],
    delayedProjects: [],
  });

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchStats();
    fetchTodayDemands();
    fetchYesterdayStats();
  }, [selectedClient]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, company_name")
      .eq("status", "active")
      .order("company_name");
    
    if (data) {
      setClients(data);
    }
  };

  const getToday = () => {
    return getTodayLocalDate();
  };

  const getYesterday = () => {
    return getYesterdayLocalDate();
  };

  const fetchTodayDemands = async () => {
    const today = getToday();
    
    const baseSelect = `
      id,
      title,
      status,
      end_date,
      priority,
      responsible,
      created_at,
      updated_at,
      client_id,
      clients(company_name)
    `;

    // Get projects with end_date = today
    let queryEndDate = supabase.from("projects").select(baseSelect).eq("end_date", today);
    if (selectedClient !== "all") {
      queryEndDate = queryEndDate.eq("client_id", selectedClient);
    }
    const { data: projectsWithEndDate } = await queryEndDate;

    // Get projects created today
    let queryCreated = supabase.from("projects").select(baseSelect)
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`);
    if (selectedClient !== "all") {
      queryCreated = queryCreated.eq("client_id", selectedClient);
    }
    const { data: projectsCreatedToday } = await queryCreated;

    // Get projects updated today
    let queryUpdated = supabase.from("projects").select(baseSelect)
      .gte("updated_at", `${today}T00:00:00`)
      .lt("updated_at", `${today}T23:59:59`);
    if (selectedClient !== "all") {
      queryUpdated = queryUpdated.eq("client_id", selectedClient);
    }
    const { data: projectsUpdatedToday } = await queryUpdated;

    // Merge and deduplicate
    const allProjects = [...(projectsWithEndDate || [])];
    projectsCreatedToday?.forEach(p => {
      if (!allProjects.find(existing => existing.id === p.id)) {
        allProjects.push(p);
      }
    });
    projectsUpdatedToday?.forEach(p => {
      if (!allProjects.find(existing => existing.id === p.id)) {
        allProjects.push(p);
      }
    });

    // Filter by client if needed
    const filteredProjects = selectedClient === "all" 
      ? allProjects 
      : allProjects.filter(p => p.client_id === selectedClient);

    // Group by person
    const personMap = new Map<string, PersonDemands>();
    filteredProjects.forEach(project => {
      const person = project.responsible || "Não atribuído";
      const clientName = (project.clients as any)?.company_name || "Sem cliente";
      
      if (!personMap.has(person)) {
        personMap.set(person, {
          responsible: person,
          total: 0,
          completed: 0,
          inProgress: 0,
          delayed: 0,
          projects: [],
        });
      }
      
      const stats = personMap.get(person)!;
      stats.total++;
      
      const projectData: Project = {
        id: project.id,
        title: project.title,
        status: project.status,
        end_date: project.end_date,
        priority: project.priority,
        responsible: project.responsible,
        client_name: clientName,
        created_at: project.created_at,
        client_id: project.client_id,
      };
      
      stats.projects.push(projectData);
      
      if (project.status === "completed") {
        stats.completed++;
      } else {
        stats.inProgress++;
        // Don't count as delayed if status is waiting_client
        if (project.end_date && project.end_date < today && project.status !== "waiting_client") {
          stats.delayed++;
        }
      }
    });

    setTodayDemandsByPerson(
      Array.from(personMap.values()).sort((a, b) => b.total - a.total)
    );

    // Group by client
    const clientMap = new Map<string, ClientDemands>();
    filteredProjects.forEach(project => {
      const clientName = (project.clients as any)?.company_name || "Sem cliente";
      
      if (!clientMap.has(clientName)) {
        clientMap.set(clientName, {
          clientName,
          total: 0,
          completed: 0,
          inProgress: 0,
          projects: [],
        });
      }
      
      const stats = clientMap.get(clientName)!;
      stats.total++;
      
      const projectData: Project = {
        id: project.id,
        title: project.title,
        status: project.status,
        end_date: project.end_date,
        priority: project.priority,
        responsible: project.responsible,
        client_name: clientName,
        created_at: project.created_at,
        client_id: project.client_id,
      };
      
      stats.projects.push(projectData);
      
      if (project.status === "completed") {
        stats.completed++;
      } else {
        stats.inProgress++;
      }
    });

    setTodayDemandsByClient(
      Array.from(clientMap.values()).sort((a, b) => b.total - a.total)
    );

    // Store all today's projects for the deliveries component
    const allTodayProjectsData: Project[] = filteredProjects.map(project => ({
      id: project.id,
      title: project.title,
      status: project.status,
      end_date: project.end_date,
      priority: project.priority,
      responsible: project.responsible,
      client_name: (project.clients as any)?.company_name || "Sem cliente",
      created_at: project.created_at,
      client_id: project.client_id,
    }));
    setTodayProjects(allTodayProjectsData);
  };

  const fetchYesterdayStats = async () => {
    const yesterday = getYesterday();
    const today = getToday();

    let baseQuery = supabase.from("projects").select(`
      id,
      title,
      status,
      end_date,
      priority,
      responsible,
      created_at,
      client_id,
      clients(company_name)
    `);

    if (selectedClient !== "all") {
      baseQuery = baseQuery.eq("client_id", selectedClient);
    }

    // Projects created yesterday
    const { data: createdYesterday } = await supabase
      .from("projects")
      .select(`id, title, status, priority, responsible, end_date, created_at, client_id, clients(company_name)`)
      .gte("created_at", `${yesterday}T00:00:00`)
      .lt("created_at", `${yesterday}T23:59:59`);

    // Projects with status = completed that might have been completed yesterday
    // (we use actual_end_date if available, otherwise end_date)
    const { data: completedProjects } = await supabase
      .from("projects")
      .select(`id, title, status, priority, responsible, end_date, actual_end_date, created_at, client_id, clients(company_name)`)
      .eq("status", "completed")
      .eq("actual_end_date", yesterday);

    // Delayed projects (end_date < today, not <= yesterday - fix for correct delay logic)
    const { data: delayedProjects } = await supabase
      .from("projects")
      .select(`id, title, status, priority, responsible, end_date, created_at, client_id, clients(company_name)`)
      .lt("end_date", today)
      .neq("status", "completed")
      .neq("status", "waiting_client");

    // Filter by client if needed
    const filterByClient = (projects: any[] | null) => {
      if (!projects) return [];
      if (selectedClient === "all") return projects;
      return projects.filter(p => p.client_id === selectedClient);
    };

    const filteredCreated = filterByClient(createdYesterday);
    const filteredCompleted = filterByClient(completedProjects);
    const filteredDelayed = filterByClient(delayedProjects);

    // Calculate top responsibles
    const responsibleCount = new Map<string, number>();
    [...filteredCreated, ...filteredCompleted].forEach(p => {
      const name = p.responsible || "Não atribuído";
      responsibleCount.set(name, (responsibleCount.get(name) || 0) + 1);
    });

    // Calculate top clients
    const clientCount = new Map<string, number>();
    [...filteredCreated, ...filteredCompleted].forEach(p => {
      const name = (p.clients as any)?.company_name || "Sem cliente";
      clientCount.set(name, (clientCount.get(name) || 0) + 1);
    });

    // Build highlights
    const highlights: YesterdayStats["highlights"] = [];

    // High priority delayed
    filteredDelayed
      .filter(p => p.priority === "high")
      .slice(0, 2)
      .forEach(p => {
        highlights.push({
          type: "delayed",
          text: p.title,
          priority: p.priority,
        });
      });

    // High priority completed
    filteredCompleted
      .filter(p => p.priority === "high")
      .slice(0, 2)
      .forEach(p => {
        highlights.push({
          type: "completed",
          text: p.title,
          priority: p.priority,
        });
      });

    // Regular delayed
    filteredDelayed
      .filter(p => p.priority !== "high")
      .slice(0, 2)
      .forEach(p => {
        highlights.push({
          type: "delayed",
          text: p.title,
        });
      });

    // Map projects to YesterdayProject format
    const mapToYesterdayProject = (p: any): YesterdayProject => ({
      id: p.id,
      title: p.title,
      status: p.status || "planning",
      end_date: p.end_date || null,
      priority: p.priority || "medium",
      responsible: p.responsible || null,
      client_name: (p.clients as any)?.company_name || "Sem cliente",
      created_at: p.created_at || "",
      actual_end_date: p.actual_end_date || null,
    });

    setYesterdayStats({
      created: filteredCreated.length,
      completed: filteredCompleted.length,
      delayed: filteredDelayed.length,
      topResponsibles: Array.from(responsibleCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      topClients: Array.from(clientCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      highlights: highlights.slice(0, 5),
      createdProjects: filteredCreated.map(mapToYesterdayProject),
      completedProjects: filteredCompleted.map(mapToYesterdayProject),
      delayedProjects: filteredDelayed.map(mapToYesterdayProject),
    });
  };

  const fetchStats = async () => {
    const today = getTodayLocalDate();
    
    // Build queries with optional client filter
    const buildQuery = (query: any) => {
      if (selectedClient !== "all") {
        return query.eq("client_id", selectedClient);
      }
      return query;
    };

    const [clientsRes, projectsRes, completedRes, openRes, delayedRes, withoutDeadlineRes] = await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true })),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "completed")),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true }).in("status", ["planning", "in_progress"])),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true }).lt("end_date", today).neq("status", "completed").neq("status", "waiting_client")),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true }).is("end_date", null)),
    ]);

    // Fetch projects with responsible, dates and client for "Atividades por responsável"
    let projectsQuery = supabase.from("projects").select(`
      id,
      title,
      responsible,
      end_date,
      status,
      priority,
      created_at,
      client_id,
      clients(company_name)
    `);
    if (selectedClient !== "all") {
      projectsQuery = projectsQuery.eq("client_id", selectedClient);
    }
    const { data: allProjects } = await projectsQuery;

    // Users to exclude from the responsible block
    const excludedUsers = ["Willian Renato", "Nicolas Freitas"];
    
    // Group by responsible - exclude "Não atribuído" and excluded users
    const personMap = new Map<string, { 
      total: number; 
      onTime: number; 
      delayed: number;
      delayedDays: number;
      projects: Project[];
    }>();
    
    allProjects?.forEach(project => {
      const person = project.responsible;
      // Skip if no responsible assigned or if user is excluded
      if (!person || person.trim() === "" || excludedUsers.includes(person)) return;
      
      if (!personMap.has(person)) {
        personMap.set(person, { total: 0, onTime: 0, delayed: 0, delayedDays: 0, projects: [] });
      }
      const stats = personMap.get(person)!;
      stats.total++;
      
      const projectData: Project = {
        id: project.id,
        title: project.title,
        status: project.status,
        end_date: project.end_date,
        priority: project.priority,
        responsible: project.responsible,
        client_name: (project.clients as any)?.company_name || "Sem cliente",
        created_at: project.created_at,
        client_id: project.client_id,
      };
      stats.projects.push(projectData);
      
      if (project.end_date && project.status !== "completed") {
        // Don't count as delayed if status is waiting_client
        if (project.end_date < today && project.status !== "waiting_client") {
          stats.delayed++;
          // Calculate days overdue
          const endDate = new Date(project.end_date + "T12:00:00");
          const todayDate = new Date(today + "T12:00:00");
          const diffTime = todayDate.getTime() - endDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          stats.delayedDays += diffDays > 0 ? diffDays : 0;
        } else {
          stats.onTime++;
        }
      } else if (project.status === "completed") {
        stats.onTime++;
      }
    });

    setProjectsByPerson(
      Array.from(personMap.entries()).map(([responsible, stats]) => ({
        responsible,
        ...stats,
      }))
    );

    // Fetch projects by client
    let clientQuery = supabase.from("projects").select("client_id, clients(company_name)");
    if (selectedClient !== "all") {
      clientQuery = clientQuery.eq("client_id", selectedClient);
    }
    const { data: projectsWithClients } = await clientQuery;

    const clientMap = new Map<string, number>();
    projectsWithClients?.forEach(project => {
      const clientName = (project.clients as any)?.company_name || "Sem cliente";
      clientMap.set(clientName, (clientMap.get(clientName) || 0) + 1);
    });

    setProjectsByClient(
      Array.from(clientMap.entries()).map(([clientName, total]) => ({
        clientName,
        total,
      }))
    );

    // Fetch projects by priority
    let priorityQuery = supabase.from("projects").select("priority");
    if (selectedClient !== "all") {
      priorityQuery = priorityQuery.eq("client_id", selectedClient);
    }
    const { data: projectsWithPriority } = await priorityQuery;

    const priorityMap = new Map<string, number>();
    projectsWithPriority?.forEach(project => {
      const priority = project.priority || "medium";
      priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1);
    });

    setProjectsByPriority(
      Array.from(priorityMap.entries()).map(([priority, total]) => ({
        priority,
        total,
      }))
    );

    setStats({
      clients: clientsRes.count || 0,
      projects: projectsRes.count || 0,
      activeProjects: 0,
      completed: completedRes.count || 0,
      open: openRes.count || 0,
      delayed: delayedRes.count || 0,
      withoutDeadline: withoutDeadlineRes.count || 0,
    });
  };

  const statCards = [
    {
      title: "Clientes",
      value: stats.clients,
      description: "Clientes ativos",
      icon: Building2,
      color: "text-accent",
    },
    {
      title: "Atividades totais",
      value: stats.projects,
      description: "Todas as atividades",
      icon: FolderKanban,
      color: "text-info",
    },
    {
      title: "Atividades sem prazo",
      value: stats.withoutDeadline,
      description: "Sem data definida",
      icon: CalendarX,
      color: "text-warning",
    },
  ];

  return (
    <div className={`animate-fade-in ${printMode ? 'print-mode space-y-2 sm:space-y-3' : 'space-y-8'}`}>
      {/* Print mode styles - responsive */}
      <style>{`
        .print-mode {
          max-width: 100%;
          overflow-x: hidden;
          overflow-y: hidden;
          max-height: 100vh;
        }
        .print-mode .shadow-xl,
        .print-mode .shadow-lg,
        .print-mode .shadow-md {
          box-shadow: none !important;
        }
        .print-mode .backdrop-blur-sm {
          backdrop-filter: none !important;
        }
        .print-mode .print-compact-card {
          padding: 0.25rem !important;
        }
        @media (min-width: 640px) {
          .print-mode .print-compact-card {
            padding: 0.5rem !important;
          }
        }
        .print-mode .print-compact-card .text-4xl,
        .print-mode .print-compact-card .text-3xl {
          font-size: 1.25rem !important;
        }
        @media (min-width: 768px) {
          .print-mode .print-compact-card .text-4xl,
          .print-mode .print-compact-card .text-3xl {
            font-size: 1.5rem !important;
          }
        }
        .print-mode .print-hide {
          display: none !important;
        }
        @media print {
          .print-mode {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative">
        <div className={`absolute -left-4 top-0 w-1 h-full bg-gradient-primary rounded-full ${printMode ? 'hidden' : ''}`} />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className={`font-bold tracking-tight ${printMode ? 'text-2xl' : 'text-4xl'}`}>
              Dashboard <span className="bg-gradient-primary bg-clip-text text-transparent">Administrativo</span>
            </h1>
            {!printMode && <p className="text-muted-foreground text-lg mt-2">Visão geral do sistema de gestão Z3US</p>}
          </div>
          <div className="flex items-center gap-3 no-print">
            <Button
              variant={printMode ? "default" : "outline"}
              size="sm"
              onClick={() => setPrintMode(!printMode)}
              className="no-print"
            >
              <Printer className="h-4 w-4 mr-2" />
              {printMode ? "Modo Normal" : "Modo Print"}
            </Button>
            <div className="w-[280px]">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Filtrar por cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Combined Stats - Compact and responsive for print */}
      <div className={`grid ${printMode ? 'grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2' : 'gap-6 md:grid-cols-3'}`}>
        {statCards.map((stat, index) => (
          <Card 
            key={stat.title} 
            className={`relative bg-card/50 backdrop-blur-sm border-primary/20 transition-all ${!printMode ? 'hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20' : 'print-compact-card'} group overflow-hidden`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
            <CardHeader className={`flex flex-row items-center justify-between relative z-10 ${printMode ? 'pb-0 pt-1 px-2 sm:pb-1 sm:pt-2 sm:px-3' : 'pb-2'}`}>
              <CardTitle className={`font-medium text-muted-foreground ${printMode ? 'text-[10px] sm:text-xs truncate' : 'text-sm'}`}>
                {stat.title}
              </CardTitle>
              {!printMode && (
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              )}
            </CardHeader>
            <CardContent className={`relative z-10 ${printMode ? 'pb-1 px-2 sm:pb-2 sm:px-3' : ''}`}>
              <div className={`font-bold bg-gradient-primary bg-clip-text text-transparent ${printMode ? 'text-lg sm:text-2xl' : 'text-4xl'}`}>{stat.value}</div>
              {!printMode && <p className="text-xs text-muted-foreground mt-2">{stat.description}</p>}
            </CardContent>
          </Card>
        ))}
        
        {/* Status Cards inline for print mode */}
        <Card className={`relative bg-card/50 backdrop-blur-sm border-warning/20 transition-all ${printMode ? 'print-compact-card' : 'hidden'}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${printMode ? 'pb-0 pt-1 px-2 sm:pb-1 sm:pt-2 sm:px-3' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${printMode ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>Em Atraso</CardTitle>
          </CardHeader>
          <CardContent className={printMode ? 'pb-1 px-2 sm:pb-2 sm:px-3' : ''}>
            <div className={`font-bold text-warning ${printMode ? 'text-lg sm:text-2xl' : 'text-3xl'}`}>
              {stats.projects > 0 ? ((stats.delayed / stats.projects) * 100).toFixed(1) : '0.0'}% ({stats.delayed})
            </div>
          </CardContent>
        </Card>

        <Card className={`relative bg-card/50 backdrop-blur-sm border-success/20 transition-all ${printMode ? 'print-compact-card' : 'hidden'}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${printMode ? 'pb-0 pt-1 px-2 sm:pb-1 sm:pt-2 sm:px-3' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${printMode ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>Finalizados</CardTitle>
          </CardHeader>
          <CardContent className={printMode ? 'pb-1 px-2 sm:pb-2 sm:px-3' : ''}>
            <div className={`font-bold text-success ${printMode ? 'text-lg sm:text-2xl' : 'text-3xl'}`}>
              {stats.projects > 0 ? ((stats.completed / stats.projects) * 100).toFixed(1) : '0.0'}% ({stats.completed})
            </div>
          </CardContent>
        </Card>

        <Card className={`relative bg-card/50 backdrop-blur-sm border-info/20 transition-all ${printMode ? 'print-compact-card' : 'hidden'}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${printMode ? 'pb-0 pt-1 px-2 sm:pb-1 sm:pt-2 sm:px-3' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${printMode ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>Total em aberto</CardTitle>
          </CardHeader>
          <CardContent className={printMode ? 'pb-1 px-2 sm:pb-2 sm:px-3' : ''}>
            <div className={`font-bold text-info ${printMode ? 'text-lg sm:text-2xl' : 'text-3xl'}`}>
              {stats.projects > 0 ? ((stats.open / stats.projects) * 100).toFixed(1) : '0.0'}% ({stats.open})
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Cards - Normal mode only */}
      {!printMode && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="relative bg-card/50 backdrop-blur-sm border-warning/20 hover:border-warning/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Em Atraso</CardTitle>
              <AlertTriangle className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {stats.projects > 0 ? ((stats.delayed / stats.projects) * 100).toFixed(1) : '0.0'}% ({stats.delayed})
              </div>
              <p className="text-xs text-muted-foreground mt-2">Atividades atrasadas</p>
            </CardContent>
          </Card>

          <Card className="relative bg-card/50 backdrop-blur-sm border-success/20 hover:border-success/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Finalizados</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {stats.projects > 0 ? ((stats.completed / stats.projects) * 100).toFixed(1) : '0.0'}% ({stats.completed})
              </div>
              <p className="text-xs text-muted-foreground mt-2">Atividades completas</p>
            </CardContent>
          </Card>

          <Card className="relative bg-card/50 backdrop-blur-sm border-info/20 hover:border-info/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total em aberto</CardTitle>
              <Clock className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info">
                {stats.projects > 0 ? ((stats.open / stats.projects) * 100).toFixed(1) : '0.0'}% ({stats.open})
              </div>
              <p className="text-xs text-muted-foreground mt-2">Atividades ativas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Today's Deliveries - Full width */}
      <TodayDeliveries projects={todayProjects} printMode={printMode} />

      {/* Today's Demands + Activities by Person - Responsive grid in print mode */}
      <div className={`grid ${printMode ? 'grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2' : 'gap-6 md:grid-cols-2'}`}>
        <TodayDemandsByPerson demandsByPerson={todayDemandsByPerson} printMode={printMode} />
        <TodayDemandsByClient demandsByClient={todayDemandsByClient} printMode={printMode} />
        
        {/* Activities by Person - Compact for print */}
        {printMode && (
          <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader className="py-1 px-2 sm:py-2 sm:px-3">
              <CardTitle className="text-xs sm:text-sm">Atividades por responsável</CardTitle>
            </CardHeader>
            <CardContent className="py-0.5 px-2 sm:py-1 sm:px-3">
              {projectsByPerson.length === 0 ? (
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center py-1 sm:py-2">Sem dados</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] sm:text-xs py-0.5 sm:py-1">Resp.</TableHead>
                      <TableHead className="text-[10px] sm:text-xs py-0.5 sm:py-1 text-center">Total</TableHead>
                      <TableHead className="text-[10px] sm:text-xs py-0.5 sm:py-1 text-center">Atraso</TableHead>
                      <TableHead className="text-[10px] sm:text-xs py-0.5 sm:py-1 text-center">Dias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectsByPerson.slice(0, 5).map((person) => (
                      <TableRow key={person.responsible}>
                        <TableCell className="py-0.5 sm:py-1 text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-[80px]">{person.responsible}</TableCell>
                        <TableCell className="py-0.5 sm:py-1 text-[10px] sm:text-xs text-center">{person.total}</TableCell>
                        <TableCell className="py-0.5 sm:py-1 text-[10px] sm:text-xs text-center text-warning">{person.delayed}</TableCell>
                        <TableCell className="py-0.5 sm:py-1 text-[10px] sm:text-xs text-center text-warning font-semibold">
                          {person.delayedDays > 0 ? person.delayedDays : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Yesterday Summary - Hide in print mode */}
      {!printMode && <YesterdaySummary stats={yesterdayStats} printMode={printMode} />}

      {/* Activities by Person - Normal mode only (print mode is inline above) */}
      {!printMode && (
        <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle>Atividades por responsável</CardTitle>
            <CardDescription>Distribuição e status de entregas</CardDescription>
          </CardHeader>
          <CardContent>
            {projectsByPerson.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Sem atividades atribuídas</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Em Tempo</TableHead>
                    <TableHead className="text-center">Atrasados</TableHead>
                    <TableHead className="text-center">Dias Atrasados</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectsByPerson.map((person) => (
                    <TableRow 
                      key={person.responsible}
                      className="cursor-pointer hover:bg-muted/70"
                      onClick={() => setSelectedPersonProjects({ 
                        responsible: person.responsible, 
                        projects: person.projects 
                      })}
                    >
                      <TableCell className="font-medium">{person.responsible}</TableCell>
                      <TableCell className="text-center">{person.total}</TableCell>
                      <TableCell className="text-center text-success">{person.onTime}</TableCell>
                      <TableCell className="text-center text-warning">{person.delayed}</TableCell>
                      <TableCell className="text-center text-warning font-semibold">
                        {person.delayedDays > 0 ? person.delayedDays : "-"}
                      </TableCell>
                      <TableCell>
                        <Progress 
                          value={person.total > 0 ? (person.onTime / person.total) * 100 : 0} 
                          className="h-2"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal for Activities by Person details */}
      <Dialog 
        open={!!selectedPersonProjects} 
        onOpenChange={(open) => !open && setSelectedPersonProjects(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Atividades — {selectedPersonProjects?.responsible}</DialogTitle>
          </DialogHeader>
          {selectedPersonProjects?.projects.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Sem atividades registradas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPersonProjects?.projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.title}</TableCell>
                    <TableCell className="text-muted-foreground">{project.client_name}</TableCell>
                    <TableCell>
                      <Badge variant={project.status === "completed" ? "secondary" : "default"}>
                        {getStatusLabel(project.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {project.end_date 
                        ? new Date(project.end_date + "T12:00:00").toLocaleDateString("pt-BR") 
                        : "Não definido"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Activities by Client and Priority - Hide in print mode */}
      {!printMode && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Atividades por cliente</CardTitle>
              <CardDescription>Distribuição de atividades</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectsByClient.map((client) => (
                    <TableRow key={client.clientName}>
                      <TableCell className="font-medium">{client.clientName}</TableCell>
                      <TableCell className="text-right">{client.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Atividades por prioridade</CardTitle>
              <CardDescription>Classificação de urgência</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioridade</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectsByPriority.map((priority) => (
                    <TableRow key={priority.priority}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Flag className={`h-4 w-4 ${
                          priority.priority === 'high' ? 'text-destructive' :
                          priority.priority === 'medium' ? 'text-warning' :
                          'text-success'
                        }`} />
                        {priority.priority === 'high' ? 'Alta' :
                         priority.priority === 'medium' ? 'Média' : 'Baixa'}
                      </TableCell>
                      <TableCell className="text-right">{priority.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Welcome card - Hide in print mode */}
      {!printMode && (
        <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-secondary opacity-30" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl">Bem-vindo ao <span className="bg-gradient-primary bg-clip-text text-transparent">Z3US</span></CardTitle>
            <CardDescription className="text-base">
              Use o menu lateral para gerenciar equipes, clientes e projetos
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-6 bg-primary/10 border border-primary/30 rounded-xl neon-border hover:shadow-lg hover:shadow-primary/20 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <h3 className="font-bold text-lg">Integração com IA</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O sistema utiliza inteligência artificial para otimizar a gestão de projetos e sugerir alocação de recursos.
                </p>
              </div>
              <div className="p-6 bg-secondary/10 border border-secondary/30 rounded-xl neon-border hover:shadow-lg hover:shadow-secondary/20 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-secondary/20 rounded-lg">
                    <span className="text-2xl">💡</span>
                  </div>
                  <h3 className="font-bold text-lg">Dica Inicial</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Comece cadastrando sua equipe e clientes para então criar os primeiros projetos!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
