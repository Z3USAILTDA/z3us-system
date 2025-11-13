import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Building2, FolderKanban, TrendingUp, AlertTriangle, CheckCircle2, Clock, Flag, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

const AdminDashboard = () => {
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

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchStats();
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
    <div className="space-y-8 animate-fade-in">
      <div className="relative">
        <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-primary rounded-full" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Dashboard <span className="bg-gradient-primary bg-clip-text text-transparent">Administrativo</span>
            </h1>
            <p className="text-muted-foreground text-lg mt-2">Visão geral do sistema de gestão Z3US</p>
          </div>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card 
            key={stat.title} 
            className="relative bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/20 group overflow-hidden"
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
              {projectsByPerson.map((person) => (
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
              {[...projectsByDemanda].sort((a, b) => {
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
