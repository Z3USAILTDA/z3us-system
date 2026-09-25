import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Calendar, Clock, Tag, MessageSquare } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  planning: "Planejamento",
  in_progress: "Em Andamento",
  on_hold: "Pausado",
  completed: "Concluído",
  cancelled: "Cancelado",
  waiting_client: "Aguardando Cliente",
};

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-info",
  in_progress: "bg-warning",
  on_hold: "bg-destructive",
  completed: "bg-success",
  cancelled: "bg-destructive",
  waiting_client: "bg-warning",
};

const formatDate = (date?: string | null) => {
  if (!date) return "Não definido";
  const [y, m, d] = date.split("T")[0].split("-");
  if (!y || !m || !d) return "Não definido";
  return `${d}/${m}/${y}`;
};

interface ClientProjectModalProps {
  project: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (projectId: string, observation: string) => void;
}

const ClientProjectModal = ({ project, open, onOpenChange, onSaved }: ClientProjectModalProps) => {
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setObservation(project?.client_observation || "");
  }, [project]);

  if (!project) return null;

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("update_client_observation", {
      _project_id: project.id,
      _observation: observation,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar comentário: " + error.message);
      return;
    }
    toast.success("Comentário salvo com sucesso!");
    onSaved(project.id, observation);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent pr-8">
            {project.title}
          </DialogTitle>
          <DialogDescription>{project.area || "Área não definida"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={STATUS_COLORS[project.status] || "bg-muted"}>
              {STATUS_LABELS[project.status] || project.status}
            </Badge>
            {project.demanda && (
              <Badge variant="outline" className="gap-1">
                <Tag className="h-3 w-3" />
                {project.demanda}
              </Badge>
            )}
            {project.sprint && (
              <Badge variant="outline">Sprint {project.sprint}</Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{project.progress || 0}%</span>
            </div>
            <Progress value={project.progress || 0} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="text-muted-foreground">Entrega</p>
                <p className="font-medium num">{formatDate(project.end_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="text-muted-foreground">Início</p>
                <p className="font-medium num">{formatDate(project.start_date)}</p>
              </div>
            </div>
          </div>

          {project.description && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Descrição</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
            </div>
          )}

          {project.observation && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Observação interna</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.observation}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Seu comentário
            </h4>
            <Textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Deixe aqui um comentário sobre esta demanda..."
              rows={5}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar comentário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientProjectModal;
