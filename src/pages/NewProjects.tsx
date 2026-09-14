import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getStoredAuthSession, revokeStoredSession } from "@/lib/authSession";
import { syncTarefaToProjeto } from "@/lib/sprintProjectSync";

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
  CheckCircle2,
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
  ComposedChart,
  BarChart,
  LabelList,
  ReferenceLine,

  Bar,
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
  capacidadeDia?: number;
  encerrada?: boolean;
  encerradaEm?: string;
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
const MIGRATED_KEY = "z3us-novos-projetos-migrado-cloud";

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

/* ------- mescla dados antigos (localStorage) com o quadro do banco -------- */
const norm = (s: any) => String(s ?? "").trim().toLowerCase();

const mergeDb = (remote: DB, local: DB): { db: DB; added: number } => {
  const out: DB = {
    clientes: [...(remote.clientes || [])],
    projetos: [...(remote.projetos || [])],
    sprints: [...(remote.sprints || [])],
    tarefas: [...(remote.tarefas || [])],
    seqSprint: remote.seqSprint || 1,
  };
  let added = 0;

  // ids gerados localmente ("s1", "p2"...) se repetem entre navegadores e NÃO
  // identificam a mesma entidade — a mesclagem é sempre feita pelo nome.
  const newId = (prefix: string, taken: Set<string>) => {
    let i = 1;
    while (taken.has(`${prefix}${i}`)) i++;
    taken.add(`${prefix}${i}`);
    return `${prefix}${i}`;
  };

  // clientes: dedupe por nome
  const cliIds = new Set(out.clientes.map((c) => c.id));
  const cliMap = new Map<string, string>(); // localId -> finalId
  for (const c of local.clientes || []) {
    const hit = out.clientes.find((x) => norm(x.nome) === norm(c.nome));
    if (hit) cliMap.set(c.id, hit.id);
    else {
      const id = cliIds.has(c.id) ? newId("c", cliIds) : (cliIds.add(c.id), c.id);
      out.clientes.push({ ...c, id });
      cliMap.set(c.id, id);
    }
  }

  // projetos: dedupe por (nome + cliente)
  const projIds = new Set(out.projetos.map((p) => p.id));
  const projMap = new Map<string, string>();
  for (const p of local.projetos || []) {
    const clienteId = cliMap.get(p.clienteId) || p.clienteId;
    const hit = out.projetos.find(
      (x) => norm(x.nome) === norm(p.nome) && x.clienteId === clienteId
    );
    if (hit) projMap.set(p.id, hit.id);
    else {
      const id = projIds.has(p.id) ? newId("p", projIds) : (projIds.add(p.id), p.id);
      out.projetos.push({ ...p, id, clienteId });
      projMap.set(p.id, id);
    }
  }

  // sprints: dedupe pelo número da sprint (nome)
  const sprIds = new Set(out.sprints.map((s) => s.id));
  const sprMap = new Map<string, string>();
  for (const s of local.sprints || []) {
    const hit = out.sprints.find((x) => norm(x.nome) === norm(s.nome));
    if (hit) sprMap.set(s.id, hit.id);
    else {
      const id = sprIds.has(s.id) ? newId("s", sprIds) : (sprIds.add(s.id), s.id);
      out.sprints.push({ ...s, id });
      sprMap.set(s.id, id);
    }
  }
  const maiorIdNumerico = out.sprints.reduce((maior, sprint) => {
    const match = sprint.id.match(/^s(\d+)$/);
    return match ? Math.max(maior, Number(match[1])) : maior;
  }, 0);
  out.seqSprint = Math.max(out.seqSprint || 1, local.seqSprint || 1, maiorIdNumerico + 1);


  // atividades: dedupe por id ou (título + projeto + sprint)
  const sig = (t: any) => [norm(t.titulo), t.projetoId || "", t.sprintId || ""].join("|");
  const ids = new Set(out.tarefas.map((t) => t.id));
  const sigs = new Set(out.tarefas.map(sig));
  for (const t of local.tarefas || []) {
    const mapped = {
      ...t,
      projetoId: projMap.get(t.projetoId) || t.projetoId,
      sprintId: sprMap.get(t.sprintId) || t.sprintId,
    };
    if (ids.has(mapped.id) || sigs.has(sig(mapped))) continue;
    ids.add(mapped.id);
    sigs.add(sig(mapped));
    out.tarefas.push(mapped);
    added++;
  }

  return { db: out, added };
};


/* ------------------------------- componente ------------------------------- */

