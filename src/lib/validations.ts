import { z } from "zod";

// Auth validation schemas
export const signUpSchema = z.object({
  fullName: z.string()
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .trim(),
  email: z.string()
    .email("Email inválido")
    .max(255, "Email muito longo")
    .trim()
    .toLowerCase(),
  password: z.string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter ao menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número")
    .regex(/[^A-Za-z0-9]/, "Senha deve conter ao menos um caractere especial"),
});

export const signInSchema = z.object({
  email: z.string()
    .email("Email inválido")
    .max(255, "Email muito longo")
    .trim()
    .toLowerCase(),
  password: z.string()
    .min(1, "Senha é obrigatória"),
});

// Client validation schema
export const clientSchema = z.object({
  company_name: z.string()
    .min(2, "Nome da empresa deve ter no mínimo 2 caracteres")
    .max(200, "Nome da empresa muito longo")
    .trim(),
  cnpj: z.string()
    .regex(
      /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
      "CNPJ inválido. Formato: XX.XXX.XXX/XXXX-XX"
    )
    .trim(),
  contact_name: z.string()
    .min(2, "Nome do contato deve ter no mínimo 2 caracteres")
    .max(100, "Nome do contato muito longo")
    .trim(),
  email: z.string()
    .email("Email inválido")
    .max(255, "Email muito longo")
    .trim()
    .toLowerCase(),
  phone: z.string()
    .regex(
      /^\(\d{2}\)\s?\d{4,5}-\d{4}$/,
      "Telefone inválido. Formato: (XX) XXXXX-XXXX"
    )
    .or(z.literal(""))
    .optional(),
  address: z.string()
    .max(500, "Endereço muito longo")
    .or(z.literal(""))
    .optional(),
  status: z.enum(["active", "inactive"]),
});

// Team validation schema
export const teamSchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome muito longo")
    .trim(),
  role: z.string()
    .min(2, "Função deve ter no mínimo 2 caracteres")
    .max(100, "Função muito longa")
    .trim(),
  email: z.string()
    .email("Email inválido")
    .max(255, "Email muito longo")
    .trim()
    .toLowerCase()
    .or(z.literal(""))
    .optional(),
  phone: z.string()
    .regex(
      /^\(\d{2}\)\s?\d{4,5}-\d{4}$/,
      "Telefone inválido. Formato: (XX) XXXXX-XXXX"
    )
    .or(z.literal(""))
    .optional(),
  status: z.enum(["active", "inactive"]),
});

// Project validation schema
export const projectSchema = z.object({
  title: z.string()
    .min(3, "Título deve ter no mínimo 3 caracteres")
    .max(200, "Título muito longo")
    .trim(),
  description: z.string()
    .max(1000, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  client_id: z.string()
    .min(1, "Cliente é obrigatório"),
  status: z.enum(["planning", "in_progress", "on_hold", "completed", "cancelled"]),
  priority: z.enum(["low", "medium", "high"]),
  start_date: z.string().optional().or(z.literal("")),
  end_date: z.string().optional().or(z.literal("")),
  progress: z.number()
    .min(0, "Progresso deve ser no mínimo 0")
    .max(100, "Progresso deve ser no máximo 100"),
  observation: z.string()
    .max(1000, "Observação muito longa")
    .optional()
    .or(z.literal("")),
  responsible: z.string()
    .max(100, "Nome do responsável muito longo")
    .optional()
    .or(z.literal("")),
  sprint: z.string()
    .max(50, "Nome da sprint muito longo")
    .optional()
    .or(z.literal("")),
  actual_start_date: z.string().optional().or(z.literal("")),
  actual_end_date: z.string().optional().or(z.literal("")),
  area: z.string()
    .max(100, "Nome da área muito longo")
    .optional()
    .or(z.literal("")),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
export type ClientFormData = z.infer<typeof clientSchema>;
export type TeamFormData = z.infer<typeof teamSchema>;
export type ProjectFormData = z.infer<typeof projectSchema>;
