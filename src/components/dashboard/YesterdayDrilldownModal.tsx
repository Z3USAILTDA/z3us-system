import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";

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

interface YesterdayDrilldownModalProps {
  open: boolean;
  onClose: () => void;
  type: "created" | "completed" | "delayed";
  projects: Project[];
}

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

const getPriorityLabel = (priority: string): string => {
  const priorityMap: Record<string, string> = {
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };
  return priorityMap[priority] || priority;
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
};

const YesterdayDrilldownModal = ({ open, onClose, type, projects }: YesterdayDrilldownModalProps) => {
  const getTitle = () => {
    switch (type) {
      case "created":
        return "Atividades Criadas Ontem";
      case "completed":
        return "Atividades Concluídas Ontem";
      case "delayed":
        return "Atividades em Atraso (Ontem)";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "created":
        return <TrendingUp className="h-5 w-5 text-info" />;
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "delayed":
        return <AlertCircle className="h-5 w-5 text-warning" />;
    }
  };

  // Sort projects based on type
  const sortedProjects = [...projects].sort((a, b) => {
    switch (type) {
      case "delayed":
        // Oldest due_date first (most delayed)
        if (!a.end_date) return 1;
        if (!b.end_date) return -1;
        return a.end_date.localeCompare(b.end_date);
      case "created":
        // Most recent created_at first
        return b.created_at.localeCompare(a.created_at);
      case "completed":
        // Most recent actual_end_date first
        const aDate = a.actual_end_date || a.end_date || "";
        const bDate = b.actual_end_date || b.end_date || "";
        return bDate.localeCompare(aDate);
      default:
        return 0;
    }
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
            <Badge variant="outline" className="ml-2 num">{projects.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        
        {sortedProjects.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Sem atividades para exibir</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {project.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.responsible || "Não atribuído"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.client_name || "-"}
                  </TableCell>
                  <TableCell className="num">
                    {formatDate(project.end_date)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={project.status === "completed" ? "secondary" : "default"}
                      className={
                        project.status === "on_hold" ? "bg-destructive text-destructive-foreground" :
                        project.status === "waiting_client" ? "bg-warning text-warning-foreground" :
                        project.status === "test" ? "bg-primary text-foreground" :
                        ""
                      }
                    >
                      {getStatusLabel(project.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={
                        project.priority === "high" ? "border-warning text-warning" :
                        project.priority === "low" ? "border-success text-success" :
                        "border-muted-foreground"
                      }
                    >
                      {getPriorityLabel(project.priority)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default YesterdayDrilldownModal;
