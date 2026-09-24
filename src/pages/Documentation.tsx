import { useEffect, useState, useRef } from "react";
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
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  LayoutDashboard,
  Users,
  FolderKanban,
  LogOut,
  Menu,
  UserCog,
  FileText,
  Download,
  Eye,
  Search,
  X,
  Filter,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight, Sparkles
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatDateBR } from "@/lib/utils";

interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  type: string;
  version: string | null;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  tags: string[] | null;
  products: string[] | null;
  created_at: string;
  updated_at: string;
  projects?: {
    title: string;
  };
}

// Lista fixa de produtos Z3US
const PRODUCT_OPTIONS = [
  "Zeus",
  "Olimpo",
  "Hermes",
  "Artemis",
  "Cronos",
  "Apolo",
  "Prometeu",
];

const DocumentationContent = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(null);
  const [editingDocument, setEditingDocument] = useState<ProjectDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state } = useSidebar();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterType, setFilterType] = useState("");
  const [sortOrder, setSortOrder] = useState<"recent" | "az" | "project">("recent");

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
    fetchData(profileData?.role === "admin");
  };

  const fetchData = async (isAdmin: boolean) => {
    const [documentsRes, projectsRes, clientsRes] = await Promise.all([
      supabase
        .from("project_documents")
        .select(`
          *,
          projects (
            title,
            client_id
          )
        `)
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, title, client_id").order("title"),
      isAdmin
        ? supabase.from("clients").select("id, company_name").order("company_name")
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (documentsRes.error) {
      console.error("Erro ao carregar documentos:", documentsRes.error);
      toast.error("Erro ao carregar documentos");
    } else {
      setDocuments(documentsRes.data || []);
    }

    if (!projectsRes.error) {
      setProjects(projectsRes.data || []);
    }
    if (!clientsRes.error) {
      setClients(clientsRes.data || []);
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

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      resumo: "Resumo",
      tecnica: "Técnica",
      manual: "Manual",
      outros: "Outros",
    };
    return labels[type] || type;
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      resumo: "bg-info text-info-foreground",
      tecnica: "bg-primary text-primary-foreground",
      manual: "bg-warning text-warning-foreground",
      outros: "bg-muted text-muted-foreground",
    };
    return colors[type] || "bg-muted text-muted-foreground";
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const file = fileInputRef.current?.files?.[0];

    if (!editingDocument && !file) {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    const productsArray = [...selectedProducts];

    // Cliente e demanda são escolhidos explicitamente — nunca derivados do produto
    if (!selectedClientId || !selectedProjectId) {
      toast.error("Selecione o cliente e a demanda do documento");
      return;
    }
    const chosen = projects.find((p) => p.id === selectedProjectId);
    if (!chosen || chosen.client_id !== selectedClientId) {
      toast.error("A demanda selecionada não pertence ao cliente escolhido");
      return;
    }
    const firstProduct = selectedProjectId;

    setUploading(true);

    try {
      let fileUrl = editingDocument?.file_url || "";
      let fileName = editingDocument?.file_name || "";
      let fileSize = editingDocument?.file_size || 0;

      // Upload new file if provided
      if (file) {
        const fileExt = (file.name.split(".").pop() || "").toLowerCase();
        if (!ALLOWED_EXT.includes(`.${fileExt}`)) {
          toast.error("Formato não permitido. Use PDF, XLSX, XLSM, XLS, DOCX ou MD.");
          setUploading(false);
          return;
        }
        const filePath = `${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || MIME_BY_EXT[fileExt] || "application/octet-stream",
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Erro ao fazer upload: ${uploadError.message}`);
          setUploading(false);
          return;
        }

        // Delete old file if editing
        if (editingDocument?.file_url) {
          const oldPath = editingDocument.file_url.split("/").pop();
          if (oldPath) {
            await supabase.storage.from("documents").remove([oldPath]);
          }
        }

        fileUrl = filePath;
        fileName = file.name;
        fileSize = file.size;
      }

      const tagsString = formData.get("tags") as string;
      const tags = tagsString
        ? tagsString.split(",").map((t) => t.trim()).filter(Boolean)
        : null;

      const baseData = {
        title: formData.get("title") as string,
        type: formData.get("type") as string,
        version: (formData.get("version") as string) || null,
        description: (formData.get("description") as string) || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        tags,
        visibility: formData.get("internal") ? "internal" : "client",
      };

      if (editingDocument) {
        const { error } = await supabase
          .from("project_documents")
          .update({ ...baseData, project_id: firstProduct!, products: productsArray } as any)
          .eq("id", editingDocument.id);

        if (error) {
          console.error("Erro ao atualizar documento:", error);
          toast.error(`Erro ao atualizar documento: ${error.message}`);
        } else {
          toast.success("Documento atualizado com sucesso!");
          fetchData();
          setDialogOpen(false);
          setEditingDocument(null);
        }
      } else {
        // Create a single document with all selected products
        const { error } = await supabase.from("project_documents").insert({
          ...baseData,
          project_id: firstProduct!,
          products: productsArray,
        } as any);

        if (error) {
          console.error("Erro ao inserir documento:", error);
          toast.error(`Erro ao adicionar documento: ${error.message}`);
        } else {
          toast.success(`Documento adicionado com ${productsArray.length} produto(s)!`);
          fetchData();
          setDialogOpen(false);
          setSelectedProducts([]);
        }
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao processar documento");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: ProjectDocument) => {
    if (!confirm("Tem certeza que deseja remover este documento?")) return;

    // Delete file from storage
    if (doc.file_url) {
      await supabase.storage.from("documents").remove([doc.file_url]);
    }

    const { error } = await supabase.from("project_documents").delete().eq("id", doc.id);

    if (error) {
      toast.error("Erro ao remover documento");
    } else {
      toast.success("Documento removido com sucesso!");
      fetchData();
    }
  };

  const handleEdit = (doc: ProjectDocument) => {
    setEditingDocument(doc);
    setSelectedProducts(doc.products || []);
    const proj = projects.find((p) => p.id === doc.project_id);
    setSelectedClientId(proj?.client_id || "");
    setSelectedProjectId(doc.project_id || "");
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingDocument(null);
      setSelectedProducts([]);
      setSelectedClientId("");
      setSelectedProjectId("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleView = (doc: ProjectDocument) => {
    setSelectedDocument(doc);
    setViewerOpen(true);
  };

  const handleDownload = async (doc: ProjectDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_url);

      if (error) {
        toast.error("Erro ao baixar documento");
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Erro ao baixar documento");
    }
  };

  // Filter and sort documents
  const filteredDocuments = documents
    .filter((doc) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        doc.title.toLowerCase().includes(searchLower) ||
        doc.projects?.title.toLowerCase().includes(searchLower) ||
        doc.version?.toLowerCase().includes(searchLower) ||
        doc.tags?.some((t) => t.toLowerCase().includes(searchLower));

      const matchesProject = !filterProject || filterProject === "all" || doc.projects?.title.toLowerCase().includes(filterProject.toLowerCase());
      const matchesType = !filterType || filterType === "all" || doc.type === filterType;

      return matchesSearch && matchesProject && matchesType;
    })
    .sort((a, b) => {
      switch (sortOrder) {
        case "az":
          return a.title.localeCompare(b.title);
        case "project":
          return (a.projects?.title || "").localeCompare(b.projects?.title || "");
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const hasActiveFilters =
    searchTerm ||
    (filterProject && filterProject !== "all") ||
    (filterType && filterType !== "all");

  const clearFilters = () => {
    setSearchTerm("");
    setFilterProject("all");
    setFilterType("all");
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
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Documentação
            </h1>
            <p className="text-muted-foreground mt-1">Central de documentos dos projetos</p>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por projeto, título, versão ou tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {profile?.role === "admin" && (
                <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Documentação
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingDocument ? "Editar Documentação" : "Adicionar Documentação"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingDocument
                          ? "Atualize as informações do documento."
                          : "Preencha as informações do novo documento."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="doc-client">Cliente *</Label>
                        <select
                          id="doc-client"
                          required
                          value={selectedClientId}
                          onChange={(e) => {
                            setSelectedClientId(e.target.value);
                            setSelectedProjectId("");
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Selecione o cliente</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>{c.company_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="doc-project">Demanda *</Label>
                        <select
                          id="doc-project"
                          required
                          disabled={!selectedClientId}
                          value={selectedProjectId}
                          onChange={(e) => setSelectedProjectId(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                        >
                          <option value="">{selectedClientId ? "Selecione a demanda" : "Escolha o cliente primeiro"}</option>
                          {projects
                            .filter((p) => p.client_id === selectedClientId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Produto(s)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal"
                            >
                              {selectedProducts.length === 0
                                ? "Selecione o(s) produto(s)"
                                : selectedProducts.length === 1
                                  ? selectedProducts[0]
                                  : `${selectedProducts.length} produtos selecionados`}
                              <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                            <div className="space-y-1">
                              {PRODUCT_OPTIONS.map((product) => (
                                <label
                                  key={product}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                                >
                                  <Checkbox
                                    checked={selectedProducts.includes(product)}
                                    onCheckedChange={(checked) => {
                                      setSelectedProducts((prev) =>
                                        checked
                                          ? [...prev, product]
                                          : prev.filter((p) => p !== product)
                                      );
                                    }}
                                  />
                                  {product}
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="title">Título do Documento *</Label>
                        <Input
                          id="title"
                          name="title"
                          required
                          defaultValue={editingDocument?.title || ""}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="type">Tipo *</Label>
                          <Select
                            name="type"
                            defaultValue={editingDocument?.type || "outros"}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="resumo">Resumo</SelectItem>
                              <SelectItem value="tecnica">Técnica</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="version">Versão</Label>
                          <Input
                            id="version"
                            name="version"
                            placeholder="Ex: 1.0"
                            defaultValue={editingDocument?.version || ""}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                          id="description"
                          name="description"
                          rows={2}
                          defaultValue={editingDocument?.description || ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                        <Input
                          id="tags"
                          name="tags"
                          placeholder="Ex: api, integração, parser"
                          defaultValue={editingDocument?.tags?.join(", ") || ""}
                        />
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="internal"
                          defaultChecked={(editingDocument as any)?.visibility === "internal"}
                          className="h-4 w-4 accent-primary"
                        />
                        Documento interno (não visível ao cliente)
                      </label>

                      <div className="space-y-2">
                        <Label htmlFor="file">
                          Arquivo (PDF, XLSX, XLSM, XLS, DOCX ou MD) {editingDocument ? "(deixe vazio para manter o atual)" : "*"}
                        </Label>
                        <Input
                          id="file"
                          type="file"
                          accept={ALLOWED_EXT.join(",")}
                          ref={fileInputRef}
                          required={!editingDocument}
                        />
                        {editingDocument && (
                          <p className="text-xs text-muted-foreground">
                            Arquivo atual: {editingDocument.file_name}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleDialogChange(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={uploading}
                          className="bg-gradient-primary hover:opacity-90"
                        >
                          {uploading ? "Salvando..." : editingDocument ? "Atualizar" : "Adicionar"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filtros:</span>
              </div>

              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {PRODUCT_OPTIONS.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="resumo">Resumo</SelectItem>
                  <SelectItem value="tecnica">Técnica</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recente</SelectItem>
                  <SelectItem value="az">A–Z</SelectItem>
                  <SelectItem value="project">Por projeto</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>

          {/* Documents Grid */}
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {hasActiveFilters
                  ? "Nenhum documento encontrado com os filtros selecionados"
                  : "Nenhum documento cadastrado ainda"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDocuments.map((doc) => (
                <Card
                  key={doc.id}
                  className="group hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge className={getTypeBadgeColor(doc.type)}>
                        {getTypeLabel(doc.type)}
                      </Badge>
                      {doc.version && (
                        <Badge variant="outline" className="text-xs">
                          v{doc.version}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base line-clamp-2 mt-2">{doc.title}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {(doc as any).products && (doc as any).products.length > 0
                        ? (doc as any).products.join(", ")
                        : doc.projects?.title || "Produto não encontrado"}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {doc.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {doc.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <FileText className="h-3 w-3" />
                      <span className="truncate">{doc.file_name}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                    </div>

                    <div className="text-xs text-muted-foreground mb-4">
                      Atualizado em {formatDateBR(doc.updated_at)}
                    </div>

                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {doc.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {doc.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{doc.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {isPdf(doc.file_name) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleView(doc)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Baixar
                      </Button>
                      {profile?.role === "admin" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(doc)}
                            className="shrink-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(doc)}
                            className="shrink-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* PDF Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedDocument?.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-4 text-xs">
              <span>{selectedDocument?.projects?.title}</span>
              {selectedDocument?.version && <span>• v{selectedDocument.version}</span>}
              <Badge className={getTypeBadgeColor(selectedDocument?.type || "outros")}>
                {getTypeLabel(selectedDocument?.type || "outros")}
              </Badge>
              <span>
                • Atualizado em {selectedDocument && formatDateBR(selectedDocument.updated_at)}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted rounded-lg overflow-hidden">
            {selectedDocument && (
              <PDFViewer document={selectedDocument} />
            )}
          </div>
          <div className="shrink-0 flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => selectedDocument && handleDownload(selectedDocument)}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            <Button variant="secondary" onClick={() => setViewerOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// PDF Viewer Component
const PDFViewer = ({ document }: { document: ProjectDocument }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        const { data, error } = await supabase.storage
          .from("documents")
          .createSignedUrl(document.file_url, 3600);

        if (error) {
          console.error("Error getting signed URL:", error);
          toast.error("Erro ao carregar documento");
          return;
        }

        setPdfUrl(data.signedUrl);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [document.file_url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Não foi possível carregar o documento
      </div>
    );
  }

  return (
    <iframe
      src={`${pdfUrl}#toolbar=1&navpanes=0`}
      className="w-full h-full"
      title={document.title}
    />
  );
};

const isPdf = (name?: string | null) => !!name && name.toLowerCase().endsWith(".pdf");

const Documentation = () => {
  return (
    <SidebarProvider>
      <DocumentationContent />
    </SidebarProvider>
  );
};

export default Documentation;
