import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, Users, FolderKanban, Sparkles } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8 mb-16">
          <div className="flex justify-center">
            <div className="p-4 bg-gradient-primary rounded-2xl shadow-xl">
              <Building2 className="h-16 w-16 text-primary-foreground" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Sistema de Gestão de Projetos
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Gerencie seus projetos, equipes e clientes com inteligência artificial
            </p>
          </div>

          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
              Entrar no Sistema
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="text-lg px-8">
              Criar Conta
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="p-6 bg-card rounded-xl shadow-md hover:shadow-lg transition-shadow">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-center">Gestão de Equipes</h3>
            <p className="text-muted-foreground text-center">
              Cadastre e gerencie sua equipe de forma eficiente
            </p>
          </div>

          <div className="p-6 bg-card rounded-xl shadow-md hover:shadow-lg transition-shadow">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <FolderKanban className="h-8 w-8 text-accent" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-center">Controle de Projetos</h3>
            <p className="text-muted-foreground text-center">
              Acompanhe o progresso de todos os seus projetos
            </p>
          </div>

          <div className="p-6 bg-card rounded-xl shadow-md hover:shadow-lg transition-shadow">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-info/10 rounded-lg">
                <Sparkles className="h-8 w-8 text-info" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-center">Inteligência Artificial</h3>
            <p className="text-muted-foreground text-center">
              IA para otimizar a gestão e sugerir alocações
            </p>
          </div>
        </div>

        <div className="mt-16 p-8 bg-gradient-primary rounded-2xl shadow-xl max-w-4xl mx-auto">
          <div className="text-center text-primary-foreground space-y-4">
            <h2 className="text-3xl font-bold">Portal do Cliente</h2>
            <p className="text-lg opacity-90">
              Clientes podem acessar com seu CNPJ e acompanhar suas demandas em tempo real
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => navigate("/auth")}
              className="mt-4"
            >
              Acessar Portal do Cliente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
