import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getStoredAuthSession, revokeStoredSession } from "@/lib/authSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users as UsersIcon,
  Building2,
  FolderKanban,
  LogOut,
  Menu,
  UserCog,
  FileText,
  BarChart3,
  MonitorPlay,
  Sparkles,
  Plus,
  Download,
  Upload,

  Pencil,
  History,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

/* ---------------------------------- tipos --------------------------------- */

type Stage = "backlog" | "todo" | "dev" | "homolog" | "done";

const EFFORT_LEVELS = [
  { value: 1, label: "Muito fácil" },
  { value: 2, label: "Fácil" },
  { value: 3, label: "Normal" },
  { value: 5, label: "Complexo" },
  { value: 8, label: "Muito complexo" },
  { value: 13, label: "Extremamente complexo" },
  { value: 21, label: "Muito grande - Épico" },
];


interface Tarefa {
  id: string;
  projetoId: string;
  sprintId: string;
  dev: string;
  titulo: string;
  desc: string;
  stage: Stage;
  pts: number | null;
  iniPrev: string;
  fimPrev: string;
  iniReal: string;
  fimReal: string;
  hist?: { stage: Stage; at: string }[];
}


interface Sprint {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
}

interface DB {
  clientes: { id: string; nome: string }[];
  projetos: { id: string; nome: string; clienteId: string; desc: string }[];
  sprints: Sprint[];
  tarefas: Tarefa[];
  seqSprint: number;
}

const STAGES: { id: Stage; label: string; color: string; badge: string }[] = [
  { id: "backlog", label: "Backlog da Sprint", color: "#94a3b8", badge: "bg-slate-400/15 text-slate-300" },
  { id: "todo", label: "A Fazer", color: "#a78bfa", badge: "bg-violet-400/15 text-violet-300" },
  { id: "dev", label: "Desenvolvimento", color: "#60a5fa", badge: "bg-blue-400/15 text-blue-300" },
  { id: "homolog", label: "Homologação", color: "#fbbf24", badge: "bg-amber-400/15 text-amber-300" },
  { id: "done", label: "Produção", color: "#34d399", badge: "bg-emerald-400/15 text-emerald-300" },
];

const DEVS = ["Ana", "Patrick", "Larissa", "Paulo", "Roberto", "Thayná"];

const STORAGE_KEY = "z3us-novos-projetos-v2";

const uid = () => Math.random().toString(36).slice(2, 10);

const seed = (): DB => ({
  clientes: [],
  projetos: [],
  sprints: [],
  tarefas: [],
  seqSprint: 1,
});

/* --------------------------------- helpers -------------------------------- */

const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fmt = (d: string) => (d ? d.split("-").reverse().join("/") : "—");
const diffDays = (a: string, b: string) =>
  Math.round((Date.parse(a + "T00:00:00") - Date.parse(b + "T00:00:00")) / 86400000);

const emptyForm = (): Omit<Tarefa, "id"> => ({
  projetoId: "",
  sprintId: "",
  dev: "",
  titulo: "",
  desc: "",
  stage: "backlog",
  pts: null,
  iniPrev: "",
  fimPrev: "",
  iniReal: "",
  fimReal: "",
});

const NONE = "__none__";

/* ------------------------------- componente ------------------------------- */

