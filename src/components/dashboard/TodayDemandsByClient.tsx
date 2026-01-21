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

  const displayData = printMode ? demandsByClient.slice(0, 5) : demandsByClient.slice(0, 8);
  const hasMore = demandsByClient.length > displayData.length;

  if (demandsByClient.length === 0) {
    return (
      <Card className="relative bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-accent" />
            Demandas de Hoje — por Cliente
          </CardTitle>
          <CardDescription>Distribuição por cliente</CardDescription>
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
            <Building2 className="h-5 w-5 text-accent" />
            Demandas de Hoje — por Cliente
          </CardTitle>
          <CardDescription>Distribuição por cliente</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Em Aberto</TableHead>
                <TableHead className="text-center">Concluídas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((client) => (
                <TableRow
                  key={client.clientName}
                  className="cursor-pointer hover:bg-muted/70"
                  onClick={() => setSelectedClient(client)}
                >
                  <TableCell className="font-medium">{client.clientName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{client.total}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-info font-semibold">{client.inProgress}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-success font-semibold">{client.completed}</span>
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
