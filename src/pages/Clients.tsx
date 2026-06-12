import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clientSchema, type ClientFormData } from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Home, Users, FolderKanban, Building2, LogOut, UserCircle, X, Mail, FileText } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import logoWhite from "@/assets/logo-branco.png";

const ClientsContent = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // Estado para emails adicionais
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");

  // Projetos do cliente (categorias de demandas)
  const [clientProjects, setClientProjects] = useState<{ id: string; name: string }[]>([]);
  const [newProjectName, setNewProjectName] = useState("");


  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      status: "active",
    },
  });

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(profileData);
    fetchClients();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar clientes");
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  const fetchClientEmails = async (clientId: string) => {
    const { data, error } = await supabase
      .from("client_emails")
      .select("email")
      .eq("client_id", clientId);

    if (!error && data) {
      return data.map(e => e.email);
    }
    return [];
  };

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    
    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("E-mail inválido");
      return;
    }

    if (additionalEmails.includes(email)) {
      toast.error("Este e-mail já foi adicionado");
      return;
    }

    // Verificar se é igual ao email principal
    const mainEmail = form.getValues("email")?.toLowerCase();
    if (email === mainEmail) {
      toast.error("Este é o e-mail principal do cliente");
      return;
    }

    setAdditionalEmails([...additionalEmails, email]);
    setNewEmail("");
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setAdditionalEmails(additionalEmails.filter(e => e !== emailToRemove));
  };

  const fetchClientProjects = async (clientId: string) => {
    const { data, error } = await (supabase as any)
      .from("client_projects")
      .select("id, name")
      .eq("client_id", clientId)
      .order("name");
    if (!error && data) setClientProjects(data);
  };

  const handleAddClientProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    if (!editingClient?.id) {
      toast.error("Salve o cliente primeiro para adicionar projetos");
      return;
    }
    const { data, error } = await (supabase as any)
      .from("client_projects")
      .insert({ client_id: editingClient.id, name })
      .select()
      .single();
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setClientProjects([...clientProjects, data]);
    setNewProjectName("");
    toast.success("Projeto adicionado!");
  };

  const handleRemoveClientProject = async (id: string) => {
    if (!confirm("Remover este projeto? Demandas vinculadas ficarão sem projeto.")) return;
    const { error } = await (supabase as any).from("client_projects").delete().eq("id", id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setClientProjects(clientProjects.filter((p) => p.id !== id));
    toast.success("Projeto removido!");
  };

  const handleSubmit = async (data: ClientFormData) => {

    const clientData = {
      company_name: data.company_name,
      cnpj: data.cnpj,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone || "",
      address: data.address || "",
      status: data.status,
    };

    if (editingClient) {
      const { error } = await supabase
        .from("clients")
        .update(clientData)
        .eq("id", editingClient.id);

      if (error) {
        toast.error("Erro ao atualizar cliente");
        return;
      }

      // Atualizar emails adicionais
      // Primeiro remove todos
      await supabase
        .from("client_emails")
        .delete()
        .eq("client_id", editingClient.id);

      // Depois adiciona os novos
      if (additionalEmails.length > 0) {
        const emailsToInsert = additionalEmails.map(email => ({
          client_id: editingClient.id,
          email,
        }));
        await supabase.from("client_emails").insert(emailsToInsert);
      }

      toast.success("Cliente atualizado com sucesso!");
      fetchClients();
      setDialogOpen(false);
      setEditingClient(null);
      setAdditionalEmails([]);
      form.reset();
    } else {
      const { data: newClient, error } = await supabase
        .from("clients")
        .insert([clientData])
        .select()
        .single();

      if (error) {
        toast.error("Erro ao adicionar cliente");
        return;
      }

      // Adicionar emails adicionais
      if (additionalEmails.length > 0 && newClient) {
        const emailsToInsert = additionalEmails.map(email => ({
          client_id: newClient.id,
          email,
        }));
        await supabase.from("client_emails").insert(emailsToInsert);
      }

      toast.success("Cliente adicionado com sucesso!");
      fetchClients();
      setDialogOpen(false);
      setAdditionalEmails([]);
      form.reset();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este cliente?")) return;

    const { error } = await supabase.from("clients").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao remover cliente");
    } else {
      toast.success("Cliente removido com sucesso!");
      fetchClients();
    }
  };

  const handleEdit = async (client: any) => {
    setEditingClient(client);
    form.reset(client);
    
    // Carregar emails adicionais
    const emails = await fetchClientEmails(client.id);
    setAdditionalEmails(emails);

    // Carregar projetos do cliente
    await fetchClientProjects(client.id);

    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingClient(null);
      setAdditionalEmails([]);
      setNewEmail("");
      setClientProjects([]);
      setNewProjectName("");
      form.reset({
        company_name: "",
        cnpj: "",
        contact_name: "",
        email: "",
        phone: "",
        address: "",
        status: "active",
      });
    }
  };


  const adminMenuItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Equipes", url: "/dashboard/teams", icon: Users },
    { title: "Clientes", url: "/dashboard/clients", icon: Building2 },
    { title: "Projetos", url: "/dashboard/projects", icon: FolderKanban },
    { title: "Documentação", url: "/dashboard/documentation", icon: FileText },
  ];

  const clientMenuItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Meus Projetos", url: "/dashboard/projects", icon: FolderKanban },
    { title: "Documentação", url: "/dashboard/documentation", icon: FileText },
  ];

  const menuItems = profile?.role === "admin" ? adminMenuItems : clientMenuItems;

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

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
                {menuItems.map((item) => (
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
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 overflow-auto">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 gap-4">
            <SidebarTrigger />
            <h2 className="text-lg font-semibold">Gerenciar Clientes</h2>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Gerenciar Clientes</h1>
              <p className="text-muted-foreground">Cadastre e gerencie seus clientes</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingClient ? "Editar Cliente" : "Adicionar Novo Cliente"}
                  </DialogTitle>
                  <DialogDescription>
                    Preencha os dados do cliente
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Nome da Empresa</Label>
                      <Input
                        id="company_name"
                        {...form.register("company_name")}
                      />
                      {form.formState.errors.company_name && (
                        <p className="text-sm text-destructive">{form.formState.errors.company_name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        placeholder="00.000.000/0000-00"
                        {...form.register("cnpj")}
                      />
                      {form.formState.errors.cnpj && (
                        <p className="text-sm text-destructive">{form.formState.errors.cnpj.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Nome do Contato</Label>
                      <Input
                        id="contact_name"
                        {...form.register("contact_name")}
                      />
                      {form.formState.errors.contact_name && (
                        <p className="text-sm text-destructive">{form.formState.errors.contact_name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Principal</Label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register("email")}
                      />
                      {form.formState.errors.email && (
                        <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Seção de emails adicionais */}
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Emails Adicionais de Contato
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Adicione outros emails que terão acesso ao portal do cliente
                    </p>
                    
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite o e-mail adicional"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddEmail();
                          }
                        }}
                      />
                      <Button type="button" variant="secondary" onClick={handleAddEmail}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {additionalEmails.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {additionalEmails.map((email) => (
                          <Badge key={email} variant="secondary" className="flex items-center gap-1 py-1">
                            {email}
                            <button
                              type="button"
                              onClick={() => handleRemoveEmail(email)}
                              className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Seção de projetos do cliente */}
                  {editingClient && (
                    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                      <Label className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4" />
                        Projetos do Cliente
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Categorias usadas ao criar demandas (ex: Faturamento, Ciclope)
                      </p>

                      <div className="flex gap-2">
                        <Input
                          placeholder="Nome do projeto"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddClientProject();
                            }
                          }}
                        />
                        <Button type="button" variant="secondary" onClick={handleAddClientProject}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {clientProjects.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {clientProjects.map((proj) => (
                            <Badge
                              key={proj.id}
                              variant="secondary"
                              className="flex items-center gap-1 py-1"
                            >
                              {proj.name}
                              <button
                                type="button"
                                onClick={() => handleRemoveClientProject(proj.id)}
                                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}



                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="(XX) XXXXX-XXXX"
                      {...form.register("phone")}
                    />
                    {form.formState.errors.phone && (
                      <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Textarea
                      id="address"
                      rows={3}
                      {...form.register("address")}
                    />
                    {form.formState.errors.address && (
                      <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      {...form.register("status")}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full">
                    {editingClient ? "Atualizar" : "Adicionar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Emails</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <ClientRow 
                      key={client.id} 
                      client={client} 
                      onEdit={handleEdit} 
                      onDelete={handleDelete} 
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
};

// Componente separado para a linha do cliente (para carregar emails adicionais)
const ClientRow = ({ 
  client, 
  onEdit, 
  onDelete 
}: { 
  client: any; 
  onEdit: (client: any) => void; 
  onDelete: (id: string) => void;
}) => {
  const [emailCount, setEmailCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("client_emails")
        .select("*", { count: "exact", head: true })
        .eq("client_id", client.id);
      setEmailCount(count || 0);
    };
    fetchCount();
  }, [client.id]);

  return (
    <TableRow>
      <TableCell className="font-medium">{client.company_name}</TableCell>
      <TableCell>{client.cnpj}</TableCell>
      <TableCell>{client.contact_name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-sm">{client.email}</span>
          {emailCount > 0 && (
            <Badge variant="outline" className="text-xs">
              +{emailCount}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={client.status === "active" ? "default" : "secondary"}>
          {client.status === "active" ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(client)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(client.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const Clients = () => (
  <SidebarProvider>
    <ClientsContent />
  </SidebarProvider>
);

export default Clients;
