import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  UserPlus,
  Shield,
  User,
  Mail,
  Calendar,
  Home,
  Users as UsersIcon,
  FolderKanban,
  Building2,
  LogOut,
  UserCircle,
  KeyRound,
  UserCog,
  FileText,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/** Schema no mesmo padrão do Auth.tsx */
const createUserSchema = z.object({
  fullName: z.string().min(2, "Informe o nome completo"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["client", "admin"], { required_error: "Selecione a função" }),
});
type CreateUserFormData = z.infer<typeof createUserSchema>;

const UsersContent = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // estado do dialog e do submit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // estado do dialog de troca de senha
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  
  // estado do dialog de troca de perfil
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUserRole, setSelectedUserRole] = useState<string>("");
  const [newRole, setNewRole] = useState<string>("");
  const [changingRole, setChangingRole] = useState(false);

  // form (igual ao Auth: hook-form + zod)
  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "client" },
  });

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();

    setProfile(profileData);

    // Check if user is admin
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).single();

    if (roleData?.role !== "admin") {
      toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    await fetchUsers();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        email,
        full_name,
        role,
        created_at
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar usuários");
      console.error(error);
    } else {
      setUsers(data || []);
    }

    setLoading(false);
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return (
        <Badge className="bg-primary">
          <Shield className="h-3 w-3 mr-1" />
          Administrador
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <User className="h-3 w-3 mr-1" />
        Cliente
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const adminMenuItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Equipes", url: "/dashboard/teams", icon: UsersIcon },
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

  const handleChangeRole = async () => {
    if (!selectedUserId || !newRole) {
      toast.error("Selecione um perfil");
      return;
    }

    if (selectedUserId === profile?.id) {
      toast.error("Você não pode alterar seu próprio perfil");
      return;
    }

    try {
      setChangingRole(true);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await supabase.functions.invoke('update-user-role', {
        body: {
          userId: selectedUserId,
          newRole: newRole,
        },
      });

      if (response.error) {
        toast.error(response.error.message || "Falha ao alterar perfil");
        return;
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      toast.success(`Perfil alterado com sucesso para ${selectedUserEmail}`);
      setRoleDialogOpen(false);
      setNewRole("");
      setSelectedUserId(null);
      setSelectedUserEmail("");
      setSelectedUserRole("");
      await fetchUsers();
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao alterar perfil");
    } finally {
      setChangingRole(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUserId || !newPassword) {
      toast.error("Preencha a nova senha");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }

    try {
      setChangingPassword(true);

      // Usar o service role key para atualizar a senha do usuário
      const { error } = await supabase.auth.admin.updateUserById(
        selectedUserId,
        { password: newPassword }
      );

      if (error) {
        toast.error("Erro ao alterar senha: " + error.message);
        return;
      }

      toast.success(`Senha alterada com sucesso para ${selectedUserEmail}`);
      setPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedUserId(null);
      setSelectedUserEmail("");
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  // === NOVO: criação usando edge function ===
  const onCreateUser = async (data: CreateUserFormData) => {
    try {
      setSubmitting(true);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role,
        },
      });

      if (response.error) {
        toast.error(response.error.message || "Falha ao criar usuário");
        return;
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      toast.success("Usuário criado com sucesso!");
      form.reset({ role: "client" });
      setDialogOpen(false);
      await fetchUsers();
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao criar usuário");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  if (!isAdmin) {
    return null;
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
            <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
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
            <h2 className="text-lg font-semibold">Gerenciar Usuários</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground">Visualize e gerencie usuários do sistema</p>
            </div>

            {/* Botão + Dialog com o MESMO padrão visual do Auth (space-y-4 e inputs com Label) */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Usuário</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onCreateUser)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome completo</Label>
                    <Input id="full_name" placeholder="Nome e sobrenome" {...form.register("fullName")} />
                    {form.formState.errors.fullName && (
                      <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="seu@email.com" {...form.register("email")} />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
                    {form.formState.errors.password && (
                      <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Função</Label>
                    <select
                      id="role"
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      {...form.register("role")}
                      defaultValue="client"
                    >
                      <option value="client">Cliente</option>
                      <option value="admin">Admin</option>
                    </select>
                    {form.formState.errors.role && (
                      <p className="text-sm text-destructive">{form.formState.errors.role.message as string}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Criando..." : "Criar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Usuários Cadastrados ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-12">
                  <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhum usuário cadastrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Data de Cadastro</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium">{user.full_name || "Sem nome"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getRoleBadge(user.role)}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={() => {
                                setSelectedUserId(user.id);
                                setSelectedUserEmail(user.email);
                                setSelectedUserRole(user.role);
                                setNewRole(user.role);
                                setRoleDialogOpen(true);
                              }}
                            >
                              <UserCog className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {formatDate(user.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setSelectedUserEmail(user.email);
                              setPasswordDialogOpen(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4 mr-2" />
                            Senha
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Dialog para trocar perfil */}
          <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Perfil</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input value={selectedUserEmail} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_role">Novo Perfil</Label>
                  <select
                    id="new_role"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="client">Cliente</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Administradores têm acesso total ao sistema
                  </p>
                </div>
                <Button
                  onClick={handleChangeRole}
                  className="w-full"
                  disabled={changingRole}
                >
                  {changingRole ? "Alterando..." : "Confirmar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog para trocar senha */}
          <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Senha</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input value={selectedUserEmail} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_password">Nova Senha</Label>
                  <Input
                    id="new_password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres
                  </p>
                </div>
                <Button
                  onClick={handleChangePassword}
                  className="w-full"
                  disabled={changingPassword}
                >
                  {changingPassword ? "Alterando..." : "Confirmar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Acesso Restrito</p>
                  <p className="text-sm text-muted-foreground">
                    Apenas administradores podem visualizar e gerenciar usuários do sistema. Novos usuários podem se
                    cadastrar através da página de autenticação.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

const Users = () => (
  <SidebarProvider>
    <UsersContent />
  </SidebarProvider>
);

export default Users;
