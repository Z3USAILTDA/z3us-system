import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FolderKanban, Calendar, MessageSquare } from "lucide-react";
import logoBranco from "@/assets/logo-branco.png";

const ClientDashboard = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative flex items-center gap-4">
        <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-primary rounded-full" />
        <img src={logoBranco} alt="Z3US" className="h-16 object-contain" />
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
          {projects.map((project, index) => (
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
                      {project.description || "Sem descrição"}
                    </CardDescription>
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
