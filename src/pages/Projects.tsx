import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  Calendar,
  LayoutGrid,
  Table as TableIcon,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  Users,
  FolderKanban,
  LogOut,
  Menu,
  UserCog,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";

const ProjectsContent = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]); // << NOVO
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const { state } = useSidebar();

  // Filters
  const [filterSprint, setFilterSprint] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterResponsible, setFilterResponsible] = useState("");

  // Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ projectId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);

    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();

    setProfile(profileData);
    fetchData();
  };

  const fetchData = async () => {
    const [projectsRes, clientsRes, teamsRes, managersRes] = await Promise.all([
      supabase
        .from("projects")
        .select(
          `
          *,
          clients (
            company_name
          )
        `,
        )
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("*").eq("status", "active"),
      supabase.from("teams").select("*").eq("status", "active").order("name"),
      supabase.from("profiles").select("id, full_name, role, email").eq("role", "admin"),
    ]);

    if (projectsRes.error) {
      toast.error("Erro ao carregar projetos");
    } else {
      setProjects(projectsRes.data || []);
    }

    if (!clientsRes.error) {
      setClients(clientsRes.data || []);
    }

    if (!teamsRes.error) {
      setTeams(teamsRes.data || []);
    }

    if (!managersRes.error) {
      setManagers(managersRes.data || []);
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const adminMenuItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Usuários", url: "/dashboard/users", icon: UserCog },
    { title: "Equipes", url: "/dashboard/teams", icon: Users },
    { title: "Clientes", url: "/dashboard/clients", icon: Building2 },
    { title: "Projetos", url: "/dashboard/projects", icon: FolderKanban },
  ];

  const clientMenuItems = [{ title: "Meus Projetos", url: "/dashboard", icon: FolderKanban }];

  const menuItems = profile?.role === "admin" ? adminMenuItems : clientMenuItems;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const startDate = formData.get("start_date") as string;
    const endDate = formData.get("end_date") as string;
    const actualStartDate = formData.get("actual_start_date") as string;
    const actualEndDate = formData.get("actual_end_date") as string;

      const projectData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      client_id: formData.get("client_id") as string,
      status: formData.get("status") as string,
      priority: formData.get("priority") as string,
      start_date: startDate || null,
      end_date: endDate || null,
      progress: parseInt(formData.get("progress") as string) || 0,
      observation: formData.get("observation") as string,
      client_observation: formData.get("client_observation") as string,
      responsible: formData.get("responsible") as string,
      sprint: formData.get("sprint") as string,
      actual_start_date: actualStartDate || null,
      actual_end_date: actualEndDate || null,
      area: formData.get("area") as string,
      project_manager_id: (formData.get("project_manager_id") as string) || null,
      demanda: formData.get("demanda") as string,
    };

    if (editingProject) {
      const { error } = await supabase.from("projects").update(projectData).eq("id", editingProject.id);

      if (error) {
        console.error("Erro ao atualizar projeto:", error);
        toast.error(`Erro ao atualizar projeto: ${error.message}`);
      } else {
        toast.success("Projeto atualizado com sucesso!");
        fetchData();
        setDialogOpen(false);
        setEditingProject(null);
      }
    } else {
      const { error } = await supabase.from("projects").insert([projectData]);

      if (error) {
        console.error("Erro ao inserir projeto:", error);
        toast.error(`Erro ao adicionar projeto: ${error.message}`);
      } else {
        toast.success("Projeto adicionado com sucesso!");
        fetchData();
        setDialogOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este projeto?")) return;

    const { error } = await supabase.from("projects").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao remover projeto");
    } else {
      toast.success("Projeto removido com sucesso!");
      fetchData();
    }
  };

  const handleEdit = (project: any) => {
    setEditingProject(project);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingProject(null);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: "bg-info",
      in_progress: "bg-warning",
      on_hold: "bg-destructive",
      completed: "bg-success",
      cancelled: "bg-destructive",
      test: "bg-purple-500",
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
      test: "Teste",
    };
    return labels[status] || status;
  };

  // << NOVO: helper para nome do gerente
  const getManagerName = (id: string | null) => {
    if (!id) return "—";
    const m = managers.find((x: any) => x.id === id);
    return m ? m.full_name || m.email : "—";
  };

  // Filter projects based on selected filters
  const filteredProjects = projects.filter((project) => {
    if (filterSprint && filterSprint !== "all" && project.sprint !== filterSprint) return false;
    if (filterArea && filterArea !== "all" && project.area !== filterArea) return false;
    if (filterClient && filterClient !== "all" && project.client_id !== filterClient) return false;
    
    // Special filter for overdue projects
    if (filterStatus === "overdue") {
      const now = new Date();
      const endDate = project.end_date ? new Date(project.end_date) : null;
      const isOverdue = endDate && endDate < now && project.status !== "completed" && project.status !== "cancelled";
      if (!isOverdue) return false;
    } else if (filterStatus && filterStatus !== "all" && project.status !== filterStatus) {
      return false;
    }
    
    if (filterResponsible && filterResponsible !== "all" && project.responsible !== filterResponsible) return false;
    return true;
  });

  // Sort filtered projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    // Handle nested client name
    if (sortColumn === "client") {
      aValue = a.clients?.company_name || "";
      bValue = b.clients?.company_name || "";
    }

    // Handle null/undefined values
    if (aValue == null) aValue = "";
    if (bValue == null) bValue = "";

    // Convert to string for comparison
    aValue = String(aValue).toLowerCase();
    bValue = String(bValue).toLowerCase();

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column with ascending order
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  // Get unique values for filters
  const uniqueSprints = [...new Set(projects.map((p) => p.sprint).filter(Boolean))].sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    return numA - numB;
  });
  const uniqueAreas = [...new Set(projects.map((p) => p.area).filter(Boolean))];
  const uniqueResponsibles = [...new Set(projects.map((p) => p.responsible).filter(Boolean))];

  const clearFilters = () => {
    setFilterSprint("all");
    setFilterArea("all");
    setFilterClient("all");
    setFilterStatus("all");
    setFilterResponsible("all");
  };

  const hasActiveFilters =
    (filterSprint && filterSprint !== "all") ||
    (filterArea && filterArea !== "all") ||
    (filterClient && filterClient !== "all") ||
    (filterStatus && filterStatus !== "all") ||
    (filterResponsible && filterResponsible !== "all");

  const startEditing = (projectId: string, field: string, currentValue: any) => {
    setEditingCell({ projectId, field });
    setEditValue(currentValue || "");
  };

  const saveEdit = async (projectId: string, field: string) => {
    if (!editingCell) return;

    const { error } = await supabase
      .from("projects")
      .update({ [field]: editValue || null })
      .eq("id", projectId);

    if (error) {
      toast.error(`Erro ao atualizar ${field}`);
    } else {
      toast.success("Atualizado com sucesso!");
      fetchData();
    }

    setEditingCell(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, projectId: string, field: string) => {
    if (e.key === "Enter") {
      saveEdit(projectId, field);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const renderEditableCell = (project: any, field: string, displayValue: string, isSelect = false, options?: { value: string; label: string }[]) => {
    const isEditing = editingCell?.projectId === project.id && editingCell?.field === field;

    if (isEditing && isSelect && options) {
      return (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(project.id, field)}
          onKeyDown={(e) => handleKeyDown(e, project.id, field)}
          autoFocus
          className="w-full px-2 py-1 border border-primary rounded-md bg-background text-sm"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (isEditing) {
      return (
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(project.id, field)}
          onKeyDown={(e) => handleKeyDown(e, project.id, field)}
          autoFocus
          className="h-8 text-sm"
        />
      );
    }

    return (
      <div
        onClick={() => startEditing(project.id, field, project[field])}
        className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors min-h-[32px] flex items-center"
      >
        {displayValue}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar className={state === "collapsed" ? "w-14" : "w-60"}>
        <div className="p-4 border-b border-sidebar-border">
          {state !== "collapsed" && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-lg blur-md opacity-60" />
                <div className="relative p-2 bg-card border border-primary/30 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <span className="font-bold text-lg bg-gradient-primary bg-clip-text text-transparent">Z3US</span>
                <p className="text-xs text-muted-foreground">Gestão Inteligente</p>
              </div>
            </div>
          )}
          {state === "collapsed" && (
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-lg blur-md opacity-60" />
                <div className="relative p-2 bg-card border border-primary/30 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>
          )}
        </div>

        <SidebarContent>
          <SidebarGroup>
            {state !== "collapsed" && <SidebarGroupLabel>Menu</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) =>
                          isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        {state !== "collapsed" && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="mt-auto p-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              {state !== "collapsed" && <span className="ml-2">Sair</span>}
            </Button>
          </div>
        </SidebarContent>
      </Sidebar>

      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-border bg-card flex items-center px-6">
          <SidebarTrigger>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SidebarTrigger>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{profile?.full_name || user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">Gerenciar Projetos</h1>
                <p className="text-muted-foreground">Cadastre e gerencie projetos</p>
              </div>
              <div className="flex gap-2">
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === "cards" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("cards")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                  >
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </div>
                <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Projeto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingProject ? "Editar Projeto" : "Adicionar Novo Projeto"}</DialogTitle>
                      <DialogDescription>Preencha os dados do projeto</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Título do Projeto</Label>
                        <Input id="title" name="title" defaultValue={editingProject?.title} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                          id="description"
                          name="description"
                          defaultValue={editingProject?.description}
                          rows={3}
                        />
                      </div>

                      {/* Linha 1: Cliente + Gerente + Status (mantém o grid 2 col; o 3º campo quebra para a próxima linha automaticamente) */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="client_id">Cliente</Label>
                          <select
                            id="client_id"
                            name="client_id"
                            defaultValue={editingProject?.client_id}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                            required
                          >
                            <option value="">Selecione um cliente</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.company_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* << NOVO: Gerente do Projeto */}
                        <div className="space-y-2">
                          <Label htmlFor="project_manager_id">Gerente do Projeto</Label>
                          <select
                            id="project_manager_id"
                            name="project_manager_id"
                            defaultValue={editingProject?.project_manager_id || ""}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          >
                            <option value="">Selecione um gerente</option>
                            {managers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name || m.email}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <select
                            id="status"
                            name="status"
                            defaultValue={editingProject?.status || "planning"}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          >
                            <option value="planning">Planejamento</option>
                            <option value="in_progress">Em Andamento</option>
                            <option value="on_hold">Pausado</option>
                            <option value="test">Teste</option>
                            <option value="completed">Concluído</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                        </div>
                      </div>

                      {/* Linha 2: Prioridade + Datas */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="priority">Prioridade</Label>
                          <select
                            id="priority"
                            name="priority"
                            defaultValue={editingProject?.priority || "medium"}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          >
                            <option value="low">Baixa</option>
                            <option value="medium">Média</option>
                            <option value="high">Alta</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="start_date">Data de Início</Label>
                          <Input
                            id="start_date"
                            name="start_date"
                            type="date"
                            defaultValue={editingProject?.start_date}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end_date">Data de Término</Label>
                          <Input id="end_date" name="end_date" type="date" defaultValue={editingProject?.end_date} />
                        </div>
                      </div>

                      {/* Linha 3: Área + Responsável + Sprint */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="area">Área</Label>
                          <select
                            id="area"
                            name="area"
                            defaultValue={editingProject?.area}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          >
                            <option value="">Selecione uma área</option>
                            <option value="Aereo">Aéreo</option>
                            <option value="Maritimo">Marítimo</option>
                            <option value="Desembaraço">Desembaraço</option>
                            <option value="Financeiro">Financeiro</option>
                            <option value="Operacional">Operacional</option>
                            <option value="Recursos Humanos">Recursos Humanos</option>
                            <option value="Cliente">Cliente</option>
                            <option value="Comercial">Comercial</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="responsible">Responsável</Label>
                          <select
                            id="responsible"
                            name="responsible"
                            defaultValue={editingProject?.responsible}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          >
                            <option value="">Selecione um responsável</option>
                            {teams.map((team) => (
                              <option key={team.id} value={team.name}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sprint">Sprint</Label>
                          <Input id="sprint" name="sprint" defaultValue={editingProject?.sprint} />
                        </div>
                      </div>

                      {/* Linha 4: Datas reais + Progresso */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="actual_start_date">Data Real Início</Label>
                          <Input
                            id="actual_start_date"
                            name="actual_start_date"
                            type="date"
                            defaultValue={editingProject?.actual_start_date}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="actual_end_date">Data Real Término</Label>
                          <Input
                            id="actual_end_date"
                            name="actual_end_date"
                            type="date"
                            defaultValue={editingProject?.actual_end_date}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="progress">Progresso (%)</Label>
                          <Input
                            id="progress"
                            name="progress"
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={editingProject?.progress || 0}
                          />
                        </div>
                      </div>

                      {/* Observação Interna */}
                      <div className="space-y-2">
                        <Label htmlFor="observation">Observação Interna</Label>
                        <Textarea
                          id="observation"
                          name="observation"
                          defaultValue={editingProject?.observation}
                          rows={3}
                        />
                      </div>

                      {/* Observação para o Cliente */}
                      <div className="space-y-2">
                        <Label htmlFor="client_observation">Observação para o Cliente</Label>
                        <Textarea
                          id="client_observation"
                          name="client_observation"
                          defaultValue={editingProject?.client_observation}
                          rows={3}
                          placeholder="Esta observação será visível para o cliente no dashboard dele"
                        />
                      </div>

                      {/* Demanda */}
                      <div className="space-y-2">
                        <Label htmlFor="demanda">Demanda</Label>
                        <Input
                          id="demanda"
                          name="demanda"
                          defaultValue={editingProject?.demanda}
                          placeholder="Ex: Desenvolvimento de sistema"
                        />
                      </div>

                      <Button type="submit" className="w-full">
                        {editingProject ? "Atualizar" : "Adicionar"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {projects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum projeto cadastrado</p>
                </CardContent>
              </Card>
            ) : viewMode === "cards" ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sortedProjects.map((project) => (
                  <Card key={project.id} className="hover:shadow-lg transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                        <Badge className={getStatusColor(project.status)}>{getStatusLabel(project.status)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description || "Sem descrição"}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{project.clients?.company_name}</span>
                      </div>

                      {/* << NOVO: Mostra gerente quando houver */}
                      {project.project_manager_id && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Gerente:</span>{" "}
                          <span className="font-medium">{getManagerName(project.project_manager_id)}</span>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {project.area && <Badge variant="outline">{project.area}</Badge>}
                        {project.sprint && <Badge variant="secondary">Sprint: {project.sprint}</Badge>}
                        {project.priority && (
                          <Badge
                            variant={
                              project.priority === "high"
                                ? "destructive"
                                : project.priority === "medium"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {project.priority === "high" ? "Alta" : project.priority === "medium" ? "Média" : "Baixa"}
                          </Badge>
                        )}
                      </div>

                      {project.responsible && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Responsável:</span>{" "}
                          <span className="font-medium">{project.responsible}</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-medium">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-2" />
                      </div>

                      {project.end_date && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Entrega: {new Date(project.end_date).toLocaleDateString("pt-BR")}</span>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(project)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  {/* Filters */}
                  <div className="mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Filtros</h3>
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                          <X className="h-4 w-4 mr-1" />
                          Limpar Filtros
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Sprint</Label>
                        <Select value={filterSprint || "all"} onValueChange={setFilterSprint}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {uniqueSprints.map((sprint) => (
                              <SelectItem key={sprint} value={sprint}>
                                {sprint}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Área</Label>
                        <Select value={filterArea || "all"} onValueChange={setFilterArea}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {uniqueAreas.map((area) => (
                              <SelectItem key={area} value={area}>
                                {area}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Cliente</Label>
                        <Select value={filterClient || "all"} onValueChange={setFilterClient}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Status</Label>
                        <Select value={filterStatus || "all"} onValueChange={setFilterStatus}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="overdue" className="text-destructive font-semibold">Em Atraso</SelectItem>
                            <SelectItem value="planning">Planejamento</SelectItem>
                            <SelectItem value="in_progress">Em Andamento</SelectItem>
                            <SelectItem value="on_hold">Pausado</SelectItem>
                            <SelectItem value="test">Teste</SelectItem>
                            <SelectItem value="completed">Concluído</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Responsável</Label>
                        <Select value={filterResponsible || "all"} onValueChange={setFilterResponsible}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {uniqueResponsibles.map((responsible) => (
                              <SelectItem key={responsible} value={responsible}>
                                {responsible}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("sprint")}
                        >
                          <div className="flex items-center">
                            Sprint
                            <SortIcon column="sprint" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("area")}
                        >
                          <div className="flex items-center">
                            Área
                            <SortIcon column="area" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("title")}
                        >
                          <div className="flex items-center">
                            Título
                            <SortIcon column="title" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("client")}
                        >
                          <div className="flex items-center">
                            Cliente
                            <SortIcon column="client" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("status")}
                        >
                          <div className="flex items-center">
                            Status
                            <SortIcon column="status" />
                          </div>
                        </TableHead>

                        {/* << NOVO: Cabeçalho Gerente */}
                        <TableHead>Gerente</TableHead>

                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("progress")}
                        >
                          <div className="flex items-center">
                            Progresso
                            <SortIcon column="progress" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("end_date")}
                        >
                          <div className="flex items-center">
                            Dt Entrega
                            <SortIcon column="end_date" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("responsible")}
                        >
                          <div className="flex items-center">
                            Responsável
                            <SortIcon column="responsible" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("observation")}
                        >
                          <div className="flex items-center">
                            Observações
                            <SortIcon column="observation" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("demanda")}
                        >
                          <div className="flex items-center">
                            Demanda
                            <SortIcon column="demanda" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedProjects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell>
                            {renderEditableCell(project, "sprint", project.sprint || "-")}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(
                              project,
                              "area",
                              project.area || "-",
                              true,
                              [
                                { value: "", label: "Nenhuma" },
                                { value: "Aereo", label: "Aéreo" },
                                { value: "Maritimo", label: "Marítimo" },
                                { value: "Desembaraço", label: "Desembaraço" },
                                { value: "Financeiro", label: "Financeiro" },
                                { value: "Operacional", label: "Operacional" },
                                { value: "Recursos Humanos", label: "Recursos Humanos" },
                                { value: "Cliente", label: "Cliente" },
                                { value: "Comercial", label: "Comercial" },
                              ]
                            )}
                          </TableCell>
                          <TableCell className="max-w-md">
                            {renderEditableCell(project, "title", project.title)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{project.clients?.company_name}</span>
                          </TableCell>
                          <TableCell>
                            {editingCell?.projectId === project.id && editingCell?.field === "status" ? (
                              <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(project.id, "status")}
                                onKeyDown={(e) => handleKeyDown(e, project.id, "status")}
                                autoFocus
                                className="w-full px-2 py-1 border border-primary rounded-md bg-background text-sm"
                              >
                                <option value="planning">Planejamento</option>
                                <option value="in_progress">Em Andamento</option>
                                <option value="on_hold">Pausado</option>
                                <option value="test">Teste</option>
                                <option value="completed">Concluído</option>
                                <option value="cancelled">Cancelado</option>
                              </select>
                            ) : (
                              <Badge
                                className={`${getStatusColor(project.status)} cursor-pointer`}
                                onClick={() => startEditing(project.id, "status", project.status)}
                              >
                                {getStatusLabel(project.status)}
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            {editingCell?.projectId === project.id && editingCell?.field === "project_manager_id" ? (
                              <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(project.id, "project_manager_id")}
                                onKeyDown={(e) => handleKeyDown(e, project.id, "project_manager_id")}
                                autoFocus
                                className="w-full px-2 py-1 border border-primary rounded-md bg-background text-sm"
                              >
                                <option value="">Nenhum</option>
                                {managers.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.full_name || m.email}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onClick={() => startEditing(project.id, "project_manager_id", project.project_manager_id)}
                                className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                              >
                                {getManagerName(project.project_manager_id)}
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            {editingCell?.projectId === project.id && editingCell?.field === "progress" ? (
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(project.id, "progress")}
                                onKeyDown={(e) => handleKeyDown(e, project.id, "progress")}
                                autoFocus
                                className="h-8 w-20 text-sm"
                              />
                            ) : (
                              <div
                                onClick={() => startEditing(project.id, "progress", project.progress)}
                                className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <Progress value={project.progress} className="h-2 w-20" />
                                  <span className="text-sm">{project.progress}%</span>
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingCell?.projectId === project.id && editingCell?.field === "end_date" ? (
                              <Input
                                type="date"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(project.id, "end_date")}
                                onKeyDown={(e) => handleKeyDown(e, project.id, "end_date")}
                                autoFocus
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div
                                onClick={() => startEditing(project.id, "end_date", project.end_date)}
                                className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                              >
                                {project.end_date ? new Date(project.end_date).toLocaleDateString("pt-BR") : "-"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingCell?.projectId === project.id && editingCell?.field === "responsible" ? (
                              <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(project.id, "responsible")}
                                onKeyDown={(e) => handleKeyDown(e, project.id, "responsible")}
                                autoFocus
                                className="w-full px-2 py-1 border border-primary rounded-md bg-background text-sm"
                              >
                                <option value="">Nenhum</option>
                                {teams.map((team) => (
                                  <option key={team.id} value={team.name}>
                                    {team.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onClick={() => startEditing(project.id, "responsible", project.responsible)}
                                className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                              >
                                {project.responsible || "-"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {renderEditableCell(
                              project,
                              "observation",
                              project.observation || "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(project, "demanda", project.demanda || "-")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(project)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const Projects = () => {
  return (
    <SidebarProvider>
      <ProjectsContent />
    </SidebarProvider>
  );
};

export default Projects;
