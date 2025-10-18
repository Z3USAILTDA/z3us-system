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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Administrativo</h1>
        <p className="text-muted-foreground">Visão geral do sistema de gestão</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao Sistema de Gestão</CardTitle>
          <CardDescription>
            Use o menu lateral para gerenciar equipes, clientes e projetos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">🤖 Integração com IA</h3>
              <p className="text-sm text-muted-foreground">
                O sistema utiliza inteligência artificial para otimizar a gestão de projetos e sugerir alocação de recursos.
              </p>
            </div>
            <div className="p-4 bg-gradient-primary text-primary-foreground rounded-lg">
              <h3 className="font-semibold mb-2">💡 Dica</h3>
              <p className="text-sm opacity-90">
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
