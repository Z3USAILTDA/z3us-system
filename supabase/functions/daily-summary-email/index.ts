import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resendClient = new Resend(Deno.env.get("RESEND_API_KEY"));

const LOGO_URL = "https://ssljlgmcoilghdyxqihu.supabase.co/storage/v1/object/public/email-assets/logo-z3us.png";

// ==================== UTILITÁRIOS ====================

const getToday = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateBR = (dateString: string | null): string => {
  if (!dateString) return "Sem prazo";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
};

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    planning: "Planejamento",
    in_progress: "Em Andamento",
    completed: "Concluído",
    on_hold: "Pausado",
    waiting_client: "Aguardando cliente",
    test: "Teste",
    cancelled: "Cancelado",
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

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    completed: "#22c55e",
    in_progress: "#3b82f6",
    waiting_client: "#f97316",
    test: "#8b5cf6",
    on_hold: "#ef4444",
    planning: "#64748b",
    cancelled: "#6b7280",
  };
  return colors[status] || "#64748b";
};

const getPriorityColor = (priority: string): { bg: string; text: string } => {
  if (priority === "high") return { bg: "#f59e0b", text: "#000" };
  if (priority === "low") return { bg: "#22c55e", text: "#000" };
  return { bg: "#64748b", text: "#fff" };
};

// ==================== TIPOS ====================

interface Activity {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  responsible: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  observation: string | null;
  client_name: string;
}

// ==================== BUSCAR DADOS ====================

