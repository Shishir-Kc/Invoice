import { z } from "zod";

export const memberSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

export const expenseSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(0.01, "Amount must be at least 0.01"),
  paidBy: z.string().min(1, "Who paid is required"),
  date: z.string().min(1, "Date is required"),
});

export const createBillSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  members: z.array(memberSchema).min(1, "At least one member is required"),
  expenses: z.array(expenseSchema).min(1, "At least one expense is required"),
});

export const updateBillSchema = createBillSchema.partial().extend({
  id: z.string().min(1, "Bill ID is required"),
  status: z.enum(["open", "settled"]).optional(),
});

export type MemberFormData = z.infer<typeof memberSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type CreateBillFormData = z.infer<typeof createBillSchema>;
export type UpdateBillFormData = z.infer<typeof updateBillSchema>;