const NewProjectsContent = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [db, setDb] = useState<DB>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as DB;
    } catch {
      /* ignore */
    }
    return seed();
  });

  const [filterCliente, setFilterCliente] = useState("all");
  const [filterProjeto, setFilterProjeto] = useState("all");
  const [filterSprint, setFilterSprint] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Tarefa, "id">>(emptyForm());
  const [formNames, setFormNames] = useState({ cliente: "", projeto: "", sprint: "" });
  const [sprintModal, setSprintModal] = useState(false);
  const [sprintForm, setSprintForm] = useState({ id: "", nome: "", inicio: "", fim: "" });
  const [dragId, setDragId] = useState<string | null>(null);
  const [tab, setTab] = useState("projetos");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }, [db]);

  useEffect(() => {
    const load = async () => {
      const session = getStoredAuthSession();
      if (!session?.access_token) {
        navigate("/auth");
        return;
      }
      const userId = (session.user as any)?.id;
      if (userId) {
        const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
        setProfile(data);
      }
    };
    load();
  }, [navigate]);

  const currentSprintId = useMemo(() => {
    const t = todayISO();
    const cur = db.sprints.find((s) => s.inicio <= t && t <= s.fim);
    if (cur) return cur.id;
    const past = db.sprints.filter((s) => s.fim < t).sort((a, b) => (a.fim < b.fim ? 1 : -1));
    return past[0]?.id || db.sprints[0]?.id || "all";
  }, [db.sprints]);

  useEffect(() => {
    if (!filterSprint) setFilterSprint(currentSprintId);
  }, [currentSprintId, filterSprint]);

  const projById = (id: string) => db.projetos.find((p) => p.id === id);
  const clienteNome = (id: string) => db.clientes.find((c) => c.id === id)?.nome || "—";
  const sprintById = (id: string) => db.sprints.find((s) => s.id === id);
  // sprints são identificadas apenas pelo número (ex.: "17")
  const sprintNum = (nome?: string) => (nome || "").replace(/sprint/gi, "").trim();

  const projetosFiltrados = db.projetos.filter(
    (p) => filterCliente === "all" || p.clienteId === filterCliente
  );

  const visibleTarefas = db.tarefas.filter((t) => {
    const p = projById(t.projetoId);
    if (!p) return false;
    if (filterCliente !== "all" && p.clienteId !== filterCliente) return false;
    if (filterProjeto !== "all" && t.projetoId !== filterProjeto) return false;
    return true;
  });

  const tarefaStatus = (t: Tarefa) => {
    const hoje = todayISO();
    if (t.fimReal) {
      return t.fimPrev && t.fimReal > t.fimPrev
        ? { cls: "bg-rose-400/15 text-rose-300", txt: "Entregue com atraso" }
        : { cls: "bg-emerald-400/15 text-emerald-300", txt: "Entregue no prazo" };
    }
    if (t.fimPrev && hoje > t.fimPrev) return { cls: "bg-rose-400/15 text-rose-300", txt: "Em atraso" };
    if (t.fimPrev && diffDays(t.fimPrev, hoje) <= 3 && t.stage !== "done")
      return { cls: "bg-amber-400/15 text-amber-300", txt: "Prazo próximo" };
    return null;
  };

  /* --------------------------------- ações -------------------------------- */

  const moveTarefa = (id: string, stage: Stage) => {
    setDb((prev) => ({
      ...prev,
      tarefas: prev.tarefas.map((t) => {
        if (t.id !== id || t.stage === stage) return t;
        const hoje = todayISO();
        return {
          ...t,
          stage,
          iniReal: stage === "dev" && !t.iniReal ? hoje : t.iniReal,
          fimReal: stage === "done" ? t.fimReal || hoje : "",
          hist: [...(t.hist || []), { stage, at: new Date().toISOString() }],
        };
      }),
    }));
    toast.success(`Atividade movida para ${STAGES.find((s) => s.id === stage)?.label}`);
  };

  const openModal = (id?: string) => {
    if (id) {
      const t = db.tarefas.find((x) => x.id === id);
      if (!t) return;
      const { id: _omit, ...rest } = t;
      setForm(rest);
      const p = projById(t.projetoId);
      setFormNames({
        cliente: p ? db.clientes.find((c) => c.id === p.clienteId)?.nome || "" : "",
        projeto: p?.nome || "",
        sprint: sprintNum(sprintById(t.sprintId)?.nome),
      });
      setEditingId(id);
    } else {
      const preProj = filterProjeto !== "all" ? projById(filterProjeto) : undefined;
      setForm({ ...emptyForm() });
      setFormNames({
        cliente:
          filterCliente !== "all"
            ? db.clientes.find((c) => c.id === filterCliente)?.nome || ""
            : preProj
              ? db.clientes.find((c) => c.id === preProj.clienteId)?.nome || ""
              : "",
        projeto: preProj?.nome || "",
        sprint: "",
      });
      setEditingId(null);
    }
    setModalOpen(true);
  };

  const saveTarefa = () => {
    if (!form.titulo.trim()) return toast.error("Informe o título da atividade");
    const nomeCliente = formNames.cliente.trim();
    const nomeProjeto = formNames.projeto.trim();
    const nomeSprint = sprintNum(formNames.sprint);
    if (!nomeProjeto) return toast.error("Informe o projeto");
    if (form.iniPrev && form.fimPrev && form.fimPrev < form.iniPrev)
      return toast.error("Término previsto não pode ser antes do início");
    if (form.iniReal && form.fimReal && form.fimReal < form.iniReal)
      return toast.error("Término real não pode ser antes do início real");

    setDb((prev) => {
      const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
      let clientes = prev.clientes;
      let projetos = prev.projetos;
      let sprints = prev.sprints;
      let seqSprint = prev.seqSprint;

      let clienteId = "";
      if (nomeCliente) {
        const c = clientes.find((x) => eq(x.nome, nomeCliente));
        if (c) clienteId = c.id;
        else {
          clienteId = uid();
          clientes = [...clientes, { id: clienteId, nome: nomeCliente }];
        }
      }

      const projExistente = projetos.find(
        (p) => eq(p.nome, nomeProjeto) && (!clienteId || p.clienteId === clienteId)
      );
      let projetoId: string;
      if (projExistente) {
        projetoId = projExistente.id;
        if (clienteId && projExistente.clienteId !== clienteId) {
          projetos = projetos.map((p) => (p.id === projetoId ? { ...p, clienteId } : p));
        }
      } else {
        projetoId = uid();
        projetos = [...projetos, { id: projetoId, nome: nomeProjeto, clienteId, desc: "" }];
      }

      let sprintId = "";
      if (nomeSprint) {
        const s = sprints.find((x) => eq(x.nome, nomeSprint));
        if (s) sprintId = s.id;
        else {
          sprintId = `s${seqSprint}`;
          seqSprint += 1;
          const inicio = form.iniPrev || todayISO();
          const fim = form.fimPrev || inicio;
          sprints = [...sprints, { id: sprintId, nome: nomeSprint, inicio, fim }];
        }
      }

      const dados = { ...form, projetoId, sprintId };
      return {
        ...prev,
        clientes,
        projetos,
        sprints,
        seqSprint,
        tarefas: editingId
          ? prev.tarefas.map((t) => (t.id === editingId ? { ...t, ...dados } : t))
          : [...prev.tarefas, { id: uid(), ...dados }],
      };
    });
    toast.success(editingId ? "Atividade atualizada" : "Atividade criada");
    setModalOpen(false);
    setEditingId(null);
  };


  const deleteTarefa = () => {
    if (!editingId) return;
    setDb((prev) => ({ ...prev, tarefas: prev.tarefas.filter((t) => t.id !== editingId) }));
    toast.success("Atividade excluída");
    setModalOpen(false);
    setEditingId(null);
  };

  const saveSprint = () => {
    const { id, inicio, fim } = sprintForm;
    const nome = sprintNum(sprintForm.nome);
    if (!nome) return toast.error("Informe o número da sprint");
    if (!inicio || !fim) return toast.error("Informe as datas de início e fim");
    if (fim < inicio) return toast.error("O fim da sprint não pode ser antes do início");
    setDb((prev) =>
      id
        ? { ...prev, sprints: prev.sprints.map((s) => (s.id === id ? { ...s, nome, inicio, fim } : s)) }
        : {
            ...prev,
            sprints: [...prev.sprints, { id: `s${prev.seqSprint}`, nome, inicio, fim }],
            seqSprint: prev.seqSprint + 1,
          }
    );
    toast.success(id ? "Sprint atualizada" : "Sprint criada");
    setSprintForm({ id: "", nome: "", inicio: "", fim: "" });
  };

  const deleteSprint = (id: string) => {
    const s = sprintById(id);
    if (!s) return;
    setDb((prev) => ({
      ...prev,
      sprints: prev.sprints.filter((x) => x.id !== id),
      tarefas: prev.tarefas.map((t) => (t.sprintId === id ? { ...t, sprintId: "" } : t)),
    }));
    toast.success(`${s.nome} excluída`);
  };

  const exportCSV = (all?: boolean) => {
    const rows = all ? db.tarefas : visibleTarefas;
    const head = [
      "Projeto", "Cliente", "Atividade", "Responsavel", "Sprint", "Fase", "Pontos",
      "Inicio Previsto", "Termino Previsto", "Inicio Real", "Termino Real",
    ];
    const lines = [head.join(";")];
    rows.forEach((t) => {
      const p = projById(t.projetoId);
      lines.push(
        [
          p?.nome || "",
          p ? clienteNome(p.clienteId) : "",
          `"${t.titulo.replace(/"/g, '""')}"`,
          t.dev,
          sprintById(t.sprintId)?.nome || "",
          STAGES.find((s) => s.id === t.stage)?.label,
          t.pts ?? "",
          t.iniPrev, t.fimPrev, t.iniReal, t.fimReal,
        ].join(";")
      );
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tarefas-z3us.csv";
    a.click();
    toast.success("CSV exportado");
  };

  /* -------------------------------- importar ------------------------------- */

  const parseDateCell = (v: any): string => {
    if (v === undefined || v === null || v === "") return "";
    if (v instanceof Date) {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    const s = String(v).trim();
    const br = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return "";
  };

  const parseStage = (v: any): Stage => {
    const s = String(v ?? "").toLowerCase().trim();
    const found = STAGES.find((st) => st.id === s || st.label.toLowerCase() === s);
    if (found) return found.id;
    if (s.includes("produ") || s.includes("conclu")) return "done";
    if (s.includes("homolog")) return "homolog";
    if (s.includes("desenvolv")) return "dev";
    if (s.includes("fazer")) return "todo";
    return "backlog";
  };

  const pick = (row: Record<string, any>, keys: string[]) => {
    for (const k of Object.keys(row)) {
      const norm = k
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
      if (keys.includes(norm)) return row[k];
    }
    return "";
  };

  const handleImportFile = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (!rows.length) return toast.error("Planilha vazia");

      let criadas = 0;
      setDb((prev) => {
        const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
        let clientes = [...prev.clientes];
        let projetos = [...prev.projetos];
        let sprints = [...prev.sprints];
        let seqSprint = prev.seqSprint;
        const tarefas = [...prev.tarefas];

        rows.forEach((row) => {
          const titulo = String(pick(row, ["tarefa", "titulo", "title", "demanda", "atividade"]) || "").trim();
          if (!titulo) return;
          const nomeCliente = String(pick(row, ["cliente", "client"]) || "").trim();
          const nomeProjeto = String(pick(row, ["projeto", "project"]) || "").trim();
          const nomeSprint = String(pick(row, ["sprint"]) || "").trim();
          const dev = String(pick(row, ["responsavel", "dev", "responsible"]) || "").trim();
          const desc = String(pick(row, ["descricao", "desc", "observacao"]) || "").trim();

          let clienteId = "";
          if (nomeCliente) {
            const c = clientes.find((x) => eq(x.nome, nomeCliente));
            if (c) clienteId = c.id;
            else {
              clienteId = uid();
              clientes.push({ id: clienteId, nome: nomeCliente });
            }
          }

          let projetoId = "";
          if (nomeProjeto) {
            const p = projetos.find((x) => eq(x.nome, nomeProjeto) && (!clienteId || x.clienteId === clienteId));
            if (p) projetoId = p.id;
            else {
              projetoId = uid();
              projetos.push({ id: projetoId, nome: nomeProjeto, clienteId, desc: "" });
            }
          }

          const iniPrev = parseDateCell(pick(row, ["inicio previsto", "inicio", "data inicio", "start"]));
          const fimPrev = parseDateCell(pick(row, ["termino previsto", "fim previsto", "termino", "fim", "prazo", "end"]));
          const iniReal = parseDateCell(pick(row, ["inicio real"]));
          const fimReal = parseDateCell(pick(row, ["termino real", "fim real"]));

          let sprintId = "";
          if (nomeSprint) {
            const s = sprints.find((x) => eq(x.nome, nomeSprint));
            if (s) sprintId = s.id;
            else {
              sprintId = `s${seqSprint++}`;
              const inicio = iniPrev || todayISO();
              sprints.push({ id: sprintId, nome: nomeSprint, inicio, fim: fimPrev || inicio });
            }
          }

          tarefas.push({
            id: uid(),
            projetoId,
            sprintId,
            dev,
            titulo,
            desc,
            stage: parseStage(pick(row, ["fase", "status", "stage"])),
            pts: null,
            iniPrev,
            fimPrev,
            iniReal,
            fimReal,
          });
          criadas += 1;
        });

        return { ...prev, clientes, projetos, sprints, seqSprint, tarefas };
      });

      if (criadas) toast.success(`${criadas} atividade(s) importada(s)`);
      else toast.error("Nenhuma linha válida encontrada (coluna 'Atividade' obrigatória)");
    } catch (e) {
      toast.error("Não foi possível ler o arquivo");
    }
  };



  /* --------------------------------- KPIs --------------------------------- */

  const kpis = useMemo(() => {
    const done = visibleTarefas.filter((t) => t.stage === "done").length;
    const dev = visibleTarefas.filter((t) => t.stage === "dev").length;
    const late = visibleTarefas.filter((t) => {
      const st = tarefaStatus(t);
      return st?.txt === "Em atraso";
    }).length;
    return {
      projetos: new Set(visibleTarefas.map((t) => t.projetoId)).size,
      done,
      total: visibleTarefas.length,
      dev,
      late,
    };
  }, [visibleTarefas]);

  /* -------------------------------- admin --------------------------------- */

  const sprintSel = filterSprint === "all" ? null : sprintById(filterSprint);
  const adminTarefas =
    filterSprint === "all" ? db.tarefas : db.tarefas.filter((t) => t.sprintId === filterSprint);

  const adminKpis = useMemo(() => {
    const done = adminTarefas.filter((t) => t.fimReal);
    const totalPts = adminTarefas.reduce((a, t) => a + (t.pts || 0), 0);
    const donePts = done.reduce((a, t) => a + (t.pts || 0), 0);
    const leads = done.filter((t) => t.iniReal).map((t) => diffDays(t.fimReal, t.iniReal));
    const leadAvg = leads.length ? (leads.reduce((a, b) => a + b, 0) / leads.length).toFixed(1) : "—";
    const onTime = done.filter((t) => !t.fimPrev || t.fimReal <= t.fimPrev).length;
    const pct = done.length ? Math.round((onTime / done.length) * 100) : 0;
    let diasRest: string | number = "—";
    if (sprintSel) {
      const d = diffDays(sprintSel.fim, todayISO());
      diasRest = d < 0 ? "Encerrada" : d;
    }
    return { done: done.length, total: adminTarefas.length, donePts, totalPts, leadAvg, pct, diasRest };
  }, [adminTarefas, sprintSel]);

  const fasesData = STAGES.map((st) => ({
    name: st.label,
    value: adminTarefas.filter((t) => t.stage === st.id).length,
    color: st.color,
  })).filter((d) => d.value > 0);

  const burndown = useMemo(() => {
    if (!sprintSel) return [];
    const totalPts = adminTarefas.reduce((a, t) => a + (t.pts || 0), 0);
    const days: string[] = [];
    const d = new Date(sprintSel.inicio + "T00:00:00");
    const end = new Date(sprintSel.fim + "T00:00:00");
    while (d <= end) {
      const p = (n: number) => String(n).padStart(2, "0");
      days.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
      d.setDate(d.getDate() + 1);
    }
    const hoje = todayISO();
    return days.map((day, i) => ({
      dia: day.split("-").slice(1).reverse().join("/"),
      ideal: +(totalPts * (1 - i / (days.length - 1 || 1))).toFixed(1),
      real:
        day > hoje
          ? null
          : totalPts -
            adminTarefas.filter((t) => t.fimReal && t.fimReal <= day).reduce((a, t) => a + (t.pts || 0), 0),
    }));
  }, [sprintSel, adminTarefas]);

  const devRows = useMemo(() => {
    const hoje = todayISO();
    return DEVS.map((nome) => {
      const list = adminTarefas.filter((t) => t.dev === nome);
      let done = 0, run = 0, late = 0, todo = 0, lateCount = 0;
      list.forEach((t) => {
        const p = t.pts || 0;
        if (t.fimReal) done += p;
        else if (t.fimPrev && t.fimPrev < hoje) { late += p; lateCount++; }
        else if (t.iniReal || t.stage === "dev" || t.stage === "homolog") run += p;
        else todo += p;
      });
      const total = done + run + late + todo;
      const doneCount = list.filter((t) => t.fimReal).length;
      const note = !list.length
        ? "Sem atividades nesta seleção"
        : lateCount
        ? `${lateCount} atividade(s) em atraso`
        : doneCount === list.length
        ? `Todas as ${list.length} atividades entregues`
        : `${doneCount} de ${list.length} atividades entregues`;
      return { nome, done, run, late, todo, total, note, hasLate: lateCount > 0 };
    });
  }, [adminTarefas]);

  const teamTotals = devRows.reduce(
    (a, r) => ({ done: a.done + r.done, total: a.total + r.total, late: a.late + r.late }),
    { done: 0, total: 0, late: 0 }
  );

  /* --------------------------------- menu --------------------------------- */

  const menuItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Usuários", url: "/dashboard/users", icon: UserCog },
    { title: "Equipes", url: "/dashboard/teams", icon: UsersIcon },
    { title: "Clientes", url: "/dashboard/clients", icon: Building2 },
    { title: "Projetos", url: "/dashboard/projects", icon: FolderKanban },
    { title: "Gestão de Sprints", url: "/dashboard/novos-projetos", icon: Sparkles },
    { title: "Administração", action: () => setTab("admin"), icon: BarChart3 },
    { title: "Documentação", url: "/dashboard/documentation", icon: FileText },
    { title: "Resumo da Semana", url: "/dashboard/weekly-summary", icon: BarChart3 },
    { title: "Métricas TV", url: "/metricas-projetos-tv", icon: MonitorPlay, external: true },
  ];

  const KpiCard = ({ label, value, sub, tone }: { label: string; value: any; sub?: string; tone?: string }) => (
    <Card className="bg-card/60 border-border/60">
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground mb-2">{label}</p>
        <p className={`text-3xl font-bold ${tone || ""}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild={!(item as any).action} onClick={(item as any).action}>
                      {(item as any).action ? (
                        <>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </>
                      ) : (item as any).external ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </a>
                      ) : (
                        <NavLink
                          to={item.url}
                          end
                          className={({ isActive }) =>
                            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                          }
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                revokeStoredSession();
                window.location.replace("/auth");
              }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </SidebarContent>
      </Sidebar>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center px-3 sm:px-6">
          <SidebarTrigger>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SidebarTrigger>
          <div className="ml-auto text-right hidden sm:block">
            <p className="text-sm font-medium">Admin</p>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto min-w-0">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList>
              <TabsTrigger value="projetos">Projetos</TabsTrigger>
              <TabsTrigger value="admin">Administração</TabsTrigger>
            </TabsList>

            {/* ------------------------------ PROJETOS ----------------------------- */}
            <TabsContent value="projetos" className="mt-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Projetos</h1>
                  <p className="text-sm text-muted-foreground">Acompanhe clientes, projetos e atividades</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Select
                    value={filterCliente}
                    onValueChange={(v) => {
                      setFilterCliente(v);
                      setFilterProjeto("all");
                    }}
                  >
                    <SelectTrigger className="h-9 w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os clientes</SelectItem>
                      {db.clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterProjeto} onValueChange={setFilterProjeto}>
                    <SelectTrigger className="h-9 w-[190px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os projetos</SelectItem>
                      {projetosFiltrados.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => exportCSV()}>
                    <Download className="h-4 w-4 mr-2" /> Exportar
                  </Button>
                  <input
                    id="import-tarefas-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => document.getElementById("import-tarefas-input")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Importar
                  </Button>

                  <Button size="sm" className="h-9" onClick={() => openModal()}>
                    <Plus className="h-4 w-4 mr-2" /> Nova Atividade
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Arraste os cards entre as colunas ou use as setas para mover a atividade de fase
              </p>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Projetos visíveis" value={kpis.projetos} />
                <KpiCard label="Atividades concluídas" value={`${kpis.done}/${kpis.total}`} tone="text-primary" />
                <KpiCard label="Em desenvolvimento" value={kpis.dev} />
                <KpiCard label="Em atraso" value={kpis.late} tone={kpis.late ? "text-destructive" : ""} />
              </div>

              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {STAGES.map((st, idx) => {
                    const list = visibleTarefas.filter((t) => t.stage === st.id);
                    return (
                      <div
                        key={st.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dragId && moveTarefa(dragId, st.id)}
                        className="w-[290px] shrink-0 rounded-xl border border-border/60 bg-card/40 p-3 min-h-[220px]"
                      >
                        <div className="flex items-center justify-between mb-3 px-1">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${st.badge}`}>
                            {st.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{list.length}</span>
                        </div>
                        {list.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-6">Solte um card aqui</p>
                        )}
                        {list.map((t) => {
                          const p = projById(t.projetoId);
                          const spr = sprintById(t.sprintId);
                          const status = tarefaStatus(t);
                          return (
                            <div
                              key={t.id}
                              draggable
                              onDragStart={() => setDragId(t.id)}
                              onDragEnd={() => setDragId(null)}
                              onDoubleClick={() => openModal(t.id)}
                              className="mb-3 rounded-xl border border-border bg-card p-4 cursor-grab hover:border-primary/40 transition-colors"
                            >
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <p className="text-sm font-semibold leading-snug">{t.titulo}</p>
                                 {sprintById(t.sprintId)?.nome ? (
                                   <Badge variant="outline" className="shrink-0 text-[10px]">Sprint {sprintNum(sprintById(t.sprintId)?.nome)}</Badge>
                                 ) : null}
                              </div>
                              {t.desc && <p className="text-xs text-muted-foreground mb-2">{t.desc}</p>}
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                                  {p?.nome || "—"}
                                </span>
                                 <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                   {p ? clienteNome(p.clienteId) : "—"}
                                 </span>
                                {t.dev && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-400/15 text-violet-300">
                                    {t.dev}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2 mb-2">
                                {[
                                  ["Início previsto", t.iniPrev],
                                  ["Término previsto", t.fimPrev],
                                  ["Início real", t.iniReal],
                                  ["Término real", t.fimReal],
                                ].map(([l, v]) => (
                                  <div key={l as string}>
                                    <span className="block text-[10px] text-muted-foreground">{l}</span>
                                    <span className="text-[11px] font-semibold">{fmt(v as string)}</span>
                                  </div>
                                ))}
                              </div>
                              {status && (
                                <span className={`inline-block text-[10px] px-2 py-1 rounded-md mb-2 ${status.cls}`}>
                                  {status.txt}
                                </span>
                              )}
                              <div className="flex items-center justify-between">
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline" size="icon" className="h-7 w-7"
                                    disabled={idx === 0}
                                    onClick={() => moveTarefa(t.id, STAGES[idx - 1].id)}
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="outline" size="icon" className="h-7 w-7"
                                    disabled={idx === STAGES.length - 1}
                                    onClick={() => moveTarefa(t.id, STAGES[idx + 1].id)}
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openModal(t.id)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ---------------------------- ADMINISTRAÇÃO --------------------------- */}
            <TabsContent value="admin" className="mt-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Administração</h1>
                  <p className="text-sm text-muted-foreground">
                    Visão do Tech Lead · todos os clientes e projetos
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Select value={filterSprint} onValueChange={setFilterSprint}>
                    <SelectTrigger className="h-9 w-[260px]">
                      <SelectValue placeholder="Sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...db.sprints]
                        .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            Sprint {sprintNum(s.nome)} · {fmt(s.inicio)} a {fmt(s.fim)}
                          </SelectItem>
                        ))}
                      <SelectItem value="all">Todas as sprints</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setSprintModal(true)}>
                    <CalendarRange className="h-4 w-4 mr-2" /> Gerenciar sprints
                  </Button>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => exportCSV(true)}>
                    <Download className="h-4 w-4 mr-2" /> Exportar tudo
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                <KpiCard label="Atividades" value={`${adminKpis.done}/${adminKpis.total}`} sub="concluídas / total" tone="text-primary" />
                <KpiCard label="Nível de Esforço" value={`${adminKpis.donePts}/${adminKpis.totalPts}`} sub="entregues / planejados" />
                <KpiCard label="Entregas no prazo" value={`${adminKpis.pct}%`} tone={adminKpis.pct >= 70 ? "text-primary" : "text-destructive"} />
                <KpiCard label="Lead time médio" value={`${adminKpis.leadAvg} dias`} />
                <KpiCard
                  label="Dias restantes"
                  value={adminKpis.diasRest}
                  sub={sprintSel ? `${fmt(sprintSel.inicio)} a ${fmt(sprintSel.fim)}` : "todas as sprints"}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <Card className="bg-card/60 border-border/60">
                  <CardContent className="p-5">
                    <h3 className="font-semibold">Distribuição por fase</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      {sprintSel ? `Atividades da ${sprintSel.nome}` : "Todas as atividades"}
                    </p>
                    <div className="h-[280px]">
                      {fasesData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={fasesData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                              {fasesData.map((d) => (
                                <Cell key={d.name} fill={d.color} stroke="transparent" />
                              ))}
                            </Pie>
                            <RTooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center pt-24">Sem atividades nesta sprint</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/60 border-border/60">
                  <CardContent className="p-5">
                    <h3 className="font-semibold">Burndown da sprint</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      {sprintSel ? "Atividades restantes · ideal vs. real" : "Selecione uma sprint específica"}
                    </p>
                    <div className="h-[280px]">
                      {burndown.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={burndown}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <RTooltip />
                            <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="6 5" dot={false} />
                            <Line type="monotone" dataKey="real" stroke="#2dd4bf" strokeWidth={2} dot={false} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center pt-24">Selecione uma sprint</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card/60 border-border/60">
                <CardContent className="p-5">
                  <h3 className="font-semibold">Acompanhamento de entregas</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Progresso de cada desenvolvedor em story points
                  </p>
                  <div className="space-y-3">
                    {devRows.map((r) => {
                      const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
                      const seg = (v: number, color: string) =>
                        r.total ? <i style={{ width: `${(v / r.total) * 100}%`, background: color }} className="block h-full" /> : null;
                      return (
                        <div key={r.nome} className="border-b border-border/50 last:border-0 pb-3 last:pb-0">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{r.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              {r.total ? `${r.done}/${r.total} atividades · ${pct}%` : "sem atividades"}
                            </span>
                          </div>
                          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                            {seg(r.done, "#2dd4bf")}
                            {seg(r.run, "#60a5fa")}
                            {seg(r.late, "#fb7185")}
                          </div>
                          <p className={`text-[11px] mt-1 ${r.hasLate ? "text-destructive" : "text-muted-foreground"}`}>
                            {r.note}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between flex-wrap gap-2 border-t border-border/50 pt-3 mt-3 text-sm text-muted-foreground">
                    <span>
                      Equipe:{" "}
                      <strong className="text-foreground">
                        {teamTotals.done}/{teamTotals.total} atividades entregues (
                        {teamTotals.total ? Math.round((teamTotals.done / teamTotals.total) * 100) : 0}%)
                      </strong>
                    </span>
                    {teamTotals.late ? (
                      <span className="text-destructive">{teamTotals.late} atividades em atraso</span>
                    ) : (
                      <span className="text-primary">Nenhuma atividade em atraso</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* ------------------------------ modal tarefa ----------------------------- */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Atividade" : "Nova Atividade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Cliente</Label>
                <Input
                  list="lista-clientes"
                  value={formNames.cliente}
                  onChange={(e) => setFormNames({ ...formNames, cliente: e.target.value })}
                  placeholder="Digite o cliente"
                />
                <datalist id="lista-clientes">
                  {db.clientes.map((c) => (
                    <option key={c.id} value={c.nome} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Projeto</Label>
                <Input
                  list="lista-projetos"
                  value={formNames.projeto}
                  onChange={(e) => setFormNames({ ...formNames, projeto: e.target.value })}
                  placeholder="Digite o projeto"
                />
                <datalist id="lista-projetos">
                  {db.projetos.map((p) => (
                    <option key={p.id} value={p.nome} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select
                  value={form.dev || NONE}
                  onValueChange={(v) => setForm({ ...form, dev: v === NONE ? "" : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Sem responsável —</SelectItem>
                    {DEVS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Título da atividade</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Descreva a atividade" />
            </div>
            <div>
              <Label>Descrição / critérios de aceite</Label>
              <Textarea value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Sprint</Label>
                <Input
                  list="lista-sprints"
                  inputMode="numeric"
                  value={formNames.sprint}
                  onChange={(e) => setFormNames({ ...formNames, sprint: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder="Ex.: 17"
                />
                <datalist id="lista-sprints">
                  {db.sprints.map((s) => (
                    <option key={s.id} value={sprintNum(s.nome)} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Fase</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as Stage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nível de Esforço</Label>
                <Select
                  value={form.pts != null ? String(form.pts) : ""}
                  onValueChange={(v) => setForm({ ...form, pts: v ? Number(v) : null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    {EFFORT_LEVELS.map((l) => (
                      <SelectItem key={l.value} value={String(l.value)}>
                        {l.value} - {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
            <p className="text-xs uppercase tracking-wide text-primary border-b border-border/60 pb-1">Planejamento</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Início previsto</Label>
                <Input type="date" value={form.iniPrev} onChange={(e) => setForm({ ...form, iniPrev: e.target.value })} />
              </div>
              <div>
                <Label>Término previsto</Label>
                <Input type="date" value={form.fimPrev} onChange={(e) => setForm({ ...form, fimPrev: e.target.value })} />
              </div>
            </div>
            <p className="text-xs uppercase tracking-wide text-primary border-b border-border/60 pb-1">Execução real</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Início real</Label>
                <Input type="date" value={form.iniReal} onChange={(e) => setForm({ ...form, iniReal: e.target.value })} />
              </div>
              <div>
                <Label>Término real</Label>
                <Input type="date" value={form.fimReal} onChange={(e) => setForm({ ...form, fimReal: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {editingId ? (
              <Button variant="destructive" onClick={deleteTarefa}>Excluir</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={saveTarefa}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------ modal sprints ---------------------------- */}
      <Dialog open={sprintModal} onOpenChange={setSprintModal}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Sprints</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {[...db.sprints]
              .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))
              .map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{s.nome}</p>
                    <p className="text-xs text-muted-foreground">{fmt(s.inicio)} a {fmt(s.fim)}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {db.tarefas.filter((t) => t.sprintId === s.id).length} atividades
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setSprintForm({ ...s })}>Editar</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteSprint(s.id)}>
                    Excluir
                  </Button>
                </div>
              ))}
          </div>
          <p className="text-xs uppercase tracking-wide text-primary border-b border-border/60 pb-1 mt-4">
            {sprintForm.id ? `Editando: ${sprintForm.nome}` : "Nova sprint"}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Número</Label>
              <Input inputMode="numeric" value={sprintForm.nome} onChange={(e) => setSprintForm({ ...sprintForm, nome: e.target.value.replace(/[^0-9]/g, "") })} placeholder="ex.: 18" />
            </div>
            <div>
              <Label>Início</Label>
              <Input type="date" value={sprintForm.inicio} onChange={(e) => setSprintForm({ ...sprintForm, inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={sprintForm.fim} onChange={(e) => setSprintForm({ ...sprintForm, fim: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {sprintForm.id ? (
              <Button variant="outline" onClick={() => setSprintForm({ id: "", nome: "", inicio: "", fim: "" })}>
                Cancelar edição
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSprintModal(false)}>Fechar</Button>
              <Button onClick={saveSprint}>{sprintForm.id ? "Salvar alterações" : "Adicionar sprint"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const NewProjects = () => (
  <SidebarProvider>
    <NewProjectsContent />
  </SidebarProvider>
);

export default NewProjects;
