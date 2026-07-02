import { z } from "zod";

/**
 * Zod request schemas. These mirror the legacy Pydantic DTOs
 * (backend-legacy/src/Schema/api.py) and the frontend validations
 * (frontend/src/lib/validations.ts) so the API contract is unchanged.
 */

export const loginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1).max(128),
});

export const unofficialLoginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1).max(128),
});

export const memberInSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  email: z.email("Invalid email"),
  // How much this member has paid toward their share, in dollars (>= 0).
  // Stored as integer cents. 0 = nothing yet. Defaults to 0 when omitted.
  paidAmount: z.number().min(0).max(99_999_999.99).optional().default(0),
});

export const expenseInSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1).max(200),
  // Accept dollars; stored as integer cents. Must be >= 0.01.
  amount: z.number().min(0.01).max(99_999_999.99),
  paidBy: z.string().min(1),
  date: z.string().optional().default(""),
});

export const createBillSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().default(""),
  members: z.array(memberInSchema).min(1, "At least one member is required"),
  expenses: z.array(expenseInSchema).min(1, "At least one expense is required"),
});

export const updateBillSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["open", "settled"]).optional(),
  members: z.array(memberInSchema).optional(),
  expenses: z.array(expenseInSchema).optional(),
});

export const memberCreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email("Invalid email"),
  group: z.enum(["hyper", "unofficial", "private"]).default("unofficial"),
});

export const durationSchema = z.object({
  amount: z.number().int().min(1).max(100),
  unit: z.enum(["hour", "day", "week", "year"]),
});

export const inviteCreateSchema = z.object({
  amount: z.number().int().min(1).max(100),
  unit: z.enum(["hour", "day", "week", "year"]),
  group: z.enum(["hyper", "unofficial", "private"]).default("unofficial"),
  expiresInSeconds: z.number().int().min(1).max(365 * 86400).nullable().default(7 * 86400),
  maxUses: z.number().int().min(1).max(1000).nullable().default(1),
});

export const joinSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  email: z.email("Invalid email"),
  password: z.string().min(8).max(128),
});

export const notificationUpdateSchema = z.object({
  read: z.boolean(),
});

export const userSettingUpdateSchema = z.object({
  defaultCurrency: z.string().min(1).max(10),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UnofficialLoginInput = z.infer<typeof unofficialLoginSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type DurationInput = z.infer<typeof durationSchema>;
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;
export type JoinInput = z.infer<typeof joinSchema>;
export type NotificationUpdateInput = z.infer<typeof notificationUpdateSchema>;
export type UserSettingUpdateInput = z.infer<typeof userSettingUpdateSchema>;
