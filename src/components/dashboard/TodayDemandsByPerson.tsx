import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle2, Clock, User } from "lucide-react";
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

  const displayData = printMode ? demandsByPerson.slice(0, 4) : demandsByPerson.slice(0, 8);
  const hasMore = demandsByPerson.length > displayData.length;

  if (demandsByPerson.length === 0) {
    return (
      <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className={printMode ? 'py-1 px-2 sm:py-2 sm:px-3' : ''}>
          <CardTitle className={`flex items-center gap-2 ${printMode ? 'text-xs sm:text-sm' : ''}`}>
            <User className={`text-primary ${printMode ? 'h-3 w-3 sm:h-4 sm:w-4' : 'h-5 w-5'}`} />
            Demandas de Hoje — por Pessoa
          </CardTitle>
          {!printMode && <CardDescription>Projetos com prazo ou criação para hoje</CardDescription>}
        </CardHeader>
        <CardContent className={printMode ? 'py-1 px-2 sm:py-2 sm:px-3' : ''}>
          <div className={`text-center text-muted-foreground ${printMode ? 'py-1 sm:py-2' : 'py-8'}`}>
            <Clock className={`mx-auto mb-1 sm:mb-2 opacity-50 ${printMode ? 'h-4 w-4 sm:h-6 sm:w-6' : 'h-12 w-12 mb-4'}`} />
            <p className={printMode ? 'text-[10px] sm:text-xs' : ''}>Sem demandas registradas para hoje</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className={printMode ? 'py-1 px-2 sm:py-2 sm:px-3' : ''}>
          <CardTitle className={`flex items-center gap-1 sm:gap-2 ${printMode ? 'text-xs sm:text-sm' : ''}`}>
            <User className={`text-primary ${printMode ? 'h-3 w-3 sm:h-4 sm:w-4' : 'h-5 w-5'}`} />
            <span className={printMode ? 'truncate' : ''}>Demandas de Hoje — por Pessoa</span>
          </CardTitle>
          {!printMode && <CardDescription>Projetos com prazo ou criação para hoje</CardDescription>}
        </CardHeader>
        <CardContent className={printMode ? 'py-0.5 px-2 sm:py-1 sm:px-3' : ''}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={printMode ? 'text-[10px] sm:text-xs py-0.5 sm:py-1' : ''}>Responsável</TableHead>
                <TableHead className={`text-center ${printMode ? 'text-[10px] sm:text-xs py-0.5 sm:py-1' : ''}`}>Total</TableHead>
                {!printMode && <TableHead className="text-center">Em Aberto</TableHead>}
                <TableHead className={`text-center ${printMode ? 'text-[10px] sm:text-xs py-0.5 sm:py-1' : ''}`}>Concl.</TableHead>
                <TableHead className={`text-center ${printMode ? 'text-[10px] sm:text-xs py-0.5 sm:py-1' : ''}`}>Atras.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((person) => (
                <TableRow
                  key={person.responsible}
                  className={`${!printMode ? 'cursor-pointer hover:bg-muted/70' : ''}`}
                  onClick={() => !printMode && setSelectedPerson(person)}
                >
                  <TableCell className={`font-medium ${printMode ? 'py-0.5 sm:py-1 text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-[100px]' : ''}`}>{person.responsible}</TableCell>
                  <TableCell className={`text-center ${printMode ? 'py-0.5 sm:py-1' : ''}`}>
                    <Badge variant="outline" className={printMode ? 'text-[10px] sm:text-xs px-0.5 sm:px-1' : ''}>{person.total}</Badge>
                  </TableCell>
                  {!printMode && (
                    <TableCell className="text-center">
                      <span className="text-info font-semibold">{person.inProgress}</span>
                    </TableCell>
                  )}
                  <TableCell className={`text-center ${printMode ? 'py-0.5 sm:py-1' : ''}`}>
                    <span className={`text-success font-semibold ${printMode ? 'text-[10px] sm:text-xs' : ''}`}>{person.completed}</span>
                  </TableCell>
                  <TableCell className={`text-center ${printMode ? 'py-0.5 sm:py-1' : ''}`}>
                    {person.delayed > 0 ? (
                      <div className={`flex items-center justify-center gap-0.5 sm:gap-1 text-destructive ${printMode ? 'text-[10px] sm:text-xs' : ''}`}>
                        <X className={printMode ? 'h-2.5 w-2.5 sm:h-3 sm:w-3' : 'h-4 w-4'} />
                        <span className="font-semibold">{person.delayed}</span>
                      </div>
                    ) : (
                      <CheckCircle2 className={`text-success mx-auto ${printMode ? 'h-2.5 w-2.5 sm:h-3 sm:w-3' : 'h-4 w-4'}`} />
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
