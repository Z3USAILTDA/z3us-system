import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Home, Users, Building2, FolderKanban, LogOut, UserCircle, FileText,
  ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown, Minus,
  BarChart3, Clock, Target, AlertTriangle, CheckCircle2, CalendarX,
  Lightbulb, ShieldAlert, Zap, Calendar, Sparkles
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, Legend, Tooltip as RechartsTooltip,
} from "recharts";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { formatDateBR } from "@/lib/utils";
import logoWhite from "@/assets/logo-branco.png";
import { generateWeeklyPdf } from "@/lib/weeklyPdfExport";

const CHART_COLORS = [
  "hsl(175, 70%, 50%)", "hsl(217, 91%, 60%)", "hsl(280, 85%, 65%)",
  "hsl(38, 92%, 55%)", "hsl(142, 76%, 45%)", "hsl(199, 89%, 55%)",
  "hsl(48, 96%, 53%)", "hsl(0, 63%, 50%)", "hsl(160, 60%, 45%)",
  "hsl(240, 60%, 60%)",
];

const WeeklySummaryContent = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  

  const ws = useWeeklySummary();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (profileData?.role !== "admin") { navigate("/dashboard"); return; }
    setProfile(profileData);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleExportPDF = () => {
    toast.info("Gerando PDF...");
    try {
      generateWeeklyPdf({
        startStr: ws.startStr,
        endStr: ws.endStr,
        kpis: ws.kpis,
        personRankings: ws.personRankings,
        teamRankings: ws.teamRankings,
        dailyTrend: ws.dailyTrend,
        insights: ws.insights,
        clientBreakdown: ws.clientBreakdown,
        priorityBreakdown: ws.priorityBreakdown,
        statusBreakdown: ws.statusBreakdown,
        detailProjects: ws.detailProjects,
      });
      toast.success("PDF gerado com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  };

  const adminMenuItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Equipes", url: "/dashboard/teams", icon: Users },
    { title: "Clientes", url: "/dashboard/clients", icon: Building2 },
    { title: "Projetos", url: "/dashboard/projects", icon: FolderKanban },
    { title: "Novos Projetos", url: "/dashboard/novos-projetos", icon: Sparkles },
    { title: "Documentação", url: "/dashboard/documentation", icon: FileText },
    { title: "Resumo da Semana", url: "/dashboard/weekly-summary", icon: BarChart3 },
  ];

  const getVariation = (current: number, prev: number) => {
    if (prev === 0 && current === 0) return { pct: 0, icon: Minus, color: "text-muted-foreground" };
    if (prev === 0) return { pct: 100, icon: TrendingUp, color: "text-success" };
    const pct = ((current - prev) / prev) * 100;
    if (pct > 0) return { pct, icon: TrendingUp, color: "text-success" };
    if (pct < 0) return { pct, icon: TrendingDown, color: "text-warning" };
    return { pct: 0, icon: Minus, color: "text-muted-foreground" };
  };

  const getBadgeStatus = (p: any) => {
    const today = new Date().toLocaleDateString("en-CA");
    if (p.status === "completed") return <Badge className="bg-success/20 text-success border-success/30">Concluído</Badge>;
    if (!p.end_date) return <Badge className="bg-muted text-muted-foreground border-border">Sem prazo</Badge>;
    if (p.end_date < today && p.status !== "waiting_client" && p.status !== "test" && p.status !== "on_hold" && p.status !== "cancelled")
      return <Badge className="bg-warning/20 text-warning border-warning/30">Atrasado</Badge>;
    return <Badge className="bg-info/20 text-info border-info/30">No prazo</Badge>;
  };

  const getOpenDays = (createdAt: string) => {
    const diff = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(diff);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const createdVar = getVariation(ws.kpis.created, ws.kpis.prevCreated);
  const completedVar = getVariation(ws.kpis.completed, ws.kpis.prevCompleted);

  return (
    <div className="min-h-screen flex w-full">
      <Sidebar>
        <SidebarHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <img src={logoWhite} alt="Z3US Logo" className="h-8 w-auto" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              </div>
            </div>
            <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 overflow-auto">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 gap-4">
            <SidebarTrigger />
            <h2 className="text-lg font-semibold">Resumo da Semana</h2>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Header with week selector and actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Resumo da <span className="bg-gradient-primary bg-clip-text text-transparent">Semana</span>
              </h1>
              <p className="text-muted-foreground mt-1">Desempenho semanal consolidado</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                <Button variant="ghost" size="icon" onClick={ws.goToPrevWeek} className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={ws.goToCurrentWeek} className="text-xs px-2">
                  <Calendar className="h-3 w-3 mr-1" />
                  {formatDateBR(ws.startStr)} – {formatDateBR(ws.endStr)}
                </Button>
                <Button variant="ghost" size="icon" onClick={ws.goToNextWeek} className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button onClick={handleExportPDF} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" /> Gerar PDF
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={ws.filterClient} onValueChange={ws.setFilterClient}>
              <SelectTrigger className="w-[180px] bg-card"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {ws.clientOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ws.filterResponsible} onValueChange={ws.setFilterResponsible}>
              <SelectTrigger className="w-[180px] bg-card"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ws.responsibleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ws.filterTeam} onValueChange={ws.setFilterTeam}>
              <SelectTrigger className="w-[180px] bg-card"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as equipes</SelectItem>
                {ws.teamOptions.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ws.filterPriority} onValueChange={ws.setFilterPriority}>
              <SelectTrigger className="w-[150px] bg-card"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ws.filterStatus} onValueChange={ws.setFilterStatus}>
              <SelectTrigger className="w-[180px] bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="planning">Planejamento</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="on_hold">Pausado</SelectItem>
                <SelectItem value="waiting_client">Aguardando cliente</SelectItem>
                <SelectItem value="test">Teste</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {ws.loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard title="Criadas" value={ws.kpis.created} icon={FolderKanban} color="text-info" variation={createdVar} />
                <KPICard title="Concluídas" value={ws.kpis.completed} icon={CheckCircle2} color="text-success" variation={completedVar} />
                <KPICard title="Em Atraso" value={ws.kpis.overdue} icon={AlertTriangle} color="text-warning" />
                <KPICard title="Em Andamento" value={ws.kpis.inProgress} icon={Clock} color="text-secondary" />
                <KPICard title="Sem Prazo" value={ws.kpis.withoutDeadline} icon={CalendarX} color="text-muted-foreground" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" /> % Conclusão
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                      {ws.kpis.completionRate.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-secondary" /> Lead Time Médio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                      {ws.kpis.avgLeadTimeDays.toFixed(1)} <span className="text-lg text-muted-foreground">dias</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4 text-success" /> SLA (no prazo)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                      {ws.kpis.slaRate.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily trend */}
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base">Tendência Diária (Seg → Dom)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={ws.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 15%)" />
                        <XAxis dataKey="label" stroke="hsl(215, 20%, 65%)" fontSize={12} />
                        <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} allowDecimals={false} />
                        <RechartsTooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 8%)", border: "1px solid hsl(222, 47%, 15%)", borderRadius: "8px" }} />
                        <Line type="monotone" dataKey="completed" stroke="hsl(142, 76%, 45%)" strokeWidth={2} name="Concluídas" dot={{ fill: "hsl(142, 76%, 45%)" }} />
                        <Line type="monotone" dataKey="created" stroke="hsl(199, 89%, 55%)" strokeWidth={2} name="Criadas" dot={{ fill: "hsl(199, 89%, 55%)" }} />
                        <Legend />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Completed by team */}
                {ws.teamRankings.length > 0 && (
                  <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-base">Concluídas por Equipe</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={ws.teamRankings}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 15%)" />
                          <XAxis dataKey="name" stroke="hsl(215, 20%, 65%)" fontSize={11} tick={{ fill: "hsl(215, 20%, 65%)" }} />
                          <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} allowDecimals={false} />
                          <RechartsTooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 8%)", border: "1px solid hsl(222, 47%, 15%)", borderRadius: "8px" }} />
                          <Bar dataKey="completed" fill="hsl(175, 70%, 50%)" radius={[4, 4, 0, 0]} name="Concluídas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Team Ranking Table */}
              {ws.teamRankings.length > 0 && (
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" /> Desempenho por Equipe
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipe</TableHead>
                          <TableHead className="text-center">Criadas</TableHead>
                          <TableHead className="text-center">Concluídas</TableHead>
                          <TableHead className="text-center">Em Atraso</TableHead>
                          <TableHead className="text-center">% Participação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ws.teamRankings.map(t => (
                          <TableRow key={t.name}>
                            <TableCell className="font-medium">{t.name}</TableCell>
                            <TableCell className="text-center">{t.created}</TableCell>
                            <TableCell className="text-center text-success">{t.completed}</TableCell>
                            <TableCell className="text-center text-warning">{t.overdue}</TableCell>
                            <TableCell className="text-center">{t.sharePercent.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Individual Ranking */}
              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-primary" /> Desempenho Individual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ws.personRankings.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum dado disponível para esta semana.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ws.personRankings.map((p, idx) => (
                        <Card key={p.name} className="bg-muted/30 border-border">
                          <CardContent className="pt-4 pb-3 px-4 space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {idx + 1}º
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{p.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  SLA: {p.sla.toFixed(0)}% · LT: {p.avgLeadTimeDays.toFixed(1)}d
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div>
                                <p className="text-success font-bold text-lg">{p.completed}</p>
                                <p className="text-muted-foreground">Concluídas</p>
                              </div>
                              <div>
                                <p className="text-info font-bold text-lg">{p.created}</p>
                                <p className="text-muted-foreground">Criadas</p>
                              </div>
                              <div>
                                <p className="text-warning font-bold text-lg">{p.overdue}</p>
                                <p className="text-muted-foreground">Em Atraso</p>
                              </div>
                            </div>
                            {p.topClients.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {p.topClients.map(c => (
                                  <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">{c}</Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Breakdowns Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* By Client */}
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base">Por Cliente (Top 10)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={ws.clientBreakdown} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, total }) => `${name.slice(0, 12)}… (${total})`} labelLine={false} fontSize={10}>
                          {ws.clientBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 8%)", border: "1px solid hsl(222, 47%, 15%)", borderRadius: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* By Priority */}
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base">Por Prioridade</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={ws.priorityBreakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 15%)" />
                        <XAxis type="number" stroke="hsl(215, 20%, 65%)" fontSize={12} allowDecimals={false} />
                        <YAxis type="category" dataKey="label" stroke="hsl(215, 20%, 65%)" fontSize={12} width={60} />
                        <RechartsTooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 8%)", border: "1px solid hsl(222, 47%, 15%)", borderRadius: "8px" }} />
                        <Bar dataKey="total" fill="hsl(280, 85%, 65%)" radius={[0, 4, 4, 0]} name="Atividades" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* By Status */}
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base">Por Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={ws.statusBreakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 15%)" />
                        <XAxis type="number" stroke="hsl(215, 20%, 65%)" fontSize={12} allowDecimals={false} />
                        <YAxis type="category" dataKey="label" stroke="hsl(215, 20%, 65%)" fontSize={11} width={100} />
                        <RechartsTooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 8%)", border: "1px solid hsl(222, 47%, 15%)", borderRadius: "8px" }} />
                        <Bar dataKey="total" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} name="Atividades" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Insights */}
              {ws.insights.length > 0 && (
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-warning" /> Insights & Riscos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {ws.insights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          {insight.type === "highlight" && <TrendingUp className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />}
                          {insight.type === "risk" && <ShieldAlert className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />}
                          {insight.type === "bottleneck" && <Zap className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />}
                          <p className="text-sm">{insight.text}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detail Table */}
              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-primary" /> Lista Detalhada ({ws.detailProjects.length} atividades)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Atividade</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criação</TableHead>
                          <TableHead>Prazo</TableHead>
                          <TableHead>Conclusão</TableHead>
                          <TableHead className="text-center">Dias Aberto</TableHead>
                          <TableHead>Situação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ws.detailProjects.slice(0, 200).map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                            <TableCell className="text-xs">{p.client_name}</TableCell>
                            <TableCell className="text-xs">{p.responsible || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                p.priority === "high" ? "border-warning/50 text-warning" :
                                p.priority === "low" ? "border-muted-foreground/50 text-muted-foreground" :
                                "border-info/50 text-info"
                              }>
                                {p.priority === "high" ? "Alta" : p.priority === "low" ? "Baixa" : "Média"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {p.status === "completed" ? "Concluído" :
                               p.status === "in_progress" ? "Em Andamento" :
                               p.status === "waiting_client" ? "Aguardando cliente" :
                               p.status === "test" ? "Teste" :
                               p.status === "on_hold" ? "Pausado" : "Planejamento"}
                            </TableCell>
                            <TableCell className="text-xs">{formatDateBR(p.created_at?.slice(0, 10))}</TableCell>
                            <TableCell className="text-xs">{formatDateBR(p.end_date)}</TableCell>
                            <TableCell className="text-xs">{formatDateBR(p.actual_end_date)}</TableCell>
                            <TableCell className="text-center text-xs">{p.status !== "completed" ? getOpenDays(p.created_at) : "—"}</TableCell>
                            <TableCell>{getBadgeStatus(p)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {ws.detailProjects.length > 200 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Exibindo 200 de {ws.detailProjects.length} atividades
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

// KPI Card sub-component
function KPICard({ title, value, icon: Icon, color, variation }: {
  title: string;
  value: number;
  icon: any;
  color: string;
  variation?: { pct: number; icon: any; color: string };
}) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all group overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">{value}</div>
        {variation && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${variation.color}`}>
            <variation.icon className="h-3 w-3" />
            <span>{variation.pct > 0 ? "+" : ""}{variation.pct.toFixed(0)}% vs sem. anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const WeeklySummary = () => (
  <SidebarProvider>
    <WeeklySummaryContent />
  </SidebarProvider>
);

export default WeeklySummary;
