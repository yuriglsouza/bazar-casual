import { localDate, scheduledDate } from "@/lib/finance";

export type PaymentTone = "paid" | "unpaid" | "soon";

export function paymentStatus(isPaid: boolean, dueDate?: string | null, kind: "expense" | "sale" = "expense", today = localDate()): { tone: PaymentTone; label: string } {
  if (isPaid) return { tone: "paid", label: kind === "expense" ? "Paga" : "Quitada" };
  if (dueDate && dueDate >= today && dueDate <= scheduledDate(today, 1, "weekly")) return { tone: "soon", label: "Vence em breve" };
  if (dueDate && dueDate < today) return { tone: "unpaid", label: kind === "expense" ? "Vencida" : "Atrasada" };
  return { tone: "unpaid", label: kind === "expense" ? "A pagar" : "A receber" };
}
