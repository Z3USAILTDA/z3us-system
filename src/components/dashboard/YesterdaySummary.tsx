import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, AlertTriangle, TrendingUp, Users, Building2, Clock } from "lucide-react";
import YesterdayDrilldownModal from "./YesterdayDrilldownModal";

interface Project {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
  priority: string;
  responsible: string | null;
  client_name?: string;
  created_at: string;
  actual_end_date?: string | null;
}

interface YesterdayStats {
  created: number;
  completed: number;
  delayed: number;
  topResponsibles: Array<{ name: string; count: number }>;
  topClients: Array<{ name: string; count: number }>;
  highlights: Array<{ type: "blocked" | "delayed" | "completed"; text: string; priority?: string }>;
  createdProjects?: Project[];
  completedProjects?: Project[];
  delayedProjects?: Project[];
}

interface YesterdaySummaryProps {
  stats: YesterdayStats;
  printMode?: boolean;
}

const getHighlightIcon = (type: "blocked" | "delayed" | "completed") => {
  switch (type) {
    case "blocked":
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case "delayed":
      return <Clock className="h-4 w-4 text-warning" />;
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
  }
};

const getHighlightBadge = (type: "blocked" | "delayed" | "completed") => {
  switch (type) {
    case "blocked":
      return <Badge className="bg-warning text-warning-foreground">Bloqueado</Badge>;
    case "delayed":
      return <Badge className="bg-warning/80 text-warning-foreground">Atrasado</Badge>;
    case "completed":
      return <Badge className="bg-success text-success-foreground">Concluído</Badge>;
  }
};

const YesterdaySummary = ({ stats, printMode }: YesterdaySummaryProps) => {
  const [modalType, setModalType] = useState<"created" | "completed" | "delayed" | null>(null);
  
  const hasData = stats.created > 0 || stats.completed > 0 || stats.delayed > 0;

  const handleOpenModal = (type: "created" | "completed" | "delayed") => {
    setModalType(type);
  };

  const getModalProjects = (): Project[] => {
    switch (modalType) {
      case "created":
        return stats.createdProjects || [];
      case "completed":
        return stats.completedProjects || [];
      case "delayed":
        return stats.delayedProjects || [];
      default:
        return [];
    }
  };

  if (!hasData) {
    return (
      <Card className="relative bg-card/50 backdrop-blur-sm border-secondary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-secondary" />
            Resumo de Ontem
          </CardTitle>
          <CardDescription>Informações mais relevantes do dia anterior</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Sem registros para o dia anterior</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="relative bg-card/50 backdrop-blur-sm border-secondary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-secondary" />
            Resumo de Ontem
          </CardTitle>
          <CardDescription>Informações mais relevantes do dia anterior</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-6 ${printMode ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {/* Métricas principais */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Métricas</h4>
              <div className="grid gap-3">
                <button 
                  onClick={() => handleOpenModal("created")}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-info" />
                    <span className="text-sm">Criadas</span>
                  </div>
                  <span className="font-bold text-info">{stats.created}</span>
                </button>
                <button 
                  onClick={() => handleOpenModal("completed")}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm">Concluídas</span>
                  </div>
                  <span className="font-bold text-success">{stats.completed}</span>
                </button>
                <button 
                  onClick={() => handleOpenModal("delayed")}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-sm">Em Atraso</span>
                  </div>
                  <span className="font-bold text-warning">{stats.delayed}</span>
                </button>
              </div>
            </div>

            {/* Top 3 */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Top Responsáveis</h4>
              <div className="space-y-2">
                {stats.topResponsibles.length > 0 ? (
                  stats.topResponsibles.slice(0, 3).map((person, index) => (
                    <div key={person.name} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-primary text-primary-foreground' : 
                          index === 1 ? 'bg-secondary text-secondary-foreground' : 
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[120px]">{person.name}</span>
                      </div>
                      <Badge variant="outline">{person.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Sem dados</p>
                )}
              </div>

              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mt-4">Top Clientes</h4>
              <div className="space-y-2">
                {stats.topClients.length > 0 ? (
                  stats.topClients.slice(0, 3).map((client, index) => (
                    <div key={client.name} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-accent text-accent-foreground' : 
                          index === 1 ? 'bg-secondary text-secondary-foreground' : 
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[120px]">{client.name}</span>
                      </div>
                      <Badge variant="outline">{client.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Sem dados</p>
                )}
              </div>
            </div>

            {/* Destaques */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Destaques</h4>
              <div className="space-y-2">
                {stats.highlights.length > 0 ? (
                  stats.highlights.slice(0, 5).map((highlight, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-muted/20 rounded-lg">
                      {getHighlightIcon(highlight.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{highlight.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getHighlightBadge(highlight.type)}
                          {highlight.priority === "high" && (
                            <Badge className="text-xs bg-warning/80 text-warning-foreground">Alta Prioridade</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem destaques</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <YesterdayDrilldownModal
        open={modalType !== null}
        onClose={() => setModalType(null)}
        type={modalType || "created"}
        projects={getModalProjects()}
      />
    </>
  );
};

export default YesterdaySummary;
