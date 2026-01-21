import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, User } from "lucide-react";
import TodayDemandsModal from "./TodayDemandsModal";

interface Project {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
  priority: string;
  responsible: string | null;
  client_name?: string;
}

interface PersonDemands {
  responsible: string;
  total: number;
  completed: number;
  inProgress: number;
  delayed: number;
  projects: Project[];
}

interface TodayDemandsByPersonProps {
  demandsByPerson: PersonDemands[];
  printMode?: boolean;
}

const TodayDemandsByPerson = ({ demandsByPerson, printMode }: TodayDemandsByPersonProps) => {
  const [selectedPerson, setSelectedPerson] = useState<PersonDemands | null>(null);

  const displayData = printMode ? demandsByPerson.slice(0, 5) : demandsByPerson.slice(0, 8);
  const hasMore = demandsByPerson.length > displayData.length;

  if (demandsByPerson.length === 0) {
    return (
      <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Demandas de Hoje — por Pessoa
          </CardTitle>
          <CardDescription>Projetos com prazo ou criação para hoje</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Sem demandas registradas para hoje</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Demandas de Hoje — por Pessoa
          </CardTitle>
          <CardDescription>Projetos com prazo ou criação para hoje</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Em Aberto</TableHead>
                <TableHead className="text-center">Concluídas</TableHead>
                <TableHead className="text-center">Atrasadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((person) => (
                <TableRow
                  key={person.responsible}
                  className="cursor-pointer hover:bg-muted/70"
                  onClick={() => setSelectedPerson(person)}
                >
                  <TableCell className="font-medium">{person.responsible}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{person.total}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-info font-semibold">{person.inProgress}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-success font-semibold">{person.completed}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {person.delayed > 0 ? (
                      <div className="flex items-center justify-center gap-1 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-semibold">{person.delayed}</span>
                      </div>
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {hasMore && !printMode && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Clique em uma linha para ver detalhes • {demandsByPerson.length - displayData.length} mais...
            </p>
          )}
        </CardContent>
      </Card>

      <TodayDemandsModal
        open={!!selectedPerson}
        onOpenChange={(open) => !open && setSelectedPerson(null)}
        title={`Demandas de Hoje — ${selectedPerson?.responsible}`}
        projects={selectedPerson?.projects || []}
      />
    </>
  );
};

export default TodayDemandsByPerson;
