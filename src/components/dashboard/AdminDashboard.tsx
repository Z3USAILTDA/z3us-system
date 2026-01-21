import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTodayLocalDate, getYesterdayLocalDate } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users, Building2, FolderKanban, TrendingUp, AlertTriangle, CheckCircle2, Clock, Flag, ArrowUpDown, ArrowUp, ArrowDown, Printer } from "lucide-react";
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

interface YesterdayStats {
  created: number;
  completed: number;
  delayed: number;
  topResponsibles: Array<{ name: string; count: number }>;
  topClients: Array<{ name: string; count: number }>;
  highlights: Array<{ type: "blocked" | "delayed" | "completed"; text: string; priority?: string }>;
}

const AdminDashboard = () => {
  const [printMode, setPrintMode] = useState(false);
  const [stats, setStats] = useState({
    teams: 0,
    clients: 0,
    projects: 0,
    activeProjects: 0,
    delayed: 0,
    completed: 0,
    open: 0,
  });

  const [clients, setClients] = useState<Array<{ id: string; company_name: string }>>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");

  const [projectsByPerson, setProjectsByPerson] = useState<Array<{
    responsible: string;
    total: number;
    onTime: number;
    delayed: number;
  }>>([]);

  const [projectsByClient, setProjectsByClient] = useState<Array<{
    clientName: string;
    total: number;
  }>>([]);

  const [projectsByPriority, setProjectsByPriority] = useState<Array<{
    priority: string;
    total: number;
  }>>([]);

  const [projectsByDemanda, setProjectsByDemanda] = useState<Array<{
    demanda: string;
    total: number;
    percentage: number;
  }>>([]);
  const [demandaSortColumn, setDemandaSortColumn] = useState<"number" | "percentage">("percentage");
  const [demandaSortDirection, setDemandaSortDirection] = useState<"asc" | "desc">("asc");

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
    
    let query = supabase.from("projects").select(`
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
      query = query.eq("client_id", selectedClient);
    }

    // Get projects with end_date = today OR created_at = today
    const { data: projectsWithEndDate } = await query.eq("end_date", today);
    const { data: projectsCreatedToday } = await supabase
      .from("projects")
      .select(`
        id,
        title,
        status,
        end_date,
        priority,
        responsible,
        created_at,
        client_id,
        clients(company_name)
      `)
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`);

    // Merge and deduplicate
    const allProjects = [...(projectsWithEndDate || [])];
    projectsCreatedToday?.forEach(p => {
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
        if (project.end_date && project.end_date < today) {
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
      .select(`id, title, priority, responsible, client_id, clients(company_name)`)
      .gte("created_at", `${yesterday}T00:00:00`)
      .lt("created_at", `${yesterday}T23:59:59`);

    // Projects with status = completed that might have been completed yesterday
    // (we use actual_end_date if available, otherwise end_date)
    const { data: completedProjects } = await supabase
      .from("projects")
      .select(`id, title, priority, responsible, actual_end_date, client_id, clients(company_name)`)
      .eq("status", "completed")
      .eq("actual_end_date", yesterday);

    // Delayed projects (end_date <= yesterday and not completed)
    const { data: delayedProjects } = await supabase
      .from("projects")
      .select(`id, title, priority, responsible, end_date, client_id, clients(company_name)`)
      .lte("end_date", yesterday)
      .neq("status", "completed");

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
    });
  };

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Build queries with optional client filter
    const buildQuery = (query: any) => {
      if (selectedClient !== "all") {
        return query.eq("client_id", selectedClient);
      }
      return query;
    };

    const [teamsRes, clientsRes, projectsRes, activeProjectsRes, completedRes, openRes, delayedRes] = await Promise.all([
      supabase.from("teams").select("*", { count: "exact", head: true }),
      supabase.from("clients").select("*", { count: "exact", head: true }),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true })),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true }).neq("status", "completed")),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "completed")),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true }).in("status", ["planning", "in_progress"])),
      buildQuery(supabase.from("projects").select("*", { count: "exact", head: true }).lt("end_date", today).neq("status", "completed")),
    ]);

    // Fetch projects with responsible and dates
    let projectsQuery = supabase.from("projects").select("responsible, end_date, status");
    if (selectedClient !== "all") {
      projectsQuery = projectsQuery.eq("client_id", selectedClient);
    }
    const { data: allProjects } = await projectsQuery;

    // Group by responsible
    const personMap = new Map<string, { total: number; onTime: number; delayed: number }>();
    allProjects?.forEach(project => {
      const person = project.responsible || "Não atribuído";
      if (!personMap.has(person)) {
        personMap.set(person, { total: 0, onTime: 0, delayed: 0 });
      }
      const stats = personMap.get(person)!;
      stats.total++;
      
      if (project.end_date && project.status !== "completed") {
        if (project.end_date < today) {
          stats.delayed++;
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

    // Fetch projects by demanda
    let demandaQuery = supabase.from("projects").select("demanda, progress");
    if (selectedClient !== "all") {
      demandaQuery = demandaQuery.eq("client_id", selectedClient);
    }
    const { data: projectsWithDemanda } = await demandaQuery;

    const demandaMap = new Map<string, { total: number; progressSum: number }>();
    projectsWithDemanda?.forEach(project => {
      const demanda = project.demanda || "Sem demanda";
      const progress = project.progress || 0;
      
      if (!demandaMap.has(demanda)) {
        demandaMap.set(demanda, { total: 0, progressSum: 0 });
      }
      
      const stats = demandaMap.get(demanda)!;
      stats.total++;
      stats.progressSum += progress;
    });

    setProjectsByDemanda(
      Array.from(demandaMap.entries()).map(([demanda, stats]) => ({
        demanda,
        total: stats.total,
        percentage: stats.total > 0 ? stats.progressSum / stats.total : 0,
      }))
    );

    setStats({
      teams: teamsRes.count || 0,
      clients: clientsRes.count || 0,
      projects: projectsRes.count || 0,
      activeProjects: activeProjectsRes.count || 0,
      completed: completedRes.count || 0,
      open: openRes.count || 0,
      delayed: delayedRes.count || 0,
    });
  };

  const handleDemandaSort = (column: "number" | "percentage") => {
    if (demandaSortColumn === column) {
      setDemandaSortDirection(demandaSortDirection === "asc" ? "desc" : "asc");
    } else {
      setDemandaSortColumn(column);
      setDemandaSortDirection("asc");
    }
  };

  const DemandaSortIcon = ({ column }: { column: "number" | "percentage" }) => {
    if (demandaSortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return demandaSortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const statCards = [
    {
      title: "Equipes",
      value: stats.teams,
      description: "Membros cadastrados",
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Clientes",
      value: stats.clients,
      description: "Clientes ativos",
      icon: Building2,
      color: "text-accent",
    },
    {
      title: "Projetos Totais",
      value: stats.projects,
      description: "Todos os projetos",
      icon: FolderKanban,
      color: "text-info",
    },
    {
      title: "Projetos Ativos",
      value: stats.activeProjects,
      description: "Em andamento",
      icon: TrendingUp,
      color: "text-success",
    },
  ];

  return (
    <div className={`space-y-8 animate-fade-in ${printMode ? 'print-mode' : ''}`}>
      {/* Print mode styles */}
      <style>{`
        .print-mode {
          max-width: 100%;
          overflow-x: hidden;
        }
        .print-mode .shadow-xl,
        .print-mode .shadow-lg,
        .print-mode .shadow-md {
          box-shadow: none !important;
        }
        .print-mode .backdrop-blur-sm {
          backdrop-filter: none !important;
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
        <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-primary rounded-full" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Dashboard <span className="bg-gradient-primary bg-clip-text text-transparent">Administrativo</span>
            </h1>
            <p className="text-muted-foreground text-lg mt-2">Visão geral do sistema de gestão Z3US</p>
          </div>
          <div className="flex items-center gap-3">
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card 
            key={stat.title} 
            className={`relative bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all ${!printMode ? 'hover:shadow-xl hover:shadow-primary/20' : ''} group overflow-hidden`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-2">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="relative bg-card/50 backdrop-blur-sm border-destructive/20 hover:border-destructive/50 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Atraso</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{stats.delayed}</div>
            <p className="text-xs text-muted-foreground mt-2">Projetos atrasados</p>
          </CardContent>
        </Card>

        <Card className="relative bg-card/50 backdrop-blur-sm border-success/20 hover:border-success/50 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Finalizados</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{stats.completed}</div>
            <p className="text-xs text-muted-foreground mt-2">Projetos completos</p>
          </CardContent>
        </Card>

        <Card className="relative bg-card/50 backdrop-blur-sm border-info/20 hover:border-info/50 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Aberto</CardTitle>
            <Clock className="h-5 w-5 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-info">{stats.open}</div>
            <p className="text-xs text-muted-foreground mt-2">Projetos ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Today's Deliveries - Full width */}
      <TodayDeliveries projects={todayProjects} printMode={printMode} />

      {/* NEW: Today's Demands - Person and Client side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <TodayDemandsByPerson demandsByPerson={todayDemandsByPerson} printMode={printMode} />
        <TodayDemandsByClient demandsByClient={todayDemandsByClient} printMode={printMode} />
      </div>

      {/* NEW: Yesterday Summary - Full width */}
      <YesterdaySummary stats={yesterdayStats} printMode={printMode} />

      {/* Projects by Person */}
      <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader>
          <CardTitle>Projetos por Responsável</CardTitle>
          <CardDescription>Distribuição e status de entregas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Em Tempo</TableHead>
                <TableHead className="text-center">Atrasados</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(printMode ? projectsByPerson.slice(0, 8) : projectsByPerson).map((person) => (
                <TableRow key={person.responsible}>
                  <TableCell className="font-medium">{person.responsible}</TableCell>
                  <TableCell className="text-center">{person.total}</TableCell>
                  <TableCell className="text-center text-success">{person.onTime}</TableCell>
                  <TableCell className="text-center text-destructive">{person.delayed}</TableCell>
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
        </CardContent>
      </Card>

      {/* Projects by Client and Priority */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle>Projetos por Cliente</CardTitle>
            <CardDescription>Distribuição de projetos</CardDescription>
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
                {(printMode ? projectsByClient.slice(0, 6) : projectsByClient).map((client) => (
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
            <CardTitle>Projetos por Prioridade</CardTitle>
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

      {/* Projects by Demanda */}
      <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader>
          <CardTitle>Resumo de Demandas</CardTitle>
          <CardDescription>Distribuição de projetos por demanda</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleDemandaSort("number")}
                >
                  <div className="flex items-center">
                    Demanda
                    <DemandaSortIcon column="number" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleDemandaSort("percentage")}
                >
                  <div className="flex items-center justify-center">
                    Percentual
                    <DemandaSortIcon column="percentage" />
                  </div>
                </TableHead>
                <TableHead>Distribuição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...(printMode ? projectsByDemanda.slice(0, 8) : projectsByDemanda)].sort((a, b) => {
                if (demandaSortColumn === "percentage") {
                  const diff = b.percentage - a.percentage;
                  return demandaSortDirection === "asc" ? -diff : diff;
                } else {
                  const extractNumber = (demanda: string) => {
                    const match = demanda.match(/#(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                  };
                  const diff = extractNumber(a.demanda) - extractNumber(b.demanda);
                  return demandaSortDirection === "asc" ? diff : -diff;
                }
              }).map((demanda) => (
                <TableRow key={demanda.demanda}>
                  <TableCell className="font-medium">{demanda.demanda}</TableCell>
                  <TableCell className="text-center">{demanda.total}</TableCell>
                  <TableCell className="text-center">
                    <span className="text-primary font-semibold">{demanda.percentage.toFixed(1)}%</span>
                  </TableCell>
                  <TableCell>
                    <Progress value={demanda.percentage} className="h-2" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default AdminDashboard;
