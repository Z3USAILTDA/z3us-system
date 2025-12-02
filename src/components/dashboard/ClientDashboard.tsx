import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FolderKanban, Calendar, MessageSquare, Clock, TrendingUp, CheckCircle2, AlertCircle, Pause, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoBranco from "@/assets/logo-branco.png";

const ClientDashboard = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const [isDemandaOpen, setIsDemandaOpen] = useState(false);
  const [demandaSortColumn, setDemandaSortColumn] = useState<"number" | "percentage">("percentage");
  const [demandaSortDirection, setDemandaSortDirection] = useState<"asc" | "desc">("asc");
  const [projectsByDemanda, setProjectsByDemanda] = useState<Array<{
    demanda: string;
    total: number;
    percentage: number;
  }>>([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Primeiro tenta buscar pela tabela client_users (nova estrutura de múltiplos usuários)
    let clientId: string | null = null;
    
    const { data: clientUserData } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (clientUserData) {
      clientId = clientUserData.client_id;
    } else {
      // Fallback: busca pelo user_id direto na tabela clients (compatibilidade)
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (clientData) {
        clientId = clientData.id;
      }
    }

    if (!clientId) {
      setLoading(false);
      return;
    }

    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    // Ordena projetos: primeiro os que têm client_observation, depois os demais
    const sortedProjects = (projectsData || []).sort((a, b) => {
      const aHasObservation = a.client_observation && a.client_observation.trim() !== '';
      const bHasObservation = b.client_observation && b.client_observation.trim() !== '';
      
      if (aHasObservation && !bHasObservation) return -1;
      if (!aHasObservation && bHasObservation) return 1;
      return 0;
    });

    // Calcula resumo de demandas
    const demandaMap = new Map<string, { total: number; progressSum: number }>();
    projectsData?.forEach(project => {
      const demanda = project.demanda || "Sem demanda";
      const progress = project.progress || 0;
      
      if (!demandaMap.has(demanda)) {
        demandaMap.set(demanda, { total: 0, progressSum: 0 });
      }
      
      const stats = demandaMap.get(demanda)!;
      stats.total++;
      stats.progressSum += progress;
    });

    const demandaArray = Array.from(demandaMap.entries()).map(([demanda, stats]) => ({
      demanda,
      total: stats.total,
      percentage: stats.total > 0 ? stats.progressSum / stats.total : 0,
    }));

    setProjectsByDemanda(demandaArray);

    setProjects(sortedProjects);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: "bg-info",
      in_progress: "bg-warning",
      on_hold: "bg-destructive",
      completed: "bg-success",
      cancelled: "bg-destructive",
      waiting_client: "bg-orange-500",
    };
    return colors[status] || "bg-muted";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      planning: "Planejamento",
      in_progress: "Em Andamento",
      on_hold: "Pausado",
      completed: "Concluído",
      cancelled: "Cancelado",
      waiting_client: "Aguardando Cliente",
    };
    return labels[status] || status;
  };

  const getTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando projetos...</p>
        </div>
      </div>
    );
  }

  // Filtrar apenas por sprint para estatísticas
  const sprintFilteredProjects = sprintFilter === "all" 
    ? projects 
    : projects.filter(p => p.sprint === sprintFilter);

  // Filtrar por status e sprint para exibição
  const filteredProjects = projects.filter(p => {
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesSprint = sprintFilter === "all" || p.sprint === sprintFilter;
    return matchesStatus && matchesSprint;
  });

  const availableStatuses = Array.from(new Set(projects.map(p => p.status)));
  const availableSprints = Array.from(new Set(projects.map(p => p.sprint).filter(Boolean))).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    return numA - numB;
  });
  const hasSprints = availableSprints.length > 0;

  // Estatísticas - usando apenas filtro de sprint
  const totalProjects = sprintFilteredProjects.length;
  const inProgressCount = sprintFilteredProjects.filter(p => p.status === 'in_progress').length;
  const completedCount = sprintFilteredProjects.filter(p => p.status === 'completed').length;
  const onHoldCount = sprintFilteredProjects.filter(p => p.status === 'on_hold').length;
  const averageProgress = sprintFilteredProjects.length > 0 
    ? Math.round(sprintFilteredProjects.reduce((acc, p) => acc + (p.progress || 0), 0) / sprintFilteredProjects.length)
    : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-primary rounded-full" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <img src={logoBranco} alt="Z3US" className="h-16 object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-[280px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {availableStatuses.includes("planning") && (
                    <SelectItem value="planning">Planejamento</SelectItem>
                  )}
                  {availableStatuses.includes("in_progress") && (
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                  )}
                  {availableStatuses.includes("on_hold") && (
                    <SelectItem value="on_hold">Pausado</SelectItem>
                  )}
                  {availableStatuses.includes("waiting_client") && (
                    <SelectItem value="waiting_client">Aguardando Cliente</SelectItem>
                  )}
                  {availableStatuses.includes("completed") && (
                    <SelectItem value="completed">Concluído</SelectItem>
                  )}
                  {availableStatuses.includes("cancelled") && (
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {hasSprints && (
              <div className="w-[280px]">
                <Select value={sprintFilter} onValueChange={setSprintFilter}>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Filtrar por sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as sprints</SelectItem>
                    {availableSprints.map((sprint) => (
                      <SelectItem key={sprint} value={sprint}>
                        {sprint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="relative bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/20 group overflow-hidden"
          style={{ animationDelay: '0s' }}
        >
          <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Projetos</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">{totalProjects}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalProjects === 1 ? 'projeto cadastrado' : 'projetos cadastrados'}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="relative bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/20 group overflow-hidden"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground mt-2">projetos ativos</p>
          </CardContent>
        </Card>

        <Card 
          className="relative bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/20 group overflow-hidden"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídos</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-2">projetos finalizados</p>
          </CardContent>
        </Card>

        <Card 
          className="relative bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/20 group overflow-hidden"
          style={{ animationDelay: '0.3s' }}
        >
          <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Progresso Médio</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <AlertCircle className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">{averageProgress}%</div>
            <Progress value={averageProgress} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Resumo de Demandas */}
      {projectsByDemanda.length > 0 && (
        <Collapsible open={isDemandaOpen} onOpenChange={setIsDemandaOpen}>
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <CardTitle>Resumo de Demandas</CardTitle>
                    <CardDescription>Distribuição de projetos por demanda</CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isDemandaOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum projeto encontrado</h3>
            <p className="text-sm text-muted-foreground">
              Entre em contato com nossa equipe para iniciar seu primeiro projeto
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredProjects.map((project, index) => (
            <Card 
              key={project.id} 
              className="relative bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/20 group overflow-hidden"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
              <CardHeader className="relative z-10">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-xl bg-gradient-primary bg-clip-text text-transparent">{project.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.area || "Área não definida"}
                    </CardDescription>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <Clock className="h-3 w-3" />
                      <span>Atualizado {getTimeAgo(project.updated_at)}</span>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(project.status)} ml-2`}>
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="text-muted-foreground">Início</p>
                      <p className="font-medium">
                        {project.start_date
                          ? new Date(project.start_date).toLocaleDateString("pt-BR")
                          : "Não definido"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="text-muted-foreground">Observação</p>
                      <p className="font-medium">
                        {project.client_observation || "Sem observação"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
