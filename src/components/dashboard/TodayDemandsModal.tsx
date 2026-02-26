import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface Project {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
  priority: string;
  responsible: string | null;
  client_name?: string;
}

interface TodayDemandsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  projects: Project[];
}

// Helper to translate status labels
const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    planning: "Planejamento",
    in_progress: "Em Andamento",
    completed: "Concluído",
    on_hold: "Pausado",
    waiting_client: "Aguardando cliente",
    test: "Teste",
  };
  return statusMap[status] || status;
};

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    planning: { label: "Planejamento", variant: "outline" },
    in_progress: { label: "Em Andamento", variant: "default" },
    completed: { label: "Concluído", variant: "secondary" },
    on_hold: { label: "Pausado", variant: "destructive" },
    waiting_client: { label: "Aguardando cliente", variant: "outline", className: "bg-warning text-warning-foreground border-warning" },
    test: { label: "Teste", variant: "outline", className: "bg-purple-500 text-white border-purple-500" },
  };

  const config = statusConfig[status] || { label: getStatusLabel(status), variant: "outline" as const };
  return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case "high":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "medium":
      return <Clock className="h-4 w-4 text-warning" />;
    default:
      return <CheckCircle2 className="h-4 w-4 text-success" />;
  }
};

const TodayDemandsModal = ({ open, onOpenChange, title, projects }: TodayDemandsModalProps) => {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {projects.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Sem demandas registradas para hoje</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                // Don't mark as overdue if status is waiting_client or test
                const isOverdue = project.end_date && 
                  project.end_date < today && 
                  project.status !== "completed" &&
                  project.status !== "waiting_client" &&
                  project.status !== "test" &&
                  project.status !== "on_hold" &&
                  project.status !== "cancelled";
                return (
                  <TableRow key={project.id} className={isOverdue ? "bg-destructive/10" : ""}>
                    <TableCell className="font-medium">
                      <div>
                        {project.title}
                        {isOverdue && <AlertTriangle className="h-4 w-4 text-destructive ml-2 inline" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.client_name || "Sem cliente"}
                    </TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(project.priority)}
                        <span className="capitalize">
                          {project.priority === "high" ? "Alta" : project.priority === "medium" ? "Média" : "Baixa"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.end_date 
                        ? new Date(project.end_date + "T12:00:00").toLocaleDateString("pt-BR") 
                        : "Não definido"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TodayDemandsModal;
