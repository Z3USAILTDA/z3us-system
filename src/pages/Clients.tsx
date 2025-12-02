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
import { Plus, Edit2, Trash2, Home, Users, FolderKanban, Building2, LogOut, UserCircle, UserPlus, X } from "lucide-react";
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

interface ClientUser {
  id: string;
  user_id: string;
  email?: string;
  full_name?: string;
}

const ClientsContent = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // Estado para gerenciar usuários do cliente
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

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

  const fetchClientUsers = async (clientId: string) => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("client_users")
      .select(`
        id,
        user_id,
        profiles:user_id (
          email,
          full_name
        )
      `)
      .eq("client_id", clientId);

    if (error) {
      toast.error("Erro ao carregar usuários vinculados");
      setClientUsers([]);
    } else {
      const users = (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        email: item.profiles?.email,
        full_name: item.profiles?.full_name,
      }));
      setClientUsers(users);
    }
    setLoadingUsers(false);
  };

  const handleOpenUsersDialog = (client: any) => {
    setSelectedClient(client);
    setUsersDialogOpen(true);
    fetchClientUsers(client.id);
  };

  const handleAddUserToClient = async () => {
    if (!newUserEmail.trim() || !selectedClient) return;

    // Buscar usuário pelo email
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", newUserEmail.trim())
      .single();

    if (userError || !userData) {
      toast.error("Usuário não encontrado com este e-mail");
      return;
    }

    // Verificar se já está vinculado
    const existingUser = clientUsers.find(u => u.user_id === userData.id);
    if (existingUser) {
      toast.error("Este usuário já está vinculado a este cliente");
      return;
    }

    // Adicionar vínculo
    const { error } = await supabase
      .from("client_users")
      .insert({
        client_id: selectedClient.id,
        user_id: userData.id,
      });

    if (error) {
      toast.error("Erro ao vincular usuário");
    } else {
      toast.success("Usuário vinculado com sucesso!");
      setNewUserEmail("");
      fetchClientUsers(selectedClient.id);
    }
  };

  const handleRemoveUserFromClient = async (clientUserId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário do cliente?")) return;

    const { error } = await supabase
      .from("client_users")
      .delete()
      .eq("id", clientUserId);

    if (error) {
      toast.error("Erro ao remover usuário");
    } else {
      toast.success("Usuário removido com sucesso!");
      fetchClientUsers(selectedClient.id);
    }
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
      } else {
        toast.success("Cliente atualizado com sucesso!");
        fetchClients();
        setDialogOpen(false);
        setEditingClient(null);
        form.reset();
      }
    } else {
      const { error } = await supabase.from("clients").insert([clientData]);

      if (error) {
        toast.error("Erro ao adicionar cliente");
      } else {
        toast.success("Cliente adicionado com sucesso!");
        fetchClients();
        setDialogOpen(false);
        form.reset();
      }
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

  const handleEdit = (client: any) => {
    setEditingClient(client);
    form.reset(client);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingClient(null);
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
  ];

  const clientMenuItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Meus Projetos", url: "/dashboard/projects", icon: FolderKanban },
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
                  <Label htmlFor="email">Email</Label>
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
              <TableHead>Email</TableHead>
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
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.company_name}</TableCell>
                  <TableCell>{client.cnpj}</TableCell>
                  <TableCell>{client.contact_name}</TableCell>
                  <TableCell>{client.email}</TableCell>
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
                        onClick={() => handleOpenUsersDialog(client)}
                        title="Gerenciar Usuários"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(client)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(client.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog para gerenciar usuários do cliente */}
      <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Usuários Vinculados</DialogTitle>
            <DialogDescription>
              Gerencie os usuários com acesso ao portal de {selectedClient?.company_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Adicionar novo usuário */}
            <div className="flex gap-2">
              <Input
                placeholder="Digite o e-mail do usuário"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddUserToClient()}
              />
              <Button onClick={handleAddUserToClient}>
                <UserPlus className="h-4 w-4 mr-2" />
                Vincular
              </Button>
            </div>

            {/* Lista de usuários vinculados */}
            <div className="border rounded-lg divide-y">
              {loadingUsers ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando...
                </div>
              ) : clientUsers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum usuário vinculado a este cliente
                </div>
              ) : (
                clientUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">{user.full_name || "Sem nome"}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveUserFromClient(user.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  );
};

const Clients = () => (
  <SidebarProvider>
    <ClientsContent />
  </SidebarProvider>
);

export default Clients;
