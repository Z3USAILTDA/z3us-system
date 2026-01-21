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

  const displayItems = printMode ? pendingDeliveries.slice(0, 8) : (expanded ? pendingDeliveries : pendingDeliveries.slice(0, 5));

  return (
    <Card className="relative bg-card/50 backdrop-blur-sm border-warning/20 hover:border-warning/40 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Package className="h-5 w-5 text-warning" />
            </div>
            <div>
              <CardTitle className="text-lg">Entregas do Dia</CardTitle>
              <CardDescription>Pendências com prazo para hoje</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-lg px-3 py-1 border-warning/30 text-warning">
              {pendingDeliveries.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pendingDeliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-success/50 mb-3" />
            <p className="text-muted-foreground">Nenhuma entrega pendente para hoje!</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Todas as demandas do dia estão em dia.</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Demanda</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Prioridade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayItems.map((project) => (
                  <TableRow key={project.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {project.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.responsible || "Não atribuído"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.client_name || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(project.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getPriorityBadge(project.priority)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
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