const NewProjectsContent = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [db, setDb] = useState<DB>(seed());
  const [boardLoaded, setBoardLoaded] = useState(false);
  const lastSyncedRef = useRef<string>("");

  const [filterCliente, setFilterCliente] = useState("all");
  const [filterProjeto, setFilterProjeto] = useState("all");
  const [filterSprint, setFilterSprint] = useState<string>("");
  const [boardSprint, setBoardSprint] = useState<string>("ativa");
  const [encerrarModal, setEncerrarModal] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [histId, setHistId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Tarefa, "id">>(emptyForm());
  const [formNames, setFormNames] = useState({ cliente: "", projeto: "", sprint: "" });
  const [sprintModal, setSprintModal] = useState(false);
  const [leadModal, setLeadModal] = useState(false);
  const [sprintForm, setSprintForm] = useState({ id: "", nome: "", inicio: "", fim: "", capacidadeDia: "5.5" });
  const [dragId, setDragId] = useState<string | null>(null);
  const [tab, setTab] = useState("projetos");

  /* ------- carga inicial do quadro compartilhado (banco de dados) --------- */
  useEffect(() => {
    let cancelled = false;

    const localDb = (): DB | null => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as DB;
        return parsed && Array.isArray(parsed.tarefas) ? parsed : null;
      } catch {
        return null;
      }
    };

    const isEmpty = (d?: DB | null) =>
      !d ||
      ((d.tarefas?.length || 0) === 0 &&
        (d.projetos?.length || 0) === 0 &&
        (d.clientes?.length || 0) === 0 &&
        (d.sprints?.length || 0) === 0);

    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("sprint_board")
        .select("data")
        .eq("id", "main")
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        toast.error("Não foi possível carregar o quadro compartilhado.");
        setBoardLoaded(true);
        return;
      }

      const remote = (data?.data as DB) || null;
      const local = localDb();
      const base = { ...seed(), ...(remote || {}) } as DB;

      const jaMigrado = (() => {
        try {
          return localStorage.getItem(MIGRATED_KEY) === "1";
        } catch {
          return false;
        }
      })();

      // mescla automática dos dados antigos do navegador, sem duplicar
      if (!isEmpty(local) && !jaMigrado) {
        const { db: merged, added } = mergeDb(base, { ...seed(), ...(local as DB) });
        const mergedStr = JSON.stringify(merged);
        const mudou = mergedStr !== JSON.stringify(base);
        setDb(merged);
        lastSyncedRef.current = mudou ? "" : mergedStr; // "" força o salvamento no banco
        setBoardLoaded(true);
        try {
          localStorage.setItem(MIGRATED_KEY, "1");
        } catch {
          /* ignore */
        }
        if (mudou) {
          toast.success(
            added > 0
              ? `${added} atividade(s) antiga(s) importada(s) para o quadro compartilhado.`
              : "Dados antigos deste navegador foram mesclados ao quadro compartilhado."
          );
        }
        return;
      }

      lastSyncedRef.current = JSON.stringify(base);
      setDb(base);
      setBoardLoaded(true);

    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* --------- salva no banco (compartilhado) sempre que o quadro muda ------ */
  useEffect(() => {
    if (!boardLoaded) return;
    const payload = JSON.stringify(db);
    if (payload === lastSyncedRef.current) return;

    const timer = setTimeout(async () => {
      lastSyncedRef.current = payload;
      const { error } = await (supabase as any)
        .from("sprint_board")
        .upsert({ id: "main", data: db }, { onConflict: "id" });
      if (error) {
        lastSyncedRef.current = "";
        toast.error("Erro ao salvar no quadro compartilhado: " + error.message);
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, payload);
      } catch {
        /* ignore */
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [db, boardLoaded]);

  /* ------------------ atualização em tempo real entre usuários ------------ */
  useEffect(() => {
    if (!boardLoaded) return;
    const channel = supabase
      .channel("sprint-board-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sprint_board", filter: "id=eq.main" },
        (payload: any) => {
          const incoming = payload.new?.data as DB | undefined;
          if (!incoming) return;
          const str = JSON.stringify({ ...seed(), ...incoming });
          if (str === lastSyncedRef.current) return;
          lastSyncedRef.current = str;
          setDb(JSON.parse(str) as DB);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardLoaded]);


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
    const abertas = db.sprints.filter((s) => !s.encerrada);
    const atual = [...abertas].sort(
      (a, b) => Number((b.nome || "").replace(/sprint/gi, "").trim() || 0) - Number((a.nome || "").replace(/sprint/gi, "").trim() || 0)
    )[0];
    return atual?.id || "all";
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

  const sprintsEncerradas = [...db.sprints]
    .filter((s) => s.encerrada)
    .sort((a, b) => (b.encerradaEm || b.fim).localeCompare(a.encerradaEm || a.fim));
  const sprintsAbertas = db.sprints.filter((s) => !s.encerrada);
  // sprint em andamento = a aberta com maior número
  const sprintAtiva = [...sprintsAbertas].sort(
    (a, b) => Number(sprintNum(b.nome) || 0) - Number(sprintNum(a.nome) || 0)
  )[0];
  const viewingClosed = boardSprint !== "ativa";

  const visibleTarefas = db.tarefas.filter((t) => {
    const p = projById(t.projetoId);
    if (!p) return false;
    if (filterCliente !== "all" && p.clienteId !== filterCliente) return false;
    if (filterProjeto !== "all" && t.projetoId !== filterProjeto) return false;
    if (viewingClosed) return t.sprintId === boardSprint;
    return Boolean(sprintAtiva) && t.sprintId === sprintAtiva.id;
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

  /** monta o payload de espelhamento no módulo Projetos */
  const syncPayload = (t: Tarefa, base: DB, tituloAnterior?: string) => {
    const p = base.projetos.find((x) => x.id === t.projetoId);
    return {
      titulo: t.titulo,
      desc: t.desc,
      cliente: p ? base.clientes.find((c) => c.id === p.clienteId)?.nome || "" : "",
      projeto: p?.nome || "",
      sprint: (base.sprints.find((s) => s.id === t.sprintId)?.nome || "").replace(/sprint/gi, "").trim(),
      dev: t.dev,
      stage: t.stage,
      iniPrev: t.iniPrev,
      fimPrev: t.fimPrev,
      iniReal: t.iniReal,
      fimReal: t.fimReal,
      tituloAnterior,
    };
  };

  const moveTarefa = (id: string, stage: Stage) => {
    let atualizada: Tarefa | null = null;
    let snapshot: DB | null = null;
    setDb((prev) => {
      const next = {
        ...prev,
        tarefas: prev.tarefas.map((t) => {
          if (t.id !== id || t.stage === stage) return t;
          const hoje = todayISO();
          const nova: Tarefa = {
            ...t,
            stage,
            iniReal: stage === "dev" && !t.iniReal ? hoje : t.iniReal,
            fimReal: stage === "done" ? t.fimReal || hoje : "",
            hist: [...(t.hist || []), { stage, at: new Date().toISOString() }],
          };
          atualizada = nova;
          return nova;
        }),
      };
      snapshot = next;
      return next;
    });
    if (atualizada && snapshot) void syncTarefaToProjeto(syncPayload(atualizada, snapshot));
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
          ? prev.tarefas.map((t) =>
              t.id === editingId
                ? {
                    ...t,
                    ...dados,
                    hist:
                      t.stage !== dados.stage
                        ? [...(t.hist || []), { stage: dados.stage, at: new Date().toISOString() }]
                        : t.hist,
                  }
                : t
            )
          : [
              ...prev.tarefas,
              { id: uid(), ...dados, hist: [{ stage: dados.stage, at: new Date().toISOString() }] },
            ],
      };
    });

    const anterior = editingId ? db.tarefas.find((t) => t.id === editingId) : null;
    void syncTarefaToProjeto({
      titulo: form.titulo,
      desc: form.desc,
      cliente: nomeCliente,
      projeto: nomeProjeto,
      sprint: nomeSprint,
      dev: form.dev,
      stage: form.stage,
      iniPrev: form.iniPrev,
      fimPrev: form.fimPrev,
      iniReal: form.iniReal,
      fimReal: form.fimReal,
      tituloAnterior: anterior?.titulo,
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
    const capacidadeDia = Number(String(sprintForm.capacidadeDia).replace(",", ".")) || 5.5;
    if (!nome) return toast.error("Informe o número da sprint");
    if (!inicio || !fim) return toast.error("Informe as datas de início e fim");
    if (fim < inicio) return toast.error("O fim da sprint não pode ser antes do início");
    setDb((prev) =>
      id
        ? { ...prev, sprints: prev.sprints.map((s) => (s.id === id ? { ...s, nome, inicio, fim, capacidadeDia } : s)) }
        : {
            ...prev,
            sprints: [...prev.sprints, { id: `s${prev.seqSprint}`, nome, inicio, fim, capacidadeDia }],
            seqSprint: prev.seqSprint + 1,
          }
    );
    toast.success(id ? "Sprint atualizada" : "Sprint criada");
    setSprintForm({ id: "", nome: "", inicio: "", fim: "", capacidadeDia: "5.5" });
  };

  const deleteSprint = (id: string) => {
    const s = sprintById(id);
    if (!s) return;
    setDb((prev) => ({
      ...prev,
      sprints: prev.sprints.filter((x) => x.id !== id),
      tarefas: prev.tarefas.map((t) => (t.sprintId === id ? { ...t, sprintId: "" } : t)),
    }));
    toast.success(`Sprint ${sprintNum(s.nome)} excluída`);
  };

  const limparSprintsVazias = () => {
    setDb((prev) => {
      const usadas = new Set(prev.tarefas.map((t) => t.sprintId));
      const restantes = prev.sprints.filter((s) => usadas.has(s.id));
      const removidas = prev.sprints.length - restantes.length;
      if (!removidas) {
        toast.info("Nenhuma sprint vazia encontrada");
        return prev;
      }
      toast.success(`${removidas} sprint(s) vazia(s) removida(s)`);
      return { ...prev, sprints: restantes };
    });
  };


  const encerrarSprint = () => {
    if (!sprintAtiva) {
      toast.error("Nenhuma sprint aberta para encerrar");
      return;
    }
    const id = sprintAtiva.id;
    setDb((prev) => ({
      ...prev,
      sprints: prev.sprints.map((s) =>
        s.id === id ? { ...s, encerrada: true, encerradaEm: todayISO() } : s
      ),
    }));
    setBoardSprint("ativa");
    setEncerrarModal(false);
    toast.success(`Sprint ${sprintNum(sprintAtiva.nome)} encerrada · quadro liberado para a próxima sprint`);
  };

  const reabrirSprint = (id: string) => {
    setDb((prev) => ({
      ...prev,
      sprints: prev.sprints.map((s) =>
        s.id === id ? { ...s, encerrada: false, encerradaEm: undefined } : s
      ),
    }));
    setBoardSprint("ativa");
    toast.success("Sprint reaberta");
  };

  const exportCSV = (all?: boolean) => {
    const rows = all ? db.tarefas : visibleTarefas;
    const head = [
      "Projeto", "Cliente", "Atividade", "Responsavel", "Sprint", "Fase", "Nivel de Esforco",
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
    const p = (n: number) => String(n).padStart(2, "0");
    if (v instanceof Date) {
      return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    // serial do Excel (dias desde 30/12/1899)
    if (typeof v === "number" && isFinite(v) && v > 20000 && v < 60000) {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
    }
    const s = String(v).trim();
    const br = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (br) {
      const ano = br[3].length === 2 ? `20${br[3]}` : br[3];
      return `${ano}-${p(Number(br[2]))}-${p(Number(br[1]))}`;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    if (/^\d{5}$/.test(s)) return parseDateCell(Number(s));
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

  const parseEsforco = (v: any): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const s = String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const num = s.match(/\d+/);
    if (num) {
      const n = Number(num[0]);
      const exact = EFFORT_LEVELS.find((e) => e.value === n);
      if (exact) return exact.value;
      return Number.isFinite(n) ? n : null;
    }
    const byLabel = EFFORT_LEVELS.find((e) =>
      e.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(s)
    );
    return byLabel ? byLabel.value : null;
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
            pts: parseEsforco(
              pick(row, [
                "nivel de esforco",
                "nivel esforco",
                "esforco",
                "nivel de esforço",
                "pontos",
                "pts",
                "story points",
              ])
            ),
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
    const hoje = todayISO();
    const done = adminTarefas.filter((t) => t.fimReal);
    const totalPts = adminTarefas.reduce((a, t) => a + (t.pts || 0), 0);
    const donePts = done.reduce((a, t) => a + (t.pts || 0), 0);
    // detalhamento do lead time: 1 linha por atividade concluída
    const leadDetalhe = done.map((t) => {
      const ini = t.iniReal || t.iniPrev;
      const base: "real" | "previsto" | "" = t.iniReal ? "real" : t.iniPrev ? "previsto" : "";
      const dias = ini ? diffDays(t.fimReal, ini) + 1 : null; // conta o dia de início e o de término
      return {
        id: t.id,
        titulo: t.titulo,
        inicio: ini,
        base,
        fim: t.fimReal,
        dias: dias !== null && dias >= 1 ? dias : null,
        motivo: !ini ? "sem data de início" : dias !== null && dias < 1 ? "término anterior ao início" : "",
      };
    });
    const leads = leadDetalhe.map((l) => l.dias).filter((n): n is number => n !== null);
    const leadAvg = leads.length ? (leads.reduce((a, b) => a + b, 0) / leads.length).toFixed(1) : "—";
    // atividades em aberto já com prazo estourado contam como fora do prazo
    const atrasadasAbertas = adminTarefas.filter((t) => !t.fimReal && t.fimPrev && t.fimPrev < hoje);
    const onTime = done.filter((t) => !t.fimPrev || t.fimReal <= t.fimPrev).length;
    const baseAvaliada = done.length + atrasadasAbertas.length;
    const pct = baseAvaliada ? Math.round((onTime / baseAvaliada) * 100) : 0;
    let diasRest: string | number = "—";
    if (sprintSel) {
      const d = diffDays(sprintSel.fim, todayISO());
      diasRest = d < 0 ? "Encerrada" : d;
    }
    return {
      done: done.length,
      total: adminTarefas.length,
      donePts,
      totalPts,
      leadAvg,
      leadDetalhe,
      leadConsiderados: leads.length,
      pct,
      diasRest,
    };
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

  /* --------------------- capacidade da sprint (horas) ---------------------- */

  const CAPACIDADE_DIA_PADRAO = 5.5; // horas por dia por desenvolvedor
  const fmtH = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

  const PTS_HORAS: Record<number, { label: string; faixa: string; horas: number }> = {
    1: { label: "Muito fácil", faixa: "1-3h", horas: 2 },
    2: { label: "Fácil", faixa: "4-8h", horas: 6 },
    3: { label: "Normal", faixa: "9-16h", horas: 12 },
    5: { label: "Complexo", faixa: "17-26h", horas: 21 },
    8: { label: "Muito complexo", faixa: "27-40h", horas: 33 },
    13: { label: "Extremamente complexo", faixa: "+40h", horas: 48 },
    21: { label: "Muito grande (épico)", faixa: "épico", horas: 80 },
  };

  const horasDaTarefa = (pts?: number | null) => (pts ? PTS_HORAS[pts]?.horas ?? 0 : 0);

  // dias úteis (seg-sex) entre duas datas ISO
  const diasUteis = (ini: string, fim: string) => {
    const out: string[] = [];
    if (!ini || !fim || fim < ini) return out;
    const d = new Date(ini + "T00:00:00");
    const end = new Date(fim + "T00:00:00");
    const p = (n: number) => String(n).padStart(2, "0");
    let guard = 0;
    while (d <= end && guard++ < 400) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
      d.setDate(d.getDate() + 1);
    }
    return out;
  };

  const capacidadeDia = sprintSel?.capacidadeDia ?? CAPACIDADE_DIA_PADRAO;
  const diasSprint = useMemo(
    () => (sprintSel ? diasUteis(sprintSel.inicio, sprintSel.fim) : []),
    [sprintSel]
  );
  // sem sprint selecionada: considera as 3 últimas sprints
  const ultimas3 = useMemo(() => {
    if (sprintSel) return [];
    return [...db.sprints]
      .sort((a, b) => Number(sprintNum(b.nome) || 0) - Number(sprintNum(a.nome) || 0))
      .slice(0, 3);
  }, [db.sprints, sprintSel]);
  const diasBase = sprintSel
    ? diasSprint.length || 1
    : ultimas3.reduce((a, s) => a + (diasUteis(s.inicio, s.fim).length || 1), 0) || 1;
  const SPRINT_CAPACIDADE = sprintSel
    ? +(capacidadeDia * (diasSprint.length || 1)).toFixed(1)
    : +ultimas3
        .reduce((a, s) => a + (s.capacidadeDia ?? CAPACIDADE_DIA_PADRAO) * (diasUteis(s.inicio, s.fim).length || 1), 0)
        .toFixed(1) || CAPACIDADE_DIA_PADRAO;


  const capacidadeRows = useMemo(() => {
    return DEVS.map((nome) => {
      const list = adminTarefas.filter((t) => t.dev === nome);
      const itens = list.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        pts: t.pts || 0,
        horas: horasDaTarefa(t.pts),
        info: t.pts ? PTS_HORAS[t.pts] : undefined,
        concluida: !!t.fimReal,
      }));
      const horas = itens.reduce((a, i) => a + i.horas, 0);
      const horasFeitas = itens.filter((i) => i.concluida).reduce((a, i) => a + i.horas, 0);
      return {
        nome,
        itens,
        horas,
        horasFeitas,
        pct: Math.round((horas / SPRINT_CAPACIDADE) * 100),
        saldo: +(SPRINT_CAPACIDADE - horas).toFixed(1),
      };
    }).filter((r) => r.itens.length > 0);
  }, [adminTarefas, SPRINT_CAPACIDADE]);

  const capacidadeEquipe = capacidadeRows.reduce(
    (a, r) => ({
      horas: a.horas + r.horas,
      feitas: a.feitas + r.horasFeitas,
      atividades: a.atividades + r.itens.length,
      capacidade: a.capacidade + SPRINT_CAPACIDADE,
    }),
    { horas: 0, feitas: 0, atividades: 0, capacidade: 0 }
  );

  /* ------------------------- horas por sprint ------------------------------ */

  const horasPorSprint = useMemo(() => {
    return [...db.sprints]
      .sort((a, b) => Number(sprintNum(a.nome) || 0) - Number(sprintNum(b.nome) || 0))
      .map((s) => {
        const list = db.tarefas.filter((t) => t.sprintId === s.id);
        const planejado = list.reduce((a, t) => a + horasDaTarefa(t.pts), 0);
        const entregue = list.filter((t) => t.fimReal).reduce((a, t) => a + horasDaTarefa(t.pts), 0);
        const capDia = s.capacidadeDia ?? CAPACIDADE_DIA_PADRAO;
        const dias = diasUteis(s.inicio, s.fim).length || 1;
        // capacidade real da equipe = todos os desenvolvedores da equipe
        const capacidade = +(capDia * dias * DEVS.length).toFixed(1);
        return {
          id: s.id,
          sprint: `Sprint ${sprintNum(s.nome) || s.nome}`,
          planejado: +planejado.toFixed(1),
          entregue: +entregue.toFixed(1),
          capacidade,
          desvio: +(entregue - capacidade).toFixed(1),
          desvioPlan: +(planejado - capacidade).toFixed(1),
          usoPlan: capacidade ? Math.round((planejado / capacidade) * 100) : 0,
          usoReal: capacidade ? Math.round((entregue / capacidade) * 100) : 0,
          dias,
          atividades: list.length,
        };
      })
      .filter((s) => s.atividades > 0)
      .filter((s) => !sprintSel || s.id === sprintSel.id);
  }, [db.sprints, db.tarefas, sprintSel]);

  const comparativoSprint = useMemo(() => {
    if (!horasPorSprint.length)
      return [] as { nome: string; valor: number; rotulo: string; cor: string; capacidade: number }[];
    // quando não há sprint selecionada, soma TODAS as sprints exibidas
    const agg = horasPorSprint.reduce(
      (a, s) => ({
        planejado: +(a.planejado + s.planejado).toFixed(1),
        entregue: +(a.entregue + s.entregue).toFixed(1),
        capacidade: +(a.capacidade + s.capacidade).toFixed(1),
      }),
      { planejado: 0, entregue: 0, capacidade: 0 }
    );
    const usoPlan = agg.capacidade ? Math.round((agg.planejado / agg.capacidade) * 100) : 0;
    const usoReal = agg.capacidade ? Math.round((agg.entregue / agg.capacidade) * 100) : 0;
    const restante = Math.max(0, +(agg.planejado - agg.entregue).toFixed(1));
    return [
      { nome: "Capacidade", valor: agg.capacidade, rotulo: `${fmtH(agg.capacidade)}h`, cor: "#fbbf24", capacidade: agg.capacidade },
      { nome: "Planejado", valor: agg.planejado, rotulo: `${fmtH(agg.planejado)}h · ${usoPlan}%`, cor: "#60a5fa", capacidade: agg.capacidade },
      { nome: "Entregue", valor: agg.entregue, rotulo: `${fmtH(agg.entregue)}h · ${usoReal}%`, cor: "#34d399", capacidade: agg.capacidade },
      { nome: "Em aberto", valor: restante, rotulo: `${fmtH(restante)}h`, cor: "#94a3b8", capacidade: agg.capacidade },
    ];
  }, [horasPorSprint]);








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
    { title: "Métricas Sprint TV", url: "/metricas-sprint-tv", icon: MonitorPlay, external: true },
  ];

  const KpiCard = ({ label, value, sub, tone, onClick }: { label: string; value: any; sub?: string; tone?: string; onClick?: () => void }) => (
    <Card className={`bg-card/60 border-border/60 ${onClick ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`} onClick={onClick}>
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

                  <Select value={boardSprint} onValueChange={setBoardSprint}>
                    <SelectTrigger className="h-9 w-[210px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">
                        {sprintAtiva ? `Sprint em andamento · Sprint ${sprintNum(sprintAtiva.nome)}` : "Nenhuma sprint em andamento"}
                      </SelectItem>
                      {sprintsEncerradas.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Histórico · Sprint {sprintNum(s.nome)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={viewingClosed || !sprintAtiva}
                    onClick={() => setEncerrarModal(true)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Encerrar sprint
                  </Button>

                  <Button size="sm" className="h-9" disabled={viewingClosed} onClick={() => openModal()}>
                    <Plus className="h-4 w-4 mr-2" /> Nova Atividade
                  </Button>
                </div>
              </div>

              {viewingClosed ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                  <p className="text-xs text-amber-300">
                    Visualizando o histórico da Sprint {sprintNum(sprintById(boardSprint)?.nome)} (encerrada
                    {sprintById(boardSprint)?.encerradaEm ? ` em ${fmt(sprintById(boardSprint)!.encerradaEm!)}` : ""}) ·
                    modo somente leitura
                  </p>
                  <Button variant="outline" size="sm" className="h-7" onClick={() => setBoardSprint("ativa")}>
                    Voltar à sprint atual
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => reabrirSprint(boardSprint)}>
                    Reabrir sprint
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Arraste os cards entre as colunas ou use as setas para mover a atividade de fase
                </p>
              )}

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Atividades visíveis" value={kpis.projetos} />
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
                        onDrop={() => !viewingClosed && dragId && moveTarefa(dragId, st.id)}
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
                              draggable={!viewingClosed}
                              onDragStart={() => setDragId(t.id)}
                              onDragEnd={() => setDragId(null)}
                              onDoubleClick={() => !viewingClosed && openModal(t.id)}
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
                                 {t.pts != null && (
                                   <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300">
                                     {t.pts} · {EFFORT_LEVELS.find((e) => e.value === t.pts)?.label || "Esforço"}
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
                                    disabled={viewingClosed || idx === 0}
                                    onClick={() => moveTarefa(t.id, STAGES[idx - 1].id)}
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="outline" size="icon" className="h-7 w-7"
                                    disabled={viewingClosed || idx === STAGES.length - 1}
                                    onClick={() => moveTarefa(t.id, STAGES[idx + 1].id)}
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                 <div className="flex gap-1">
                                   <Button
                                     variant="outline" size="icon" className="h-7 w-7"
                                     title="Histórico de movimentações"
                                     onClick={() => setHistId(t.id)}
                                   >
                                     <History className="h-3.5 w-3.5" />
                                   </Button>
                                   <Button variant="outline" size="icon" className="h-7 w-7" disabled={viewingClosed} onClick={() => openModal(t.id)}>
                                     <Pencil className="h-3.5 w-3.5" />
                                   </Button>
                                 </div>
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
                <KpiCard
                  label="Lead time médio"
                  value={`${adminKpis.leadAvg} dias`}
                  sub={`${adminKpis.leadConsiderados} de ${adminKpis.done} concluídas · ver conferência`}
                  onClick={() => setLeadModal(true)}
                />
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
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Horas por sprint</h3>
                    </div>
                  </div>

                  <div className="grid gap-2 mt-4 sm:grid-cols-2 xl:grid-cols-4">
                    {horasPorSprint.map((s) => (
                      <div key={s.sprint} className="rounded-lg border border-border/60 bg-card p-3">
                        <p className="text-xs text-muted-foreground">{s.sprint} · {s.dias} dias úteis</p>
                        <p className="text-sm font-semibold mt-1">
                          {fmtH(s.entregue)}h <span className="text-muted-foreground">/ {fmtH(s.capacidade)}h</span>
                        </p>
                        <p className={`text-[11px] ${s.desvio < 0 ? "text-amber-400" : "text-emerald-400"}`}>
                          desvio {s.desvio > 0 ? "+" : ""}{fmtH(s.desvio)}h · {s.usoReal}% da capacidade
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="h-64 mt-4">
                    {comparativoSprint.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={comparativoSprint}
                          layout="vertical"
                          margin={{ top: 8, right: 60, left: 8, bottom: 8 }}
                          barCategoryGap={24}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} unit="h" />
                          <YAxis
                            type="category"
                            dataKey="nome"
                            width={110}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <RTooltip
                            cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(v: number) => [`${fmtH(Number(v))}h`, "Horas"]}
                          />
                          <ReferenceLine
                            x={comparativoSprint[0]?.capacidade}
                            stroke="#fbbf24"
                            strokeDasharray="5 5"
                          />
                          <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={28}>
                            {comparativoSprint.map((d) => (
                              <Cell key={d.nome} fill={d.cor} />
                            ))}
                            <LabelList
                              dataKey="rotulo"
                              position="right"
                              style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center pt-24">Selecione uma sprint</p>

                    )}
                  </div>
                </CardContent>
              </Card>



              <Card className="bg-card/60 border-border/60">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">Cálculo da sprint (horas)</h3>
                      <p className="text-xs text-muted-foreground">
                        {sprintSel
                          ? `${fmtH(capacidadeDia)}h/dia × ${diasSprint.length || 1} dias = ${fmtH(SPRINT_CAPACIDADE)}h por desenvolvedor · horas estimadas pelo nível de dificuldade`
                          : `Últimas ${ultimas3.length} sprints · ${fmtH(CAPACIDADE_DIA_PADRAO)}h/dia × ${diasBase} dias = ${fmtH(SPRINT_CAPACIDADE)}h por desenvolvedor`}
                      </p>

                    </div>
                  </div>

                  <div className="grid gap-3 mt-4 sm:grid-cols-2 xl:grid-cols-3">
                    {capacidadeRows.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sem atividades nesta seleção</p>
                    )}
                    {capacidadeRows.map((r) => {
                      const excedeu = r.horas > SPRINT_CAPACIDADE;
                      return (
                        <div key={r.nome} className="rounded-xl border border-border/60 bg-card p-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{r.nome}</span>
                            <span className={`text-sm font-bold ${excedeu ? "text-destructive" : "text-primary"}`}>
                              {fmtH(r.horas)}h / {fmtH(SPRINT_CAPACIDADE)}h
                            </span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                            <i
                              className="block h-full"
                              style={{
                                width: `${Math.min(100, r.pct)}%`,
                                background: excedeu ? "#fb7185" : "#2dd4bf",
                              }}
                            />
                          </div>
                          <p className={`text-[11px] mt-1 ${excedeu ? "text-destructive" : "text-muted-foreground"}`}>
                            {r.itens.length} atividade(s) · {r.pct}% da capacidade ·{" "}
                            {excedeu ? `${fmtH(Math.abs(r.saldo))}h acima` : `${fmtH(r.saldo)}h livres`}
                          </p>
                          {sprintSel && (
                          <ul className="mt-3 space-y-1.5 max-h-52 overflow-y-auto pr-1">

                            {r.itens.map((i) => (
                              <li key={i.id} className="flex items-start justify-between gap-2 text-xs">
                                <span className={i.concluida ? "line-through text-muted-foreground" : ""}>
                                  {i.titulo}
                                  {i.info && (
                                    <span className="block text-[10px] text-muted-foreground">
                                      {i.pts} · {i.info.label} ({i.info.faixa})
                                    </span>
                                  )}
                                </span>
                                <span className="shrink-0 font-medium text-foreground">{fmtH(i.horas)}h</span>
                              </li>
                            ))}
                          </ul>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* --------------------------- modal histórico ---------------------------- */}
      <Dialog open={!!histId} onOpenChange={(o) => !o && setHistId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Histórico de movimentações</DialogTitle>
          </DialogHeader>
          {(() => {
            const t = db.tarefas.find((x) => x.id === histId);
            if (!t) return null;
            const hist = t.hist || [];
            return (
              <div className="space-y-3">
                <p className="text-sm font-semibold">{t.titulo}</p>
                {hist.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma movimentação registrada para esta atividade.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto">
                    {[...hist].reverse().map((h, i) => {
                      const d = new Date(h.at);
                      const pad = (n: number) => String(n).padStart(2, "0");
                      const quando = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      const st = STAGES.find((s) => s.id === h.stage);
                      return (
                        <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${st?.badge || ""}`}>
                            {st?.label || h.stage}
                          </span>
                          <span className="text-xs text-muted-foreground">{quando}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

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
                {sprintFormEncerrada && (
                  <p className="mt-1.5 text-[11px] leading-snug rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 px-2 py-1.5">
                    Atenção: a Sprint {sprintNum(formNames.sprint)} já foi encerrada. Ao salvar, a
                    atividade será registrada em uma sprint finalizada.
                  </p>
                )}
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

      {/* --------------------- conferência do lead time -------------------- */}
      <Dialog open={leadModal} onOpenChange={setLeadModal}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferência do lead time</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Dias = término real − início (real, ou previsto quando não há real), contando o dia inicial e o final.
            Média = soma dos dias ÷ atividades consideradas.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                  <th className="py-2 pr-2">Atividade</th>
                  <th className="py-2 pr-2">Início</th>
                  <th className="py-2 pr-2">Término real</th>
                  <th className="py-2 pr-2 text-right">Dias</th>
                </tr>
              </thead>
              <tbody>
                {adminKpis.leadDetalhe.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-muted-foreground">Nenhuma atividade concluída.</td></tr>
                )}
                {adminKpis.leadDetalhe.map((l) => (
                  <tr key={l.id} className="border-b border-border/40">
                    <td className="py-2 pr-2">{l.titulo}</td>
                    <td className="py-2 pr-2">
                      {l.inicio ? fmt(l.inicio) : "—"}
                      {l.base === "previsto" && <span className="ml-1 text-[10px] text-muted-foreground">(previsto)</span>}
                    </td>
                    <td className="py-2 pr-2">{fmt(l.fim)}</td>
                    <td className="py-2 pr-2 text-right">
                      {l.dias ?? <span className="text-xs text-muted-foreground">{l.motivo || "—"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2 pr-2" colSpan={3}>
                    Média ({adminKpis.leadConsiderados} atividade{adminKpis.leadConsiderados === 1 ? "" : "s"} considerada{adminKpis.leadConsiderados === 1 ? "" : "s"})
                  </td>
                  <td className="py-2 pr-2 text-right">{adminKpis.leadAvg} dias</td>
                </tr>
              </tfoot>
            </table>
          </div>
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
                    <p className="text-sm font-semibold">
                      Sprint {sprintNum(s.nome)}
                      {s.encerrada && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300">
                          encerrada
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmt(s.inicio)} a {fmt(s.fim)}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {db.tarefas.filter((t) => t.sprintId === s.id).length} atividades
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setSprintForm({ id: s.id, nome: s.nome, inicio: s.inicio, fim: s.fim, capacidadeDia: String(s.capacidadeDia ?? 5.5) })}>Editar</Button>
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
            <div className="sm:col-span-3">
              <Label>Capacidade por dia (h/desenvolvedor)</Label>
              <Input inputMode="decimal" value={sprintForm.capacidadeDia} onChange={(e) => setSprintForm({ ...sprintForm, capacidadeDia: e.target.value.replace(/[^0-9.,]/g, "") })} placeholder="5,5" />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {sprintForm.id ? (
              <Button variant="outline" onClick={() => setSprintForm({ id: "", nome: "", inicio: "", fim: "", capacidadeDia: "5.5" })}>
                Cancelar edição
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={limparSprintsVazias}>Limpar sprints vazias</Button>
              <Button variant="outline" onClick={() => setSprintModal(false)}>Fechar</Button>
              <Button onClick={saveSprint}>{sprintForm.id ? "Salvar alterações" : "Adicionar sprint"}</Button>
            </div>

          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------- encerrar sprint --------------------------- */}
      <Dialog open={encerrarModal} onOpenChange={setEncerrarModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar Sprint {sprintAtiva ? sprintNum(sprintAtiva.nome) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              As {sprintAtiva ? db.tarefas.filter((t) => t.sprintId === sprintAtiva.id).length : 0} atividades desta
              sprint serão arquivadas e o quadro ficará vazio para a próxima sprint.
            </p>
            <p>Você poderá consultar tudo depois pelo filtro "Histórico · Sprint {sprintAtiva ? sprintNum(sprintAtiva.nome) : ""}".</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncerrarModal(false)}>Cancelar</Button>
            <Button onClick={encerrarSprint}>Encerrar sprint</Button>
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
