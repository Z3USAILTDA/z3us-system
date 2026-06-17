import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LayoutDashboard, Users, Building2, FolderKanban, LogOut, Menu, UserCog, FileText, BarChart3, MonitorPlay } from "lucide-react";
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
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { fetchUserFromAccessToken, getStoredAuthSession, revokeStoredSession } from "@/lib/authSession";

const DashboardContent = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { state } = useSidebar();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const storedSession = getStoredAuthSession();
    const session = storedSession ? { user: storedSession.user as any, access_token: storedSession.access_token } : null;

    if (!session?.access_token) {
      navigate("/auth");
      return;
    }

    const userFromSession = session.user;
    let userId = userFromSession?.id;

    if (!userId) {
      const authUser = await fetchUserFromAccessToken(session.access_token);
      if (!authUser?.id) {
        navigate("/auth");
        return;
      }
      userId = authUser.id;
      setUser(authUser);
    } else {
      setUser(userFromSession);
    }

    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", userId).single();

    setProfile(profileData);
    setLoading(false);
  };

  const handleSignOut = async () => {
    revokeStoredSession();
    window.location.replace("/auth");
  };

  const adminMenuItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Usuários", url: "/dashboard/users", icon: UserCog },
    { title: "Equipes", url: "/dashboard/teams", icon: Users },
    { title: "Clientes", url: "/dashboard/clients", icon: Building2 },
    { title: "Projetos", url: "/dashboard/projects", icon: FolderKanban },
    { title: "Documentação", url: "/dashboard/documentation", icon: FileText },
    { title: "Resumo da Semana", url: "/dashboard/weekly-summary", icon: BarChart3 },
    { title: "Métricas TV", url: "/metricas-projetos-tv", icon: MonitorPlay, external: true },
  ];


  const clientMenuItems = [
    { title: "Meus Projetos", url: "/dashboard", icon: FolderKanban },
  ];

  const menuItems = profile?.role === "admin" ? adminMenuItems : clientMenuItems;

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
    <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
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
                      {(item as any).external ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:bg-sidebar-accent/50"
                        >
                          <item.icon className="h-4 w-4" />
                          {state !== "collapsed" && <span>{item.title}</span>}
                        </a>
                      ) : (
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
                      )}
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
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile?.full_name || user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 overflow-auto">
          {profile?.role === "admin" ? <AdminDashboard /> : <ClientDashboard userId={user?.id} />}
        </main>
      </div>
    </div>
  );
};

const Dashboard = () => {
  return (
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  );
};

export default Dashboard;
