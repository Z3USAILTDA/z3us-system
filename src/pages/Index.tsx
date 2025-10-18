import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Shield, Cpu, ArrowRight } from "lucide-react";
import logoZ3us from "@/assets/logo-z3us.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 tech-grid opacity-30" />
      
      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "4s" }} />

      <div className="container mx-auto px-4 py-16 relative z-10">
        {/* Hero Section */}
        <div className="text-center space-y-8 mb-20 animate-fade-in">
          <div className="flex justify-center mb-8">
            <img src={logoZ3us} alt="Z3US Logo" className="h-40 w-40 object-contain" />
          </div>
          
          <div className="space-y-6">
            
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-foreground">
              Gestão de Projetos
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Plataforma tecnológica avançada para gerenciar projetos, equipes e dar visibilidade total aos seus clientes
            </p>
          </div>

          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")} 
              className="text-lg px-8 bg-gradient-primary hover:shadow-lg hover:shadow-primary/50 transition-all group"
            >
              Acessar Sistema
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate("/auth")} 
              className="text-lg px-8 border-primary/30 hover:bg-primary/10"
            >
              Portal do Cliente
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
          <div className="group relative p-8 bg-card/50 backdrop-blur-sm border border-border rounded-2xl hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/20 scan-line overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                  <Shield className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-center">Gestão Inteligente</h3>
              <p className="text-muted-foreground text-center leading-relaxed">
                IA integrada para otimizar processos e sugerir as melhores alocações de recursos
              </p>
            </div>
          </div>

          <div className="group relative p-8 bg-card/50 backdrop-blur-sm border border-border rounded-2xl hover:border-secondary/50 transition-all hover:shadow-xl hover:shadow-secondary/20 scan-line overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-secondary/10 rounded-xl group-hover:bg-secondary/20 transition-colors">
                  <Cpu className="h-10 w-10 text-secondary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-center">Tempo Real</h3>
              <p className="text-muted-foreground text-center leading-relaxed">
                Acompanhamento em tempo real de todos os projetos, equipes e demandas
              </p>
            </div>
          </div>

          <div className="group relative p-8 bg-card/50 backdrop-blur-sm border border-border rounded-2xl hover:border-accent/50 transition-all hover:shadow-xl hover:shadow-accent/20 scan-line overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-accent/10 rounded-xl group-hover:bg-accent/20 transition-colors">
                  <Sparkles className="h-10 w-10 text-accent" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-center">Portal do Cliente</h3>
              <p className="text-muted-foreground text-center leading-relaxed">
                Seus clientes acessam via CNPJ e acompanham suas demandas de forma transparente
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-gradient-primary rounded-3xl blur-2xl opacity-20" />
          <div className="relative p-12 bg-card/80 backdrop-blur-sm border border-primary/30 rounded-3xl neon-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-secondary opacity-50" />
            <div className="relative text-center space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Tecnologia Avançada
                </span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Transforme a gestão dos seus projetos com inteligência artificial, 
                visibilidade total e controle em tempo real
              </p>
              <div className="flex gap-4 justify-center pt-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-lg hover:shadow-primary/50 transition-all"
                >
                  Começar Agora
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/auth")}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  Saiba Mais
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
