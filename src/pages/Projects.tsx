import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateBR } from "@/lib/utils";
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
  FileText,
  Download,
  Upload,
  FileSpreadsheet,
  FileDown, Sparkles
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  const [clientProjects, setClientProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const { state } = useSidebar();

  // Form-controlled fields (cliente + projeto do cliente)
  const [formClientId, setFormClientId] = useState<string>("");
  const [formClientProjectId, setFormClientProjectId] = useState<string>("");

  // Filters
  const [filterSprint, setFilterSprint] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterClientProject, setFilterClientProject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterResponsible, setFilterResponsible] = useState("");

  // Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ projectId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");


  useEffect(() => {
    checkUser();
  }, []);

  // Reset pagination when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSprint, filterArea, filterClient, filterClientProject, filterStatus, filterResponsible, sortColumn, sortDirection]);

  // Reset project filter when client filter changes
  useEffect(() => {
    setFilterClientProject("all");
  }, [filterClient]);


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
    const [projectsRes, clientsRes, teamsRes, managersRes, clientProjectsRes] = await Promise.all([
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
        .order("end_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase.from("clients").select("*").eq("status", "active"),
      supabase.from("teams").select("*").eq("status", "active").order("name"),
      supabase.from("profiles").select("id, full_name, role, email").eq("role", "admin"),
      (supabase as any).from("client_projects").select("id, client_id, name").order("name"),
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

    if (!clientProjectsRes.error) {
      setClientProjects(clientProjectsRes.data || []);
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
    { title: "Gestão de Sprints", url: "/dashboard/novos-projetos", icon: Sparkles },
    { title: "Documentação", url: "/dashboard/documentation", icon: FileText },
  ];

  const clientMenuItems = [
    { title: "Meus Projetos", url: "/dashboard", icon: FolderKanban },
    { title: "Documentação", url: "/dashboard/documentation", icon: FileText },
  ];

  const menuItems = profile?.role === "admin" ? adminMenuItems : clientMenuItems;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const startDate = formData.get("start_date") as string;
    const endDate = formData.get("end_date") as string;
    const actualStartDate = formData.get("actual_start_date") as string;
    const actualEndDate = formData.get("actual_end_date") as string;

      const status = formData.get("status") as string;
      let responsible = formData.get("responsible") as string;
      let responsibleBeforeClient: string | null = editingProject?.responsible_before_client || null;

      if (status === "waiting_client") {
        // Salva o responsável atual antes de mudar para "Cliente"
        if (editingProject && editingProject.status !== "waiting_client") {
          responsibleBeforeClient = editingProject.responsible || null;
        }
        responsible = "Cliente";
      } else if (editingProject?.status === "waiting_client" && status !== "waiting_client") {
        // Restaura o responsável anterior ao sair de "waiting_client"
        if (editingProject.responsible_before_client) {
          responsible = editingProject.responsible_before_client;
          responsibleBeforeClient = null;
        }
      }
      
      const projectData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      client_id: (formClientId || (formData.get("client_id") as string)) as string,
      client_project_id: formClientProjectId || null,
      status: status,
      priority: formData.get("priority") as string,
      start_date: startDate || null,
      end_date: endDate || null,
      progress: parseInt(formData.get("progress") as string) || 0,
      observation: formData.get("observation") as string,
      client_observation: formData.get("client_observation") as string,
      responsible: responsible,
      responsible_before_client: responsibleBeforeClient,
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
    setFormClientId(project.client_id || "");
    setFormClientProjectId(project.client_project_id || "");
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingProject(null);
      setFormClientId("");
      setFormClientProjectId("");
    }
  };

  const handleCreateClientProject = async () => {
    if (!formClientId) {
      toast.error("Selecione um cliente primeiro");
      return;
    }
    const name = window.prompt("Nome do novo projeto (ex: Faturamento, Ciclope):");
    if (!name || !name.trim()) return;
    const { data, error } = await (supabase as any)
      .from("client_projects")
      .insert({ client_id: formClientId, name: name.trim() })
      .select()
      .single();
    if (error) {
      toast.error(`Erro ao criar projeto: ${error.message}`);
      return;
    }
    setClientProjects((prev) => [...prev, data]);
    setFormClientProjectId(data.id);
    toast.success("Projeto criado!");
  };



  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: "bg-info",
      in_progress: "bg-warning",
      on_hold: "bg-destructive",
      completed: "bg-success",
      cancelled: "bg-destructive",
      test: "bg-purple-500",
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
      test: "Teste",
      waiting_client: "Aguardando Cliente",
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
    if (filterClientProject && filterClientProject !== "all" && project.client_project_id !== filterClientProject) return false;

    // Special filter for overdue projects
    if (filterStatus === "overdue") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endDate = project.end_date ? new Date(project.end_date) : null;
      // Only consider overdue if end_date < today (not equal), and not completed, cancelled, waiting_client, or test
      const isOverdue = endDate && endDate < today && project.status !== "completed" && project.status !== "cancelled" && project.status !== "waiting_client" && project.status !== "test";
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

  // Pagination logic
  const totalPages = Math.ceil(sortedProjects.length / itemsPerPage);
  const paginatedProjects = sortedProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPaginationPages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

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
  const activeTeamNames = new Set(teams.map((t: any) => t.name));
  const uniqueResponsibles = [...new Set(projects.map((p) => p.responsible).filter(Boolean))]
    .filter((r) => activeTeamNames.has(r));
  const uniqueClientProjects = [...new Set(projects.map((p) => p.client_project_id).filter(Boolean))]
    .map((id) => clientProjects.find((cp) => cp.id === id))
    .filter(Boolean)
    .filter((cp: any) => !filterClient || filterClient === "all" || cp.client_id === filterClient);


  const clearFilters = () => {
    setFilterSprint("all");
    setFilterArea("all");
    setFilterClient("all");
    setFilterClientProject("all");
    setFilterStatus("all");
    setFilterResponsible("all");
  };

  const hasActiveFilters =
    (filterSprint && filterSprint !== "all") ||
    (filterArea && filterArea !== "all") ||
    (filterClient && filterClient !== "all") ||
    (filterClientProject && filterClientProject !== "all") ||
    (filterStatus && filterStatus !== "all") ||
    (filterResponsible && filterResponsible !== "all");

  const startEditing = (projectId: string, field: string, currentValue: any) => {
    setEditingCell({ projectId, field });
    setEditValue(currentValue || "");
  };

  const saveEdit = async (projectId: string, field: string) => {
    if (!editingCell) return;

    // Se o campo for status e o valor for "completed", atualiza também o progresso para 100% e a data real de término
    // Se o campo for status e o valor for "waiting_client", atualiza o responsável para "Cliente"
    const updateData: Record<string, any> = { [field]: editValue || null };
    if (field === "status" && editValue === "completed") {
      updateData.progress = 100;
      // Auto-set actual_end_date to today when marking as completed
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      updateData.actual_end_date = `${year}-${month}-${day}`;
    }
    if (field === "status" && editValue === "waiting_client") {
      const project = projects.find(p => p.id === projectId);
      updateData.responsible_before_client = project?.responsible || null;
      updateData.responsible = "Cliente";
    } else if (field === "status" && editValue !== "waiting_client") {
      const project = projects.find(p => p.id === projectId);
      if (project?.status === "waiting_client" && project?.responsible_before_client) {
        updateData.responsible = project.responsible_before_client;
        updateData.responsible_before_client = null;
      }
    }

    // Atualização otimista - atualiza o estado local imediatamente
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, ...updateData } : p
      )
    );

    // Limpa o estado de edição imediatamente para feedback instantâneo
    setEditingCell(null);
    setEditValue("");

    // Salva no banco em background
    const { error } = await supabase
      .from("projects")
      .update(updateData as any)
      .eq("id", projectId);

    if (error) {
      toast.error(`Erro ao atualizar ${field}`);
      // Em caso de erro, recarrega os dados para sincronizar
      fetchData();
    } else {
      toast.success("Atualizado!");
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const getExportRows = () => {
    return sortedProjects.map((p) => ({
      "Título": p.title || "",
      "Demanda": p.demanda || "",
      "Cliente": p.clients?.company_name || "",
      "Projeto do Cliente": clientProjects.find((cp) => cp.id === p.client_project_id)?.name || "",
      "Área": p.area || "",
      "Sprint": p.sprint || "",
      "Status": getStatusLabel(p.status),
      "Prioridade": p.priority === "high" ? "Alta" : p.priority === "low" ? "Baixa" : "Média",
      "Responsável": p.responsible || "",
      "Gerente": getManagerName(p.project_manager_id),
      "Progresso (%)": p.progress ?? 0,
      "Início Previsto": formatDateBR(p.start_date) || "",
      "Término Previsto": formatDateBR(p.end_date) || "",
      "Início Real": formatDateBR(p.actual_start_date) || "",
      "Término Real": formatDateBR(p.actual_end_date) || "",
      "Descrição": p.description || "",
      "Observação": p.observation || "",
      "Observação do Cliente": p.client_observation || "",
    }));
  };

  const getExportFilename = (ext: string) => {
    const parts: string[] = ["projetos"];
    if (filterClient && filterClient !== "all") {
      const c = clients.find((x) => x.id === filterClient);
      if (c?.company_name) parts.push(c.company_name.replace(/\s+/g, "_"));
    }
    if (filterSprint && filterSprint !== "all") parts.push(`sprint-${filterSprint}`);
    const today = new Date().toISOString().slice(0, 10);
    parts.push(today);
    return `${parts.join("_")}.${ext}`;
  };

  const exportToExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) {
      toast.error("Nenhum projeto para exportar");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0]).map((k) => ({
      wch: Math.min(50, Math.max(k.length, ...rows.map((r) => String((r as any)[k] || "").length)) + 2),
    }));
    (ws as any)["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projetos");
    XLSX.writeFile(wb, getExportFilename("xlsx"));
    toast.success(`${rows.length} projeto(s) exportado(s)`);
  };

  const exportToPdf = () => {
    const rows = getExportRows();
    if (rows.length === 0) {
      toast.error("Nenhum projeto para exportar");
      return;
    }
    const pdf = new jsPDF("l", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Relatório de Projetos", margin, 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const filterInfo: string[] = [];
    if (filterClient && filterClient !== "all") {
      filterInfo.push(`Cliente: ${clients.find((x) => x.id === filterClient)?.company_name || ""}`);
    }
    if (filterClientProject && filterClientProject !== "all") {
      filterInfo.push(`Projeto: ${clientProjects.find((x) => x.id === filterClientProject)?.name || ""}`);
    }
    if (filterSprint && filterSprint !== "all") filterInfo.push(`Sprint: ${filterSprint}`);
    if (filterArea && filterArea !== "all") filterInfo.push(`Área: ${filterArea}`);
    if (filterStatus && filterStatus !== "all") filterInfo.push(`Status: ${filterStatus}`);
    if (filterResponsible && filterResponsible !== "all") filterInfo.push(`Responsável: ${filterResponsible}`);
    pdf.text(
      `${filterInfo.join(" | ") || "Todos os projetos"} — Total: ${rows.length}`,
      margin,
      20
    );

    const headers = ["Título", "Cliente", "Status", "Prior.", "Responsável", "Prazo", "Prog."];
    const colW = [70, 45, 32, 18, 40, 22, 18];
    let y = 28;
    const rowH = 6;

    const drawHeader = () => {
      pdf.setFillColor(30, 41, 59);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.rect(margin, y, colW.reduce((a, b) => a + b, 0), rowH, "F");
      let x = margin;
      headers.forEach((h, i) => {
        pdf.text(h, x + 1.5, y + 4);
        x += colW[i];
      });
      y += rowH;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
    };

    drawHeader();

    rows.forEach((r, idx) => {
      if (y + rowH > pageH - margin) {
        pdf.addPage();
        y = margin + 4;
        drawHeader();
      }
      if (idx % 2 === 0) {
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, y, colW.reduce((a, b) => a + b, 0), rowH, "F");
      }
      const cells = [
        r["Título"],
        r["Cliente"],
        r["Status"],
        r["Prioridade"],
        r["Responsável"],
        r["Término Previsto"],
        String(r["Progresso (%)"]) + "%",
      ];
      let x = margin;
      cells.forEach((c, i) => {
        const maxChars = Math.floor(colW[i] / 1.6);
        const text = String(c || "");
        pdf.text(text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text, x + 1.5, y + 4);
        x += colW[i];
      });
      y += rowH;
    });

    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7);
      pdf.setTextColor(120);
      pdf.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 4, { align: "right" });
    }

    pdf.save(getExportFilename("pdf"));
    toast.success(`${rows.length} projeto(s) exportado(s)`);
  };

  const parseImportDate = (v: any): string | null => {
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    if (typeof v === "number") {
      // Excel serial date
      const utc = Math.round((v - 25569) * 86400 * 1000);
      const dt = new Date(utc);
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    }
    const s = String(v).trim();
    if (!s || s === "-") return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      const [, d, mo, y] = m;
      const yr = y.length === 2 ? `20${y}` : y;
      return `${yr}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  };

  const mapImportStatus = (v: any): string => {
    const s = String(v || "").toLowerCase().trim();
    if (!s) return "planning";
    if (s.includes("conclu")) return "completed";
    if (s.includes("andam") || s.includes("progress")) return "in_progress";
    if (s.includes("aguard") || s.includes("client")) return "waiting_client";
    if (s.includes("pausa") || s.includes("hold")) return "on_hold";
    if (s.includes("cancel")) return "cancelled";
    if (s.includes("teste") || s === "test") return "test";
    return "planning";
  };

  const mapImportPriority = (v: any): string => {
    const s = String(v || "").toLowerCase().trim();
    if (s.startsWith("alt") || s === "high") return "high";
    if (s.startsWith("bai") || s === "low") return "low";
    if (s.startsWith("crit") || s === "critical") return "critical";
    return "medium";
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null, raw: true });

      if (!rows.length) {
        toast.error("Planilha vazia");
        return;
      }

      const norm = (s: string) => (s || "").toString().trim().toLowerCase();
      const clientByName = new Map(clients.map((c) => [norm(c.company_name), c.id]));
      const projectsByClient = new Map<string, Map<string, string>>();
      clientProjects.forEach((cp: any) => {
        if (!projectsByClient.has(cp.client_id)) projectsByClient.set(cp.client_id, new Map());
        projectsByClient.get(cp.client_id)!.set(norm(cp.name), cp.id);
      });
      const managerByName = new Map(managers.map((m: any) => [norm(m.full_name), m.id]));

      const toInsert: any[] = [];
      const errors: string[] = [];

      rows.forEach((r, idx) => {
        const get = (keys: string[]) => {
          for (const k of keys) {
            for (const rk of Object.keys(r)) {
              if (norm(rk) === norm(k)) return r[rk];
            }
          }
          return null;
        };
        const title = get(["Título", "Titulo", "Title"]);
        if (!title) return;
        const clientName = get(["Cliente", "Client"]);
        const clientId = clientByName.get(norm(clientName));
        if (!clientId) {
          errors.push(`Linha ${idx + 2}: cliente "${clientName}" não encontrado`);
          return;
        }
        const projName = get(["Projeto do Cliente", "Projeto", "Project"]);
        let clientProjectId: string | null = null;
        if (projName) {
          clientProjectId = projectsByClient.get(clientId)?.get(norm(projName)) || null;
        }
        const managerName = get(["Gerente", "Manager"]);
        const managerId = managerName ? managerByName.get(norm(managerName)) || null : null;

        toInsert.push({
          title: String(title),
          demanda: get(["Demanda"]) ? String(get(["Demanda"])) : null,
          client_id: clientId,
          client_project_id: clientProjectId,
          area: get(["Área", "Area"]) ? String(get(["Área", "Area"])) : null,
          sprint: get(["Sprint"]) !== null ? String(get(["Sprint"])) : null,
          status: mapImportStatus(get(["Status"])),
          priority: mapImportPriority(get(["Prioridade", "Priority"])),
          responsible: get(["Responsável", "Responsavel", "Responsible"]) ? String(get(["Responsável", "Responsavel", "Responsible"])) : null,
          project_manager_id: managerId,
          progress: (() => {
            const p = get(["Progresso (%)", "Progresso", "Progress"]);
            const n = p === null || p === "" ? null : Number(p);
            return Number.isFinite(n) ? n : null;
          })(),
          start_date: parseImportDate(get(["Início Previsto", "Inicio Previsto", "Start"])),
          end_date: parseImportDate(get(["Término Previsto", "Termino Previsto", "End"])),
          actual_start_date: parseImportDate(get(["Início Real", "Inicio Real"])),
          actual_end_date: parseImportDate(get(["Término Real", "Termino Real"])),
          description: get(["Descrição", "Descricao", "Description"]) ? String(get(["Descrição", "Descricao", "Description"])) : null,
          observation: get(["Observação", "Observacao", "Observation"]) ? String(get(["Observação", "Observacao", "Observation"])) : null,
          client_observation: get(["Observação do Cliente", "Observacao do Cliente"]) ? String(get(["Observação do Cliente", "Observacao do Cliente"])) : null,
        });
      });

      if (!toInsert.length) {
        toast.error("Nenhuma linha válida" + (errors.length ? `: ${errors[0]}` : ""));
        return;
      }

      toast.loading(`Importando ${toInsert.length} demanda(s)...`, { id: "import" });
      const { error } = await supabase.from("projects").insert(toInsert as any);
      toast.dismiss("import");
      if (error) {
        toast.error(`Erro na importação: ${error.message}`);
        return;
      }
      toast.success(`${toInsert.length} demanda(s) importada(s)${errors.length ? ` (${errors.length} ignorada(s))` : ""}`);
      if (errors.length) console.warn("Import warnings:", errors);
      fetchData();
    } catch (err: any) {
      toast.error(`Falha ao ler arquivo: ${err.message || err}`);
    }
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center px-3 sm:px-6">
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

        <main className="flex-1 p-3 sm:p-6 overflow-auto min-w-0">
          <div className="space-y-6 min-w-0 w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Projetos</h1>
                <p className="text-muted-foreground">Cadastre e gerencie projetos</p>
              </div>
              <div className="flex gap-2 items-center flex-wrap w-full sm:w-auto">
                {viewMode === "cards" && (
                  <>
                    <Select value={filterClient || "all"} onValueChange={setFilterClient}>
                      <SelectTrigger className="h-8 w-full sm:w-[150px]">
                        <SelectValue placeholder="Cliente" />
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

                    <Select value={filterClientProject || "all"} onValueChange={setFilterClientProject}>
                      <SelectTrigger className="h-8 w-full sm:w-[150px]">
                        <SelectValue placeholder="Projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {uniqueClientProjects.map((cp) => (
                          <SelectItem key={cp.id} value={cp.id}>
                            {cp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterSprint || "all"} onValueChange={setFilterSprint}>
                      <SelectTrigger className="h-8 w-full sm:w-[120px]">
                        <SelectValue placeholder="Sprint" />
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

                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
                <input
                  id="import-projects-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => document.getElementById("import-projects-file")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToPdf}>
                      <FileDown className="h-4 w-4 mr-2" />
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                  <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
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

                      {/* Linha 1: Cliente + Projeto do cliente + Gerente + Status */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="client_id">Cliente</Label>
                          <select
                            id="client_id"
                            name="client_id"
                            value={formClientId}
                            onChange={(e) => {
                              setFormClientId(e.target.value);
                              setFormClientProjectId("");
                            }}
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

                        {/* << NOVO: Projeto do cliente (categoria de demandas) */}
                        <div className="space-y-2">
                          <Label htmlFor="client_project_id">
                            Projeto <span className="text-muted-foreground text-xs">(opcional)</span>
                          </Label>
                          <div className="flex gap-2">
                            <select
                              id="client_project_id"
                              value={formClientProjectId}
                              onChange={(e) => setFormClientProjectId(e.target.value)}
                              disabled={!formClientId}
                              className="flex-1 px-3 py-2 border border-input rounded-md bg-background disabled:opacity-50"
                            >
                              <option value="">Sem projeto</option>
                              {clientProjects
                                .filter((cp) => cp.client_id === formClientId)
                                .map((cp) => (
                                  <option key={cp.id} value={cp.id}>
                                    {cp.name}
                                  </option>
                                ))}
                            </select>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={handleCreateClientProject}
                              disabled={!formClientId}
                              title="Criar novo projeto para este cliente"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">


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
                            <option value="waiting_client">Aguardando Cliente</option>
                            <option value="completed">Concluído</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                        </div>
                      </div>

                      {/* Linha 2: Prioridade + Datas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

                      {/* Observação (visível ao cliente) */}
                      <div className="space-y-2">
                        <Label htmlFor="observation">Observação (visível ao cliente)</Label>
                        <p className="text-xs text-muted-foreground">Este campo aparece no portal do cliente. Não use para notas internas.</p>
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
              <div className="space-y-4">
                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedProjects.map((project) => (
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
                            <span>Entrega: {formatDateBR(project.end_date)}</span>
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
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {paginatedProjects.length} de {sortedProjects.length} demanda(s)
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {getPaginationPages().map((page, idx) => (
                          <PaginationItem key={`${page}-${idx}`}>
                            {page === "..." ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                isActive={page === currentPage}
                                onClick={() => setCurrentPage(page as number)}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            ) : (
              <Card className="min-w-0 w-full max-w-full overflow-hidden">
                <CardContent className="p-3 sm:p-6 min-w-0 w-full max-w-full">
                  {/* Filters */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Filtros</h3>
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
                          <X className="h-4 w-4 mr-1" />
                          Limpar
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Sprint</Label>
                        <Select value={filterSprint || "all"} onValueChange={setFilterSprint}>
                          <SelectTrigger className="h-8 text-xs">
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

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Área</Label>
                        <Select value={filterArea || "all"} onValueChange={setFilterArea}>
                          <SelectTrigger className="h-8 text-xs">
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

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Cliente</Label>
                        <Select value={filterClient || "all"} onValueChange={setFilterClient}>
                          <SelectTrigger className="h-8 text-xs">
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

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Projeto</Label>
                        <Select value={filterClientProject || "all"} onValueChange={setFilterClientProject}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {uniqueClientProjects.map((cp) => (
                              <SelectItem key={cp.id} value={cp.id}>
                                {cp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Select value={filterStatus || "all"} onValueChange={setFilterStatus}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="overdue" className="text-destructive font-semibold">Em Atraso</SelectItem>
                            <SelectItem value="planning">Planejamento</SelectItem>
                            <SelectItem value="in_progress">Em Andamento</SelectItem>
                            <SelectItem value="on_hold">Pausado</SelectItem>
                            <SelectItem value="test">Teste</SelectItem>
                            <SelectItem value="waiting_client">Aguardando Cliente</SelectItem>
                            <SelectItem value="completed">Concluído</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Responsável</Label>
                        <Select value={filterResponsible || "all"} onValueChange={setFilterResponsible}>
                          <SelectTrigger className="h-8 text-xs">
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

                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Table className="min-w-[900px]">
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
                        <TableHead>Projeto</TableHead>
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
                      {paginatedProjects.map((project) => (
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
                            <span className="text-sm">
                              {clientProjects.find((cp) => cp.id === project.client_project_id)?.name || "-"}
                            </span>
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
                                <option value="waiting_client">Aguardando Cliente</option>
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
                                {formatDateBR(project.end_date)}
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
                  </div>
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t mt-4">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {paginatedProjects.length} de {sortedProjects.length} demanda(s)
                      </p>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {getPaginationPages().map((page, idx) => (
                            <PaginationItem key={`${page}-${idx}`}>
                              {page === "..." ? (
                                <PaginationEllipsis />
                              ) : (
                                <PaginationLink
                                  isActive={page === currentPage}
                                  onClick={() => setCurrentPage(page as number)}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              )}
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
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
