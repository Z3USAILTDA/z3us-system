import jsPDF from "jspdf";
import { formatDateBR } from "@/lib/utils";
import type {
  WeeklyKPIs,
  PersonRanking,
  TeamRanking,
  DailyTrend,
  InsightItem,
  ClientBreakdown,
  PriorityBreakdown,
  StatusBreakdown,
  WeeklyProject,
} from "@/hooks/useWeeklySummary";

interface WeeklyPdfData {
  startStr: string;
  endStr: string;
  kpis: WeeklyKPIs;
  personRankings: PersonRanking[];
  teamRankings: TeamRanking[];
  dailyTrend: DailyTrend[];
  insights: InsightItem[];
  clientBreakdown: ClientBreakdown[];
  priorityBreakdown: PriorityBreakdown[];
  statusBreakdown: StatusBreakdown[];
  detailProjects: WeeklyProject[];
}

// Colors
const COLORS = {
  bg: "#0B1120",
  cardBg: "#111827",
  headerBg: "#0D9488",
  text: "#E5E7EB",
  textMuted: "#9CA3AF",
  textDark: "#1F2937",
  white: "#FFFFFF",
  success: "#22C55E",
  warning: "#F59E0B",
  info: "#3B82F6",
  accent: "#14B8A6",
  border: "#1E293B",
  tableBg: "#0F172A",
  tableAltBg: "#1E293B",
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addPageBackground(pdf: jsPDF) {
  pdf.setFillColor(COLORS.bg);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function checkPageBreak(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 12) {
    pdf.addPage();
    addPageBackground(pdf);
    return 16;
  }
  return y;
}

function drawSectionTitle(pdf: jsPDF, title: string, y: number): number {
  y = checkPageBreak(pdf, y, 14);
  pdf.setFillColor(COLORS.accent);
  pdf.rect(MARGIN, y, 3, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(COLORS.white);
  pdf.text(title, MARGIN + 7, y + 6);
  return y + 14;
}

function drawKpiBox(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  value: string,
  color: string
) {
  pdf.setFillColor(COLORS.cardBg);
  pdf.roundedRect(x, y, w, 28, 3, 3, "F");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text(title, x + w / 2, y + 9, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(color);
  pdf.text(value, x + w / 2, y + 22, { align: "center" });
}

function drawTable(
  pdf: jsPDF,
  y: number,
  headers: string[],
  rows: string[][],
  colWidths: number[]
): number {
  const rowH = 7;
  const headerH = 8;

  y = checkPageBreak(pdf, y, headerH + rowH * Math.min(rows.length, 3) + 4);

  // Header
  let x = MARGIN;
  pdf.setFillColor(COLORS.tableAltBg);
  pdf.rect(MARGIN, y, CONTENT_W, headerH, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted);
  headers.forEach((h, i) => {
    pdf.text(h, x + 3, y + 5.5);
    x += colWidths[i];
  });
  y += headerH;

  // Rows
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  rows.forEach((row, rowIdx) => {
    y = checkPageBreak(pdf, y, rowH);
    if (rowIdx % 2 === 0) {
      pdf.setFillColor(COLORS.tableBg);
      pdf.rect(MARGIN, y, CONTENT_W, rowH, "F");
    }
    let rx = MARGIN;
    pdf.setTextColor(COLORS.text);
    row.forEach((cell, i) => {
      const maxW = colWidths[i] - 4;
      const truncated = pdf.getTextWidth(cell) > maxW
        ? cell.substring(0, Math.floor(cell.length * (maxW / pdf.getTextWidth(cell)))) + "…"
        : cell;
      pdf.text(truncated, rx + 3, y + 5);
      rx += colWidths[i];
    });
    y += rowH;
  });

  return y + 4;
}

// Simple bar chart drawn with rectangles
function drawMiniBarChart(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  data: { label: string; value: number }[],
  color: string,
  title: string
): number {
  y = checkPageBreak(pdf, y, h + 20);

  pdf.setFillColor(COLORS.cardBg);
  pdf.roundedRect(x, y, w, h + 18, 3, 3, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(COLORS.white);
  pdf.text(title, x + 5, y + 10);

  const chartY = y + 16;
  const chartH = h - 6;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.min((w - 10) / data.length - 2, 14);
  const startX = x + 5;

  data.forEach((d, i) => {
    const barH = (d.value / max) * chartH;
    const bx = startX + i * (barW + 2);
    const by = chartY + chartH - barH;

    pdf.setFillColor(color);
    pdf.roundedRect(bx, by, barW, barH, 1, 1, "F");

    pdf.setFontSize(5.5);
    pdf.setTextColor(COLORS.textMuted);
    pdf.text(d.label, bx + barW / 2, chartY + chartH + 4, { align: "center" });

    if (d.value > 0) {
      pdf.setFontSize(5.5);
      pdf.setTextColor(COLORS.white);
      pdf.text(String(d.value), bx + barW / 2, by - 1.5, { align: "center" });
    }
  });

  return y + h + 20;
}

export function generateWeeklyPdf(data: WeeklyPdfData) {
  const pdf = new jsPDF("p", "mm", "a4");

  // ===== COVER PAGE =====
  addPageBackground(pdf);

  // Top accent bar
  pdf.setFillColor(COLORS.headerBg);
  pdf.rect(0, 0, PAGE_W, 50, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(COLORS.white);
  pdf.text("Resumo da Semana", MARGIN, 25);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor("#B2DFDB");
  pdf.text(
    `${formatDateBR(data.startStr)} a ${formatDateBR(data.endStr)}`,
    MARGIN,
    36
  );

  pdf.setFontSize(9);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text("Z3US · Desempenho semanal consolidado", MARGIN, 45);

  // ===== KPIs =====
  let y = 62;
  y = drawSectionTitle(pdf, "Indicadores Principais", y);

  const kpiW = (CONTENT_W - 8) / 5;
  drawKpiBox(pdf, MARGIN, y, kpiW, "Criadas", String(data.kpis.created), COLORS.info);
  drawKpiBox(pdf, MARGIN + kpiW + 2, y, kpiW, "Concluídas", String(data.kpis.completed), COLORS.success);
  drawKpiBox(pdf, MARGIN + (kpiW + 2) * 2, y, kpiW, "Em Atraso", String(data.kpis.overdue), COLORS.warning);
  drawKpiBox(pdf, MARGIN + (kpiW + 2) * 3, y, kpiW, "Em Andamento", String(data.kpis.inProgress), COLORS.info);
  drawKpiBox(pdf, MARGIN + (kpiW + 2) * 4, y, kpiW, "Sem Prazo", String(data.kpis.withoutDeadline), COLORS.textMuted);
  y += 34;

  const kpi2W = (CONTENT_W - 4) / 3;
  drawKpiBox(pdf, MARGIN, y, kpi2W, "% Conclusão", `${data.kpis.completionRate.toFixed(1)}%`, COLORS.accent);
  drawKpiBox(pdf, MARGIN + kpi2W + 2, y, kpi2W, "Lead Time Médio", `${data.kpis.avgLeadTimeDays.toFixed(1)} dias`, COLORS.accent);
  drawKpiBox(pdf, MARGIN + (kpi2W + 2) * 2, y, kpi2W, "SLA (no prazo)", `${data.kpis.slaRate.toFixed(1)}%`, COLORS.accent);
  y += 34;

  // Comparison with prev week
  const prevCreatedDiff = data.kpis.created - data.kpis.prevCreated;
  const prevCompletedDiff = data.kpis.completed - data.kpis.prevCompleted;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text(
    `vs semana anterior: Criadas ${prevCreatedDiff >= 0 ? "+" : ""}${prevCreatedDiff} | Concluídas ${prevCompletedDiff >= 0 ? "+" : ""}${prevCompletedDiff}`,
    MARGIN,
    y
  );
  y += 10;

  // ===== DAILY TREND (mini bar chart) =====
  if (data.dailyTrend.length > 0) {
    const halfW = (CONTENT_W - 4) / 2;
    y = drawMiniBarChart(
      pdf, MARGIN, y, halfW, 40,
      data.dailyTrend.map((d) => ({ label: d.label, value: d.completed })),
      COLORS.success, "Concluídas por dia"
    );
    // Created trend beside it - go back up
    const createdY = y - 40 - 20;
    drawMiniBarChart(
      pdf, MARGIN + halfW + 4, createdY, halfW, 40,
      data.dailyTrend.map((d) => ({ label: d.label, value: d.created })),
      COLORS.info, "Criadas por dia"
    );
  }

  // ===== TEAM RANKING =====
  if (data.teamRankings.length > 0) {
    y = drawSectionTitle(pdf, "Desempenho por Equipe", y);
    const teamColW = [50, 28, 28, 28, 28, 20];
    y = drawTable(
      pdf, y,
      ["Equipe", "Criadas", "Concluídas", "Em Atraso", "% Participação", "SLA %"],
      data.teamRankings.map((t) => [
        t.name,
        String(t.created),
        String(t.completed),
        String(t.overdue),
        `${t.sharePercent.toFixed(1)}%`,
        `${t.sla.toFixed(0)}%`,
      ]),
      teamColW
    );
  }

  // ===== PERSON RANKING =====
  if (data.personRankings.length > 0) {
    y = drawSectionTitle(pdf, "Desempenho Individual", y);
    const personColW = [42, 22, 22, 22, 20, 22, 32];
    y = drawTable(
      pdf, y,
      ["Nome", "Concluídas", "Criadas", "Em Atraso", "SLA %", "Lead Time", "Top Clientes"],
      data.personRankings.map((p) => [
        p.name,
        String(p.completed),
        String(p.created),
        String(p.overdue),
        `${p.sla.toFixed(0)}%`,
        `${p.avgLeadTimeDays.toFixed(1)}d`,
        p.topClients.slice(0, 2).join(", ") || "—",
      ]),
      personColW
    );
  }

  // ===== BREAKDOWNS =====
  // Client breakdown
  if (data.clientBreakdown.length > 0) {
    y = drawSectionTitle(pdf, "Distribuição por Cliente (Top 10)", y);
    const cbColW = [120, 62];
    y = drawTable(
      pdf, y,
      ["Cliente", "Total"],
      data.clientBreakdown.map((c) => [c.name, String(c.total)]),
      cbColW
    );
  }

  // Priority & Status side by side as small tables
  if (data.priorityBreakdown.length > 0 || data.statusBreakdown.length > 0) {
    y = drawSectionTitle(pdf, "Por Prioridade e Status", y);

    if (data.priorityBreakdown.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(COLORS.white);
      pdf.text("Prioridade", MARGIN, y + 4);
      y += 7;
      const pbColW = [90, 92];
      y = drawTable(
        pdf, y,
        ["Prioridade", "Total"],
        data.priorityBreakdown.map((p) => [p.label, String(p.total)]),
        pbColW
      );
    }

    if (data.statusBreakdown.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(COLORS.white);
      pdf.text("Status", MARGIN, y + 4);
      y += 7;
      const sbColW = [90, 92];
      y = drawTable(
        pdf, y,
        ["Status", "Total"],
        data.statusBreakdown.map((s) => [s.label, String(s.total)]),
        sbColW
      );
    }
  }

  // ===== INSIGHTS =====
  if (data.insights.length > 0) {
    y = drawSectionTitle(pdf, "Insights & Riscos", y);
    data.insights.forEach((insight) => {
      y = checkPageBreak(pdf, y, 10);
      const icon = insight.type === "highlight" ? "✓" : insight.type === "risk" ? "⚠" : "⚡";
      const color = insight.type === "highlight" ? COLORS.success : insight.type === "risk" ? COLORS.warning : COLORS.info;

      pdf.setFillColor(COLORS.cardBg);
      pdf.roundedRect(MARGIN, y, CONTENT_W, 8, 2, 2, "F");

      pdf.setFontSize(7);
      pdf.setTextColor(color);
      pdf.text(icon, MARGIN + 4, y + 5.5);

      pdf.setTextColor(COLORS.text);
      pdf.setFont("helvetica", "normal");
      pdf.text(insight.text, MARGIN + 11, y + 5.5);

      y += 10;
    });
    y += 4;
  }

  // ===== DETAIL TABLE =====
  if (data.detailProjects.length > 0) {
    y = drawSectionTitle(pdf, `Lista Detalhada (${data.detailProjects.length} atividades)`, y);

    const statusLabels: Record<string, string> = {
      planning: "Planejamento",
      in_progress: "Em Andamento",
      completed: "Concluído",
      on_hold: "Pausado",
      waiting_client: "Aguardando cliente",
      test: "Teste",
    };

    const today = new Date().toLocaleDateString("en-CA");
    const getStatus = (p: WeeklyProject) => {
      if (p.status === "completed") return "Concluído";
      if (!p.end_date) return "Sem prazo";
      if (p.end_date < today && p.status !== "waiting_client" && p.status !== "test") return "Atrasado";
      return "No prazo";
    };

    const detailColW = [38, 28, 24, 18, 24, 18, 18, 14];
    y = drawTable(
      pdf, y,
      ["Atividade", "Cliente", "Responsável", "Prioridade", "Status", "Prazo", "Conclusão", "Situação"],
      data.detailProjects.slice(0, 100).map((p) => [
        p.title,
        p.client_name,
        p.responsible || "—",
        p.priority === "high" ? "Alta" : p.priority === "low" ? "Baixa" : "Média",
        statusLabels[p.status] || p.status,
        formatDateBR(p.end_date) || "—",
        formatDateBR(p.actual_end_date) || "—",
        getStatus(p),
      ]),
      detailColW
    );

    if (data.detailProjects.length > 100) {
      pdf.setFontSize(7);
      pdf.setTextColor(COLORS.textMuted);
      pdf.text(
        `Exibindo 100 de ${data.detailProjects.length} atividades`,
        PAGE_W / 2,
        y + 2,
        { align: "center" }
      );
    }
  }

  // Footer on all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(COLORS.textMuted);
    pdf.text(`Z3US · Resumo Semanal · ${formatDateBR(data.startStr)} a ${formatDateBR(data.endStr)}`, MARGIN, PAGE_H - 6);
    pdf.text(`Página ${i} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
  }

  const weekLabel = `${formatDateBR(data.startStr)}-${formatDateBR(data.endStr)}`;
  pdf.save(`Resumo_Semana_${weekLabel}.pdf`);
}
