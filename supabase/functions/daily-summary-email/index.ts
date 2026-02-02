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
    console.log(`Generating daily summary for: ${today}`);

    // Total activities
    const { count: totalProjects } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true });

    // Created today
    const { count: createdToday, data: createdTodayData } = await supabase
      .from("projects")
      .select("id, title, priority, responsible")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`);

    // Completed today (using actual_end_date)
    const { count: completedToday, data: completedTodayData } = await supabase
      .from("projects")
      .select("id, title, priority, responsible")
      .eq("status", "completed")
      .eq("actual_end_date", today);

    // Total open (planning or in_progress)
    const { count: openTotal } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .in("status", ["planning", "in_progress"]);

    // Delayed (end_date < today, not completed, not waiting_client, not test)
    const { count: delayedCount, data: delayedData } = await supabase
      .from("projects")
      .select("id, title, priority, responsible, end_date")
      .lt("end_date", today)
      .neq("status", "completed")
      .neq("status", "waiting_client")
      .neq("status", "test");

    // Get top 10 critical tasks (high priority delayed or upcoming deadline today)
    const criticalTasks = [
      ...(delayedData?.filter(p => p.priority === "high").slice(0, 5) || []),
      ...(delayedData?.filter(p => p.priority !== "high").slice(0, 5) || []),
    ].slice(0, 10);

    const criticalTasksHtml = criticalTasks.length > 0 
      ? `
        <h3 style="color: #f59e0b; margin-top: 24px;">⚠️ Tarefas Críticas (Top 10)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <thead>
            <tr style="background: #1e3a5f;">
              <th style="padding: 8px; text-align: left; border: 1px solid #2d4a6f;">Título</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #2d4a6f;">Responsável</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #2d4a6f;">Prazo</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #2d4a6f;">Prioridade</th>
            </tr>
          </thead>
          <tbody>
            ${criticalTasks.map(task => `
              <tr>
                <td style="padding: 8px; border: 1px solid #2d4a6f;">${task.title}</td>
                <td style="padding: 8px; border: 1px solid #2d4a6f;">${task.responsible || "Não atribuído"}</td>
                <td style="padding: 8px; border: 1px solid #2d4a6f;">${task.end_date ? formatDateBR(task.end_date) : "-"}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #2d4a6f;">
                  <span style="padding: 2px 8px; border-radius: 4px; font-size: 12px; ${
                    task.priority === 'high' 
                      ? 'background: #f59e0b; color: #000;' 
                      : task.priority === 'low'
                        ? 'background: #22c55e; color: #000;'
                        : 'background: #64748b; color: #fff;'
                  }">${task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baixa' : 'Média'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
      : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Resumo Diário Z3US</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d1421; color: #e2e8f0; padding: 24px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background: #131c2e; border-radius: 12px; padding: 24px; border: 1px solid #1e3a5f;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; background: linear-gradient(135deg, #14b8a6, #3b82f6, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 28px;">
              Z3US - Resumo Diário
            </h1>
            <p style="color: #94a3b8; margin: 8px 0 0 0;">${formatDateBR(today)}</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="background: #1e3a5f; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Total de Atividades</p>
              <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: bold; color: #3b82f6;">${totalProjects || 0}</p>
            </div>
            <div style="background: #1e3a5f; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Criadas Hoje</p>
              <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: bold; color: #0ea5e9;">${createdToday || 0}</p>
            </div>
            <div style="background: #1e3a5f; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Concluídas Hoje</p>
              <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: bold; color: #22c55e;">${completedToday || 0}</p>
            </div>
            <div style="background: #1e3a5f; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Total em Aberto</p>
              <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: bold; color: #3b82f6;">${openTotal || 0}</p>
            </div>
          </div>

          <div style="background: linear-gradient(135deg, #7c2d12, #92400e); padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
            <p style="margin: 0; color: #fef3c7; font-size: 14px;">⚠️ Em Atraso</p>
            <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: bold; color: #fbbf24;">${delayedCount || 0}</p>
            <p style="margin: 4px 0 0 0; color: #fcd34d; font-size: 12px;">
              ${totalProjects && totalProjects > 0 ? ((delayedCount || 0) / totalProjects * 100).toFixed(1) : '0.0'}% do total
            </p>
          </div>

          ${criticalTasksHtml}

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e3a5f; text-align: center;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              Este é um e-mail automático gerado pelo sistema Z3US.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send the email
    const emailResponse = await resendClient.emails.send({
      from: "Z3US System <noreply@z3us.ai>",
      to: ["devs@z3us.ai"],
      cc: ["herbert@z3us.ai", "rodrigo@z3us.ai"],
      subject: `📊 Resumo Diário Z3US - ${formatDateBR(today)}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily summary email sent successfully",
        data: {
          date: today,
          totalProjects,
          createdToday,
          completedToday,
          openTotal,
          delayedCount,
          criticalTasksCount: criticalTasks.length,
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
