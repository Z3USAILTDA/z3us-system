import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, Clock } from "lucide-react";
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

interface ClientDemands {
  clientName: string;
  total: number;
  completed: number;
  inProgress: number;
  projects: Project[];
}

interface TodayDemandsByClientProps {
  demandsByClient: ClientDemands[];
  printMode?: boolean;
}

const TodayDemandsByClient = ({ demandsByClient, printMode }: TodayDemandsByClientProps) => {
  const [selectedClient, setSelectedClient] = useState<ClientDemands | null>(null);

  const displayData = printMode ? demandsByClient.slice(0, 4) : demandsByClient.slice(0, 8);
  const hasMore = demandsByClient.length > displayData.length;

  if (demandsByClient.length === 0) {
    return (
      <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className={printMode ? 'py-2 px-3' : ''}>
          <CardTitle className={`flex items-center gap-2 ${printMode ? 'text-sm' : ''}`}>
            <Building2 className={`text-accent ${printMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
            Demandas de Hoje — por Cliente
          </CardTitle>
          {!printMode && <CardDescription>Distribuição por cliente</CardDescription>}
        </CardHeader>
        <CardContent className={printMode ? 'py-2 px-3' : ''}>
          <div className={`text-center text-muted-foreground ${printMode ? 'py-2' : 'py-8'}`}>
            <Clock className={`mx-auto mb-2 opacity-50 ${printMode ? 'h-6 w-6' : 'h-12 w-12 mb-4'}`} />
            <p className={printMode ? 'text-xs' : ''}>Sem demandas registradas para hoje</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className={printMode ? 'py-2 px-3' : ''}>
          <CardTitle className={`flex items-center gap-2 ${printMode ? 'text-sm' : ''}`}>
            <Building2 className={`text-accent ${printMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
            Demandas de Hoje — por Cliente
          </CardTitle>
          {!printMode && <CardDescription>Distribuição por cliente</CardDescription>}
        </CardHeader>
        <CardContent className={printMode ? 'py-1 px-3' : ''}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={printMode ? 'text-xs py-1' : ''}>Cliente</TableHead>
                <TableHead className={`text-center ${printMode ? 'text-xs py-1' : ''}`}>Total</TableHead>
                {!printMode && <TableHead className="text-center">Em Aberto</TableHead>}
                <TableHead className={`text-center ${printMode ? 'text-xs py-1' : ''}`}>Concluídas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((client) => (
                <TableRow
                  key={client.clientName}
                  className={`${!printMode ? 'cursor-pointer hover:bg-muted/70' : ''}`}
                  onClick={() => !printMode && setSelectedClient(client)}
                >
                  <TableCell className={`font-medium ${printMode ? 'py-1 text-xs truncate max-w-[100px]' : ''}`}>{client.clientName}</TableCell>
                  <TableCell className={`text-center ${printMode ? 'py-1' : ''}`}>
                    <Badge variant="outline" className={printMode ? 'text-xs px-1' : ''}>{client.total}</Badge>
                  </TableCell>
                  {!printMode && (
                    <TableCell className="text-center">
                      <span className="text-info font-semibold">{client.inProgress}</span>
                    </TableCell>
                  )}
                  <TableCell className={`text-center ${printMode ? 'py-1' : ''}`}>
                    <span className={`text-success font-semibold ${printMode ? 'text-xs' : ''}`}>{client.completed}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {hasMore && !printMode && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Clique em uma linha para ver detalhes • {demandsByClient.length - displayData.length} mais...
            </p>
          )}
        </CardContent>
      </Card>

      <TodayDemandsModal
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
        title={`Demandas de Hoje — ${selectedClient?.clientName}`}
        projects={selectedClient?.projects || []}
      />
    </>
  );
};

export default TodayDemandsByClient;
