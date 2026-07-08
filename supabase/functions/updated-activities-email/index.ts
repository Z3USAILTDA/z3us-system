import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resendClient = new Resend(Deno.env.get("RESEND_API_KEY"));

const getToday = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateBR = (dateString: string): string => {
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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = getToday();
    console.log(`Generating updated activities email for: ${today}`);

    // Get all projects updated today
    const { data: updatedProjects, error } = await supabase
      .from("projects")
      .select(`
        id,
        title,
        status,
        priority,
        responsible,
        end_date,
        updated_at,
        client_id,
        clients(company_name)
      `)
      .gte("updated_at", `${today}T00:00:00`)
      .lt("updated_at", `${today}T23:59:59`)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const projectCount = updatedProjects?.length || 0;

    if (projectCount === 0) {
      console.log("No projects updated today, skipping email.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No projects updated today, email not sent",
          data: { date: today, updatedCount: 0 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Build table rows for the email
    const tableRows = updatedProjects!.map((project: any) => {
      const clientName = project.clients?.company_name || "Sem cliente";
      const responsible = project.responsible || "Não atribuído";
      const statusLabel = getStatusLabel(project.status);
      const priorityLabel = getPriorityLabel(project.priority);
      const endDate = project.end_date ? formatDateBR(project.end_date) : "Não definido";
      
      // Status badge colors
      let statusBgColor = "#64748b";
      let statusTextColor = "#fff";
      if (project.status === "completed") {
        statusBgColor = "#22c55e";
      } else if (project.status === "in_progress") {
        statusBgColor = "#3b82f6";
      } else if (project.status === "waiting_client") {
        statusBgColor = "#f97316";
      } else if (project.status === "test") {
        statusBgColor = "#8b5cf6";
      } else if (project.status === "on_hold") {
        statusBgColor = "#ef4444";
      }

      // Priority badge colors
      let priorityBgColor = "#64748b";
      if (project.priority === "high") {
        priorityBgColor = "#f59e0b";
        statusTextColor = "#000";
      } else if (project.priority === "low") {
        priorityBgColor = "#22c55e";
        statusTextColor = "#000";
      }

      return `
        <tr>
          <td style="padding: 12px; border: 1px solid #2d4a6f; vertical-align: top;">
            <strong>${project.title}</strong>
          </td>
          <td style="padding: 12px; border: 1px solid #2d4a6f; vertical-align: top;">
            ${clientName}
          </td>
          <td style="padding: 12px; border: 1px solid #2d4a6f; vertical-align: top;">
            ${responsible}
          </td>
          <td style="padding: 12px; border: 1px solid #2d4a6f; text-align: center; vertical-align: top;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; background: ${statusBgColor}; color: #fff;">
              ${statusLabel}
            </span>
          </td>
          <td style="padding: 12px; border: 1px solid #2d4a6f; text-align: center; vertical-align: top;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; background: ${priorityBgColor}; color: ${statusTextColor};">
              ${priorityLabel}
            </span>
          </td>
          <td style="padding: 12px; border: 1px solid #2d4a6f; text-align: center; vertical-align: top;">
            ${endDate}
          </td>
        </tr>
      `;
    }).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Atividades Atualizadas - Z3US</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d1421; color: #e2e8f0; padding: 24px; margin: 0;">
        <div style="max-width: 900px; margin: 0 auto; background: #131c2e; border-radius: 12px; padding: 24px; border: 1px solid #1e3a5f;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; background: linear-gradient(135deg, #14b8a6, #3b82f6, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 28px;">
              Z3US - Atividades Atualizadas
            </h1>
            <p style="color: #94a3b8; margin: 8px 0 0 0;">${formatDateBR(today)}</p>
          </div>

          <div style="background: #1e3a5f; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
            <p style="margin: 0; color: #94a3b8; font-size: 14px;">Total de Atividades Atualizadas Hoje</p>
            <p style="margin: 8px 0 0 0; font-size: 48px; font-weight: bold; color: #3b82f6;">${projectCount}</p>
          </div>

          <h3 style="color: #e2e8f0; margin-bottom: 16px;">📋 Lista de Atividades Atualizadas</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <thead>
              <tr style="background: #1e3a5f;">
                <th style="padding: 12px; text-align: left; border: 1px solid #2d4a6f;">Título</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #2d4a6f;">Cliente</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #2d4a6f;">Responsável</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #2d4a6f;">Status</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #2d4a6f;">Prioridade</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #2d4a6f;">Prazo</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e3a5f; text-align: center;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              Este é um e-mail automático gerado pelo sistema Z3US às 18:00.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send the email
    const emailResponse = await resendClient.emails.send({
      from: "Z3US System <noreply@hermes.z3us.ai>",
      to: ["devs@z3us.ai"],
      cc: ["herbert@z3us.ai", "rodrigo@z3us.ai", "wconceicao@z3us.ai", "asilva@z3us.ai"],
      subject: `📝 Atividades Atualizadas - ${formatDateBR(today)} (${projectCount} ${projectCount === 1 ? 'atividade' : 'atividades'})`,
      html: emailHtml,
    });

    console.log("Updated activities email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Updated activities email sent successfully",
        data: {
          date: today,
          updatedCount: projectCount,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending updated activities email:", error);
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