async function fetchActivities(supabase: any, today: string) {
  // Atividades criadas hoje
  const { data: createdToday, error: createdError } = await supabase
    .from("projects")
    .select(`
      id, title, description, status, priority, responsible, 
      end_date, created_at, updated_at, observation,
      clients(company_name)
    `)
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${today}T23:59:59`)
    .order("created_at", { ascending: false });

  if (createdError) throw new Error(`Error fetching created: ${createdError.message}`);

  // Atividades concluídas hoje (usando actual_end_date)
  const { data: completedToday, error: completedError } = await supabase
    .from("projects")
    .select(`
      id, title, description, status, priority, responsible, 
      end_date, created_at, updated_at, observation,
      clients(company_name)
    `)
    .eq("status", "completed")
    .eq("actual_end_date", today)
    .order("updated_at", { ascending: false });

  if (completedError) throw new Error(`Error fetching completed: ${completedError.message}`);

  // Atividades em atraso (prazo < hoje, status != completed, != waiting_client, != test)
  const { data: overdue, error: overdueError } = await supabase
    .from("projects")
    .select(`
      id, title, description, status, priority, responsible, 
      end_date, created_at, updated_at, observation,
      clients(company_name)
    `)
    .lt("end_date", today)
    .neq("status", "completed")
    .neq("status", "waiting_client")
    .neq("status", "test")
    .order("end_date", { ascending: true });

  if (overdueError) throw new Error(`Error fetching overdue: ${overdueError.message}`);

  const mapActivity = (p: any): Activity => ({
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status,
    priority: p.priority,
    responsible: p.responsible || "Não atribuído",
    end_date: p.end_date,
    created_at: p.created_at,
    updated_at: p.updated_at,
    observation: p.observation,
    client_name: p.clients?.company_name || "Sem cliente",
  });

  return {
    created: (createdToday || []).map(mapActivity),
    completed: (completedToday || []).map(mapActivity),
    overdue: (overdue || []).map(mapActivity),
  };
}

// ==================== GERAR HTML DO E-MAIL ====================

function buildActivityTableRows(activities: Activity[]): string {
  if (activities.length === 0) {
    return `
      <tr>
        <td colspan="7" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; border: 1px solid #2d4a6f;">
          Nenhuma atividade
        </td>
      </tr>
    `;
  }

  return activities.map(activity => {
    const statusColor = getStatusColor(activity.status);
    const priorityColors = getPriorityColor(activity.priority);
    const createdDate = activity.created_at ? formatDateBR(activity.created_at.split('T')[0]) : "-";
    
    return `
      <tr>
        <td style="padding: 10px; border: 1px solid #2d4a6f; vertical-align: top;">
          <strong>${activity.title}</strong>
        </td>
        <td style="padding: 10px; border: 1px solid #2d4a6f; vertical-align: top;">
          ${activity.client_name}
        </td>
        <td style="padding: 10px; border: 1px solid #2d4a6f; vertical-align: top;">
          ${activity.responsible}
        </td>
        <td style="padding: 10px; border: 1px solid #2d4a6f; text-align: center; vertical-align: top;">
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; background: ${priorityColors.bg}; color: ${priorityColors.text};">
            ${getPriorityLabel(activity.priority)}
          </span>
        </td>
        <td style="padding: 10px; border: 1px solid #2d4a6f; text-align: center; vertical-align: top;">
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; background: ${statusColor}; color: #fff;">
            ${getStatusLabel(activity.status)}
          </span>
        </td>
        <td style="padding: 10px; border: 1px solid #2d4a6f; text-align: center; vertical-align: top;">
          ${createdDate}
        </td>
        <td style="padding: 10px; border: 1px solid #2d4a6f; text-align: center; vertical-align: top;">
          ${formatDateBR(activity.end_date)}
        </td>
      </tr>
    `;
  }).join('');
}

function buildActivitySection(title: string, emoji: string, activities: Activity[], bgColor: string): string {
  return `
    <div style="margin-bottom: 32px;">
      <h3 style="color: #e2e8f0; margin: 0 0 16px 0; padding: 12px; background: ${bgColor}; border-radius: 8px 8px 0 0;">
        ${emoji} ${title} <span style="font-weight: normal; font-size: 14px;">(${activities.length})</span>
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #1e3a5f;">
            <th style="padding: 10px; text-align: left; border: 1px solid #2d4a6f; color: #e2e8f0;">Título</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #2d4a6f; color: #e2e8f0;">Cliente</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #2d4a6f; color: #e2e8f0;">Responsável</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #2d4a6f; color: #e2e8f0;">Prioridade</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #2d4a6f; color: #e2e8f0;">Status</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #2d4a6f; color: #e2e8f0;">Criação</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #2d4a6f; color: #e2e8f0;">Prazo</th>
          </tr>
        </thead>
        <tbody style="background: #131c2e; color: #e2e8f0;">
          ${buildActivityTableRows(activities)}
        </tbody>
      </table>
    </div>
  `;
}

function buildEmailHtml(
  today: string,
  created: Activity[],
  completed: Activity[],
  overdue: Activity[]
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Resumo Diário – Projetos/Atividades</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d1421; color: #e2e8f0; padding: 24px; margin: 0;">
      <div style="max-width: 1000px; margin: 0 auto; background: #131c2e; border-radius: 12px; padding: 32px; border: 1px solid #1e3a5f;">
        
        <!-- Cabeçalho com Logo -->
        <div style="margin-bottom: 24px;">
          <img src="${LOGO_URL}" alt="Z3US" style="height: 48px; width: auto;" />
        </div>

        <!-- Título e Data -->
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="margin: 0; background: linear-gradient(135deg, #14b8a6, #3b82f6, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 28px;">
            Resumo Diário – Projetos/Atividades
          </h1>
          <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 16px;">
            📅 Data de referência: <strong>${formatDateBR(today)}</strong>
          </p>
        </div>

        <!-- Seção: Criadas Hoje -->
        ${buildActivitySection("Criadas Hoje", "🆕", created, "#0ea5e9")}

        <!-- Seção: Concluídas Hoje -->
        ${buildActivitySection("Concluídas Hoje", "✅", completed, "#22c55e")}

        <!-- Seção: Em Atraso -->
        ${buildActivitySection("Em Atraso", "⚠️", overdue, "#ef4444")}

        <!-- Totais do Dia -->
        <div style="background: linear-gradient(135deg, #1e3a5f, #2d4a6f); padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 16px 0; color: #e2e8f0;">📊 Totais do Dia</h3>
          <div style="display: flex; justify-content: space-around; text-align: center;">
            <div>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Criadas</p>
              <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: bold; color: #0ea5e9;">${created.length}</p>
            </div>
            <div>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Concluídas</p>
              <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: bold; color: #22c55e;">${completed.length}</p>
            </div>
            <div>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Em Atraso</p>
              <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: bold; color: #ef4444;">${overdue.length}</p>
            </div>
          </div>
        </div>

        <!-- Aviso sobre PDF -->
        <div style="background: #1e3a5f; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0; color: #94a3b8; font-size: 14px;">
            📎 Em anexo: <strong>PDF detalhado</strong> com descrições, observações e mais informações.
          </p>
        </div>

        <!-- Rodapé -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e3a5f; text-align: center;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            Este é um e-mail automático gerado pelo sistema Z3US às 18:00.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ==================== GERAR PDF ====================

async function generatePdfReport(
  today: string,
  created: Activity[],
  completed: Activity[],
  overdue: Activity[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const lineHeight = 16;
  
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;

  const darkBlue = rgb(0.05, 0.08, 0.13);
  const textColor = rgb(0.89, 0.91, 0.94);
  const mutedColor = rgb(0.58, 0.64, 0.72);
  const accentBlue = rgb(0.23, 0.51, 0.96);
  const accentGreen = rgb(0.13, 0.77, 0.37);
  const accentRed = rgb(0.94, 0.27, 0.27);
  const accentOrange = rgb(0.96, 0.62, 0.04);

  // Função auxiliar para adicionar nova página
  const addNewPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    yPosition = pageHeight - margin;
  };

  // Função para verificar espaço e adicionar página se necessário
  const checkSpace = (needed: number) => {
    if (yPosition - needed < margin) {
      addNewPage();
    }
  };

  // ===== CAPA =====
  currentPage.drawRectangle({
    x: 0, y: 0, width: pageWidth, height: pageHeight,
    color: darkBlue,
  });

  // Título da capa
  yPosition = pageHeight - 200;
  currentPage.drawText("Z3US", {
    x: margin, y: yPosition,
    size: 48, font: helveticaBold, color: accentBlue,
  });
  
  yPosition -= 60;
  currentPage.drawText("Resumo Diário", {
    x: margin, y: yPosition,
    size: 32, font: helveticaBold, color: textColor,
  });
  
  yPosition -= 40;
  currentPage.drawText("Projetos / Atividades", {
    x: margin, y: yPosition,
    size: 24, font: helvetica, color: mutedColor,
  });
  
  yPosition -= 80;
  currentPage.drawText(`Data: ${formatDateBR(today)}`, {
    x: margin, y: yPosition,
    size: 18, font: helvetica, color: textColor,
  });

  // Totais na capa
  yPosition -= 100;
  currentPage.drawText(`Criadas: ${created.length}  |  Concluídas: ${completed.length}  |  Em Atraso: ${overdue.length}`, {
    x: margin, y: yPosition,
    size: 14, font: helvetica, color: mutedColor,
  });

  // ===== FUNÇÃO PARA RENDERIZAR SEÇÃO DE ATIVIDADES =====
  const renderSection = (
    sectionTitle: string, 
    activities: Activity[], 
    titleColor: { r: number; g: number; b: number }
  ) => {
    addNewPage();
    
    // Background
    currentPage.drawRectangle({
      x: 0, y: 0, width: pageWidth, height: pageHeight,
      color: darkBlue,
    });

    // Título da seção
    currentPage.drawText(sectionTitle, {
      x: margin, y: yPosition,
      size: 22, font: helveticaBold, 
      color: rgb(titleColor.r, titleColor.g, titleColor.b),
    });
    
    yPosition -= 10;
    currentPage.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: pageWidth - margin, y: yPosition },
      thickness: 2,
      color: rgb(titleColor.r, titleColor.g, titleColor.b),
    });
    
    yPosition -= 30;

    if (activities.length === 0) {
      currentPage.drawText("Nenhuma atividade", {
        x: margin, y: yPosition,
        size: 12, font: helvetica, color: mutedColor,
      });
      return;
    }

    // Renderizar cada atividade
    for (const activity of activities) {
      checkSpace(120);

      // Background da atividade
      currentPage.drawRectangle({
        x: margin - 10, y: yPosition - 80,
        width: pageWidth - 2 * margin + 20, height: 100,
        color: rgb(0.08, 0.11, 0.18),
        borderColor: rgb(0.18, 0.29, 0.44),
        borderWidth: 1,
      });

      // Título da atividade
      const titleText = activity.title.length > 60 
        ? activity.title.substring(0, 60) + "..." 
        : activity.title;
      currentPage.drawText(titleText, {
        x: margin, y: yPosition,
        size: 12, font: helveticaBold, color: textColor,
      });
      
      yPosition -= lineHeight;

      // Cliente e Responsável
      currentPage.drawText(`Cliente: ${activity.client_name}  |  Responsável: ${activity.responsible}`, {
        x: margin, y: yPosition,
        size: 10, font: helvetica, color: mutedColor,
      });
      
      yPosition -= lineHeight;

      // Status, Prioridade, Prazo
      const statusText = `Status: ${getStatusLabel(activity.status)}`;
      const priorityText = `Prioridade: ${getPriorityLabel(activity.priority)}`;
      const deadlineText = `Prazo: ${formatDateBR(activity.end_date)}`;
      currentPage.drawText(`${statusText}  |  ${priorityText}  |  ${deadlineText}`, {
        x: margin, y: yPosition,
        size: 10, font: helvetica, color: mutedColor,
      });
      
      yPosition -= lineHeight;

      // Descrição (se existir)
      if (activity.description) {
        const descText = activity.description.length > 100 
          ? activity.description.substring(0, 100) + "..." 
          : activity.description;
        currentPage.drawText(`Descrição: ${descText}`, {
          x: margin, y: yPosition,
          size: 9, font: helvetica, color: mutedColor,
        });
        yPosition -= lineHeight;
      }

      // Observação (se existir)
      if (activity.observation) {
        const obsText = activity.observation.length > 100 
          ? activity.observation.substring(0, 100) + "..." 
          : activity.observation;
        currentPage.drawText(`Obs: ${obsText}`, {
          x: margin, y: yPosition,
          size: 9, font: helvetica, color: mutedColor,
        });
        yPosition -= lineHeight;
      }

      // Última atualização
      const updatedDate = activity.updated_at 
        ? formatDateBR(activity.updated_at.split('T')[0])
        : "-";
      currentPage.drawText(`Última atualização: ${updatedDate}`, {
        x: margin, y: yPosition,
        size: 9, font: helvetica, color: mutedColor,
      });

      yPosition -= 30; // Espaço entre atividades
    }
  };

  // Renderizar as 3 seções
  renderSection("CRIADAS HOJE", created, { r: 0.05, g: 0.65, b: 0.88 });
  renderSection("CONCLUIDAS HOJE", completed, { r: 0.13, g: 0.77, b: 0.37 });
  renderSection("EM ATRASO", overdue, { r: 0.94, g: 0.27, b: 0.27 });

  // ===== RODAPÉ NA ÚLTIMA PÁGINA =====
  const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  currentPage.drawText(`Z3US – Gerado em ${generatedAt}`, {
    x: margin, y: margin / 2,
    size: 9, font: helvetica, color: mutedColor,
  });

  return await pdfDoc.save();
}

// ==================== HANDLER PRINCIPAL ====================

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = getToday();
    console.log(`Generating daily summary for: ${today}`);

    // Buscar dados
    const { created, completed, overdue } = await fetchActivities(supabase, today);
    console.log(`Found: ${created.length} created, ${completed.length} completed, ${overdue.length} overdue`);

    // Gerar HTML do e-mail
    const emailHtml = buildEmailHtml(today, created, completed, overdue);

    // Gerar PDF
    console.log("Generating PDF report...");
    const pdfBytes = await generatePdfReport(today, created, completed, overdue);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
    console.log("PDF generated successfully");

    // Enviar e-mail com anexo
    const emailResponse = await resendClient.emails.send({
      from: "Z3US System <noreply@hermes.z3us.ai>",
      to: ["devs@z3us.ai"],
      cc: ["herbert@z3us.ai", "rodrigo@z3us.ai", "larissa@z3us.ai", "wconceicao@z3us.ai", "asilva@z3us.ai"],
      subject: `📊 Resumo Diário Z3US – ${formatDateBR(today)} | ${created.length} criadas, ${completed.length} concluídas, ${overdue.length} em atraso`,
      html: emailHtml,
      attachments: [
        {
          filename: `resumo-diario-z3us-${today}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    console.log("Daily summary email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily summary email sent successfully with PDF attachment",
        data: {
          date: today,
          createdCount: created.length,
          completedCount: completed.length,
          overdueCount: overdue.length,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending daily summary email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
