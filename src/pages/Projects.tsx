import { useEffect, useState } from "react";
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
import { Plus, Edit2, Trash2, Building2, Calendar, LayoutGrid, Table as TableIcon, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Projects = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  
  // Filters
  const [filterSprint, setFilterSprint] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterResponsible, setFilterResponsible] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [projectsRes, clientsRes] = await Promise.all([
      supabase
        .from("projects")
        .select(`
          *,
          clients (
            company_name
          )
        `)
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("*").eq("status", "active"),
    ]);

    if (projectsRes.error) {
      toast.error("Erro ao carregar projetos");
    } else {
      setProjects(projectsRes.data || []);
    }

    if (!clientsRes.error) {
      setClients(clientsRes.data || []);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const projectData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      client_id: formData.get("client_id") as string,
      status: formData.get("status") as string,
      priority: formData.get("priority") as string,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string,
      progress: parseInt(formData.get("progress") as string) || 0,
      observation: formData.get("observation") as string,
      responsible: formData.get("responsible") as string,
      sprint: formData.get("sprint") as string,
      actual_start_date: formData.get("actual_start_date") as string,
      actual_end_date: formData.get("actual_end_date") as string,
      area: formData.get("area") as string,
    };

    if (editingProject) {
      const { error } = await supabase
        .from("projects")
        .update(projectData)
        .eq("id", editingProject.id);

      if (error) {
        toast.error("Erro ao atualizar projeto");
      } else {
        toast.success("Projeto atualizado com sucesso!");
        fetchData();
        setDialogOpen(false);
        setEditingProject(null);
      }
    } else {
      const { error } = await supabase.from("projects").insert([projectData]);

      if (error) {
        toast.error("Erro ao adicionar projeto");
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

  // Filter projects based on selected filters
  const filteredProjects = projects.filter((project) => {
    if (filterSprint && filterSprint !== "all" && project.sprint !== filterSprint) return false;
    if (filterArea && filterArea !== "all" && project.area !== filterArea) return false;
    if (filterClient && filterClient !== "all" && project.client_id !== filterClient) return false;
    if (filterStatus && filterStatus !== "all" && project.status !== filterStatus) return false;
    if (filterResponsible && filterResponsible !== "all" && project.responsible !== filterResponsible) return false;
    return true;
  });

  // Get unique values for filters
  const uniqueSprints = [...new Set(projects.map(p => p.sprint).filter(Boolean))];
  const uniqueAreas = [...new Set(projects.map(p => p.area).filter(Boolean))];
  const uniqueResponsibles = [...new Set(projects.map(p => p.responsible).filter(Boolean))];

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

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
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
              <DialogTitle>
                {editingProject ? "Editar Projeto" : "Adicionar Novo Projeto"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do projeto
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título do Projeto</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={editingProject?.title}
                  required
                />
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
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              </div>
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
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    defaultValue={editingProject?.end_date}
                  />
                </div>
              </div>
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
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsible">Responsável</Label>
                  <Input
                    id="responsible"
                    name="responsible"
                    defaultValue={editingProject?.responsible}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sprint">Sprint</Label>
                  <Input
                    id="sprint"
                    name="sprint"
                    defaultValue={editingProject?.sprint}
                  />
                </div>
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="observation">Observação</Label>
                <Textarea
                  id="observation"
                  name="observation"
                  defaultValue={editingProject?.observation}
                  rows={3}
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
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{project.title}</CardTitle>
                  <Badge className={getStatusColor(project.status)}>
                    {getStatusLabel(project.status)}
                  </Badge>
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
                
                <div className="flex gap-2 flex-wrap">
                  {project.area && <Badge variant="outline">{project.area}</Badge>}
                  {project.sprint && <Badge variant="secondary">Sprint: {project.sprint}</Badge>}
                  {project.priority && (
                    <Badge variant={
                      project.priority === "high" ? "destructive" : 
                      project.priority === "medium" ? "default" : 
                      "secondary"
                    }>
                      {project.priority === "high" ? "Alta" : 
                       project.priority === "medium" ? "Média" : "Baixa"}
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
                    <span>
                      Entrega: {new Date(project.end_date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(project)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(project.id)}
                  >
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-8"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Sprint</Label>
                  <Select value={filterSprint || "all"} onValueChange={setFilterSprint}>
                    <SelectTrigger className="h-9">
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
                    <SelectTrigger className="h-9">
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
                    <SelectTrigger className="h-9">
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
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="planning">Planejamento</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="on_hold">Pausado</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Responsável</Label>
                  <Select value={filterResponsible || "all"} onValueChange={setFilterResponsible}>
                    <SelectTrigger className="h-9">
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
                  <TableHead>Sprint</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Dt Entrega</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>{project.sprint || "-"}</TableCell>
                    <TableCell>
                      {project.area && <Badge variant="outline">{project.area}</Badge>}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="line-clamp-2">{project.title}</div>
                    </TableCell>
                    <TableCell>{project.clients?.company_name}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(project.status)}>
                        {getStatusLabel(project.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={project.progress} className="h-2 w-20" />
                        <span className="text-sm">{project.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.end_date
                        ? new Date(project.end_date).toLocaleDateString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell>{project.responsible || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(project)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(project.id)}
                        >
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
  );
};

export default Projects;
