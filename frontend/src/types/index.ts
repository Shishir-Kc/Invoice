export interface Member {
  id: string;
  name: string;
  email?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  date: string;
}

export type BillStatus = "open" | "settled";

export interface Bill {
  id: string;
  title: string;
  description?: string;
  members: Member[];
  expenses: Expense[];
  status: BillStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateBillInput {
  title: string;
  description?: string;
  members: Omit<Member, "id">[];
  expenses: Omit<Expense, "id">[];
}

export interface UpdateBillInput extends Partial<CreateBillInput> {
  id: string;
  status?: BillStatus;
}

export type NotificationType = "bill_added" | "payment_received" | "member_joined" | "bill_settled";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
  read: boolean;
  billId?: string;
}
