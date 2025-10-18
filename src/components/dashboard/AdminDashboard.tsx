import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, FolderKanban, TrendingUp } from "lucide-react";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    teams: 0,
    clients: 0,
    projects: 0,
    activeProjects: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [teamsRes, clientsRes, projectsRes, activeProjectsRes] = await Promise.all([
      supabase.from("teams").select("*", { count: "exact", head: true }),
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("*", { count: "exact", head: true }).neq("status", "completed"),
    ]);

    setStats({
      teams: teamsRes.count || 0,
      clients: clientsRes.count || 0,
      projects: projectsRes.count || 0,
      activeProjects: activeProjectsRes.count || 0,
    });
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
        <h1 className="text-4xl font-bold tracking-tight">
          Dashboard <span className="bg-gradient-primary bg-clip-text text-transparent">Administrativo</span>
        </h1>
        <p className="text-muted-foreground text-lg mt-2">Visão geral do sistema de gestão Z3US</p>
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
