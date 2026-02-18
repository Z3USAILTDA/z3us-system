import { useState } from "react";
import { getTodayLocalDate } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, CheckCircle2, Package, ChevronDown, ChevronUp } from "lucide-react";

interface Project {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
  priority: string;
  responsible: string | null;
  client_name?: string;
  created_at: string;
  client_id: string;
}

interface TodayDeliveriesProps {
  projects: Project[];
  printMode?: boolean;
}

const TodayDeliveries = ({ projects, printMode = false }: TodayDeliveriesProps) => {
  const [expanded, setExpanded] = useState(false);
  
  const today = getTodayLocalDate();
  
  // Filter only pending deliveries (not completed) with end_date = today
  const pendingDeliveries = projects.filter(p => 
    p.status !== "completed" && p.end_date === today
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return <Badge className="bg-info/20 text-info border-info/30">Em Andamento</Badge>;
      case "planning":
        return <Badge className="bg-muted/50 text-muted-foreground border-muted">Planejamento</Badge>;
      case "blocked":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Bloqueado</Badge>;
      case "review":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Em Revisão</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Alta</Badge>;
      case "medium":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Média</Badge>;
      case "low":
        return <Badge className="bg-success/20 text-success border-success/30">Baixa</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const displayItems = printMode ? pendingDeliveries.slice(0, 5) : (expanded ? pendingDeliveries : pendingDeliveries.slice(0, 5));

  return (
    <Card className="relative bg-card/50 backdrop-blur-sm border-warning/20 hover:border-warning/40 transition-all">
      <CardHeader className={printMode ? 'py-1 px-2 sm:py-2 sm:px-3' : 'pb-3'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-3">
            <div className={`bg-warning/10 rounded-lg ${printMode ? 'p-0.5 sm:p-1' : 'p-2'}`}>
              <Package className={`text-warning ${printMode ? 'h-3 w-3 sm:h-4 sm:w-4' : 'h-5 w-5'}`} />
            </div>
            <div>
              <CardTitle className={printMode ? 'text-xs sm:text-sm' : 'text-lg'}>Entregas do Dia</CardTitle>
              {!printMode && <CardDescription>Pendências com prazo para hoje</CardDescription>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`border-warning/30 text-warning ${printMode ? 'text-xs sm:text-sm px-1 sm:px-2' : 'text-lg px-3 py-1'}`}>
              {pendingDeliveries.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className={printMode ? 'py-0.5 px-2 sm:py-1 sm:px-3' : ''}>
        {pendingDeliveries.length === 0 ? (
          <div className={`flex flex-col items-center justify-center text-center ${printMode ? 'py-1 sm:py-2' : 'py-8'}`}>
            <CheckCircle2 className={`text-success/50 ${printMode ? 'h-4 w-4 sm:h-6 sm:w-6 mb-0.5 sm:mb-1' : 'h-12 w-12 mb-3'}`} />
            <p className={`text-muted-foreground ${printMode ? 'text-[10px] sm:text-xs' : ''}`}>Nenhuma entrega pendente para hoje!</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className={printMode ? 'text-[10px] sm:text-xs py-0.5 sm:py-1' : ''}>Demanda</TableHead>
                    <TableHead className={printMode ? 'text-[10px] sm:text-xs py-0.5 sm:py-1' : ''}>Responsável</TableHead>
                    {!printMode && <TableHead>Cliente</TableHead>}
                    <TableHead className={`text-center ${printMode ? 'text-[10px] sm:text-xs py-0.5 sm:py-1' : ''}`}>Status</TableHead>
                    <TableHead className={`text-center ${printMode ? 'text-[10px] sm:text-xs py-0.5 sm:py-1' : ''}`}>Prior.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map((project) => (
                    <TableRow key={project.id} className="hover:bg-muted/30">
                      <TableCell className={`font-medium ${printMode ? 'py-0.5 sm:py-1 text-[10px] sm:text-xs max-w-[80px] sm:max-w-[120px]' : 'max-w-[200px]'} truncate`}>
                        {project.title}
                      </TableCell>
                      <TableCell className={`text-muted-foreground ${printMode ? 'py-0.5 sm:py-1 text-[10px] sm:text-xs truncate max-w-[50px] sm:max-w-[80px]' : ''}`}>
                        {project.responsible || "N/A"}
                      </TableCell>
                      {!printMode && (
                        <TableCell className="text-muted-foreground">
                          {project.client_name || "—"}
                        </TableCell>
                      )}
                      <TableCell className={`text-center ${printMode ? 'py-0.5 sm:py-1' : ''}`}>
                        {printMode ? (
                          <Badge className="text-[9px] sm:text-xs px-0.5 sm:px-1 py-0" variant={project.status === "in_progress" ? "default" : "outline"}>
                            {project.status === "in_progress" ? "And." : project.status === "planning" ? "Plan." : project.status}
                          </Badge>
                        ) : (
                          getStatusBadge(project.status)
                        )}
                      </TableCell>
                      <TableCell className={`text-center ${printMode ? 'py-0.5 sm:py-1' : ''}`}>
                        {printMode ? (
                          <Badge className={`text-[9px] sm:text-xs px-0.5 sm:px-1 py-0 ${
                            project.priority === 'high' ? 'bg-destructive/20 text-destructive' :
                            project.priority === 'medium' ? 'bg-warning/20 text-warning' :
                            'bg-success/20 text-success'
                          }`}>
                            {project.priority === 'high' ? 'A' : project.priority === 'medium' ? 'M' : 'B'}
                          </Badge>
                        ) : (
                          getPriorityBadge(project.priority)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {pendingDeliveries.length > 5 && !printMode && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Ver todas ({pendingDeliveries.length - 5} restantes)
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TodayDeliveries;
