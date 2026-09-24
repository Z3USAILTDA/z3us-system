import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
};

const Body = z.object({
  cnpj: z.string().min(1).max(30),
  project_id: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  type: z.enum(["resumo", "tecnica"]),
  visibility: z.enum(["client", "internal"]),
  file_name: z.string().trim().min(1).max(255),
  content_base64: z.string().min(1),
  description: z.string().max(2000).nullable().optional(),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const digits = (s: string) => s.replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Método não permitido" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Segredo compartilhado guardado no Vault do banco
  const { data: secret, error: secErr } = await admin.rpc("get_import_documento_secret");
  const provided = req.headers.get("x-import-secret") ?? "";
  if (secErr || !secret || provided.length !== String(secret).length || provided !== secret) {
    return json(401, { error: "Não autorizado" });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return json(400, { error: "JSON inválido" }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(400, { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors });
  const b = parsed.data;

  const ext = (b.file_name.split(".").pop() || "").toLowerCase();
  if (!MIME[ext]) return json(400, { error: "Formato não permitido (pdf, xlsx, xlsm, xls, docx, md)" });

  let bytes: Uint8Array;
  try {
    const bin = atob(b.content_base64.replace(/^data:[^,]*,/, "").replace(/\s/g, ""));
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch { return json(400, { error: "Base64 inválido" }); }
  if (bytes.length === 0) return json(400, { error: "Arquivo vazio" });
  if (bytes.length > MAX_BYTES) return json(413, { error: `Arquivo acima de ${MAX_BYTES} bytes` });

  // Demanda precisa pertencer ao cliente do CNPJ
  const { data: proj } = await admin.from("projects").select("id, client_id, clients(cnpj)").eq("id", b.project_id).maybeSingle();
  const projCnpj = digits(((proj as any)?.clients?.cnpj) ?? "");
  if (!proj || !projCnpj || projCnpj !== digits(b.cnpj)) {
    return json(422, { error: "Demanda não pertence ao cliente do CNPJ informado" });
  }

  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage.from("documents").upload(path, bytes, { contentType: MIME[ext], upsert: false });
  if (upErr) return json(500, { error: `Falha no upload: ${upErr.message}` });

  const note = "[Importado automaticamente]";
  const { data: doc, error: insErr } = await admin.from("project_documents").insert({
    project_id: b.project_id,
    title: b.title,
    type: b.type,
    visibility: b.visibility,
    file_url: path,
    file_name: b.file_name,
    file_size: bytes.length,
    description: b.description ? `${b.description}\n${note}` : note,
    tags: ["importado-automaticamente"],
    created_by: null,
  }).select("id").single();

  if (insErr) {
    await admin.storage.from("documents").remove([path]);
    return json(500, { error: `Falha ao registrar: ${insErr.message}` });
  }

  return json(200, { document_id: doc.id, file_url: path, file_size: bytes.length });
});
