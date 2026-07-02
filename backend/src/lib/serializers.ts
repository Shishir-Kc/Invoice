import type { Bill, BillMember, Expense, Notification, User, UserSetting } from "../db/schema";
import { accessStatus, isOfficial } from "./access";
import { fromMaybeISO } from "./time";

/** Public user shape returned to the frontend. */
export function userToDict(user: User): {
  id: string;
  email: string;
  name: string;
  accountType: string;
  hyperId: string;
} {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountType: user.accountType ?? "",
    hyperId: user.hyperId ?? "",
  };
}

export interface MemberOut {
  id: string;
  name: string;
  email: string;
  /** How much this member has paid toward their share (dollars). */
  paidAmount: number;
  /** Derived: paidAmount >= share. */
  paid: boolean;
  /** Derived: max(0, share - paidAmount) — what they still owe. */
  owes: number;
}

export interface ExpenseOut {
  id: string;
  description: string;
  amount: number; // dollars (float), matches legacy ExpenseOut
  paidBy: string;
  date: string;
}

export interface BillOut {
  id: string;
  title: string;
  description: string;
  members: MemberOut[];
  expenses: ExpenseOut[];
  status: string;
  /** Total cost of the bill in dollars (float), sum of expenses. */
  totalCost: number;
  /** Equal per-member share = totalCost / memberCount (dollars). */
  share: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberWithStatsOut {
  id: string;
  name: string;
  email: string;
  billCount: number;
  totalPaid: number;
  isOfficial: boolean;
  isKicked: boolean;
  accessExpiresAt: string | null;
  accessStatus: "official" | "active" | "expired" | "banned" | "permanent";
  group: string;
}

export interface NotificationOut {
  id: string;
  type: string;
  title: string;
  description: string;
  billId: string | null;
  read: boolean;
  createdAt: string;
}

/** Cents -> dollars (float). */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}
/** Dollars -> integer cents. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function billToOut(
  bill: Bill,
  members: (BillMember & { userName: string; userEmail: string })[],
  expenses: Expense[],
): BillOut {
  // Total cost: prefer the stored column; fall back to summing expenses for
  // bills created before total_cost_cents existed.
  const totalCents = bill.totalCostCents ?? expenses.reduce((s, e) => s + e.amountCents, 0);
  const total = centsToDollars(totalCents);
  const n = members.length;
  // Equal split. Rounded to cents for display; the `paid` flag below uses
  // integer math (paidCents * n >= totalCents) so rounding never marks someone
  // unpaid who has actually covered their share.
  const share = n > 0 ? Math.round((total / n) * 100) / 100 : 0;
  return {
    id: bill.id,
    title: bill.title,
    description: bill.description,
    members: members.map((m) => {
      const paidCents = m.paidCents ?? 0;
      const paidAmount = centsToDollars(paidCents);
      const isPaid = n > 0 && paidCents * n >= totalCents;
      const owes = Math.max(0, Math.round((share - paidAmount) * 100) / 100);
      return { id: m.id, name: m.userName, email: m.userEmail, paidAmount, paid: isPaid, owes };
    }),
    expenses: expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: centsToDollars(e.amountCents),
      paidBy: e.paidByMemberId,
      date: e.createdAt.slice(0, 10),
    })),
    status: bill.status,
    totalCost: total,
    share,
    createdAt: fromMaybeISO(bill.createdAt),
    updatedAt: fromMaybeISO(bill.updatedAt),
  };
}

export function notificationToOut(n: Notification): NotificationOut {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    description: n.description,
    billId: n.billId ?? null,
    read: n.read,
    createdAt: fromMaybeISO(n.createdAt),
  };
}

export function memberWithStats(
  user: User,
  billCount: number,
  totalPaidCents: number,
): MemberWithStatsOut {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    billCount,
    totalPaid: centsToDollars(totalPaidCents),
    isOfficial: isOfficial(user),
    isKicked: user.isKicked,
    accessExpiresAt: user.accessExpiresAt ?? null,
    accessStatus: accessStatus(user),
    group: user.group ?? "unofficial",
  };
}

export function userSettingToOut(s: UserSetting | undefined): { defaultCurrency: string } {
  return { defaultCurrency: s?.defaultCurrency ?? "NPR" };
}
