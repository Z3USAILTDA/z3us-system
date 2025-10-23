import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderKanban, Calendar, MessageSquare, Clock, TrendingUp, CheckCircle2, AlertCircle, Pause } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoBranco from "@/assets/logo-branco.png";

const ClientDashboard = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data: clientData } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!clientData) {
      setLoading(false);
      return;
    }

    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .eq("client_id", clientData.id)
      .order("created_at", { ascending: false });

    // Ordena projetos: primeiro os que têm client_observation, depois os demais
    const sortedProjects = (projectsData || []).sort((a, b) => {
      const aHasObservation = a.client_observation && a.client_observation.trim() !== '';
      const bHasObservation = b.client_observation && b.client_observation.trim() !== '';
      
      if (aHasObservation && !bHasObservation) return -1;
      if (!aHasObservation && bHasObservation) return 1;
      return 0;
    });

    setProjects(sortedProjects);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: "bg-info",
      in_progress: "bg-warning",
      on_hold: "bg-muted",
      completed: "bg-success",
      cancelled: "bg-destructive",
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
    };
    return labels[status] || status;
  };

  const getTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR,
    });
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

  const filteredProjects = statusFilter === "all" 
    ? projects 
    : projects.filter(p => p.status === statusFilter);

  const availableStatuses = Array.from(new Set(projects.map(p => p.status)));

  // Estatísticas
  const totalProjects = projects.length;
  const inProgressCount = projects.filter(p => p.status === 'in_progress').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const onHoldCount = projects.filter(p => p.status === 'on_hold').length;
  const averageProgress = projects.length > 0 
    ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length)
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
                {availableStatuses.includes("completed") && (
                  <SelectItem value="completed">Concluído</SelectItem>
                )}
                {availableStatuses.includes("cancelled") && (
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                )}
              </SelectContent>
            </Select>
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
