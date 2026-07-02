import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Member, Expense, Settlement } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "NPR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function calculateTotalExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function calculateShare(total: number, memberCount: number): number {
  if (memberCount === 0) return 0;
  return total / memberCount;
}

export function calculateMemberBalance(
  memberId: string,
  expenses: Expense[],
  share: number
): number {
  const paid = expenses
    .filter((e) => e.paidBy === memberId)
    .reduce((sum, e) => sum + e.amount, 0);
  return paid - share;
}

export function calculateSettlements(
  members: Member[],
  expenses: Expense[],
  total: number
): Settlement[] {
  const share = calculateShare(total, members.length);
  const balances = members.map((m) => ({
    id: m.id,
    name: m.name,
    balance: calculateMemberBalance(m.id, expenses, share),
  }));

  return buildSettlementsFromBalances(balances);
}

export function calculateSettlementsFromPaid(
  members: Member[],
  share: number
): Settlement[] {
  const balances = members.map((m) => ({
    id: m.id,
    name: m.name,
    balance: (m.paidAmount ?? 0) - share,
  }));

  return buildSettlementsFromBalances(balances);
}

function buildSettlementsFromBalances(
  balances: { id: string; name: string; balance: number }[]
): Settlement[] {
  const debtors = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance);
  const creditors = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i].balance, creditors[j].balance);
    settlements.push({
      from: debtors[i].name,
      to: creditors[j].name,
      amount: Math.round(amount * 100) / 100,
    });
    debtors[i].balance += amount;
    creditors[j].balance -= amount;
    if (Math.abs(debtors[i].balance) < 0.01) i++;
    if (Math.abs(creditors[j].balance) < 0.01) j++;
  }

  return settlements;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
