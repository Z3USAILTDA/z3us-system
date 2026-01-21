import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Converte string de data (YYYY-MM-DD) para exibição em pt-BR sem problemas de timezone
export function formatDateBR(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

// Obtém a data de hoje no formato YYYY-MM-DD (local, não UTC)
export function getTodayLocalDate(): string {
  const today = new Date();
  return today.toLocaleDateString('en-CA'); // Retorna YYYY-MM-DD no fuso local
}

// Obtém a data de ontem no formato YYYY-MM-DD (local, não UTC)
export function getYesterdayLocalDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toLocaleDateString('en-CA');
}
