export interface Member {
  id: string;
  name: string;
  email?: string;
}

export interface MemberWithStats extends Member {
  billCount: number;
  totalPaid: number;
  // Access management
  isOfficial: boolean;
  isKicked: boolean;
  accessExpiresAt?: string | null; // ISO datetime; null = permanent
  accessStatus: "official" | "active" | "expired" | "banned" | "permanent";
  /** Visibility group this unofficial member belongs to. */
  group: BillGroup;
}

export type DurationUnit = "hour" | "day" | "week" | "year";

export interface Duration {
  amount: number;
  unit: DurationUnit;
}

export interface InviteResult {
  token: string;
  link: string;
  accessDurationSeconds: number;
  createdAt: string;
}
export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  date: string;
}

export type BillStatus = "open" | "settled";

/** Visibility group assigned to an unofficial member, controlling which bills
 *  they can see:
 *  - "hyper":      all bills created by official members
 *  - "unofficial": bills that include at least one unofficial member
 *  - "private":    only bills they are a member of
 * Official members always see every bill. */
export type BillGroup = "hyper" | "unofficial" | "private";

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
  members: Member[];
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

// Raw shape returned by the backend (uses `createdAt`); mapped to Notification
// (which uses `time`) in the API client.
export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  billId?: string | null;
  read: boolean;
  createdAt: string;
}

export interface UserSetting {
  defaultCurrency: string;
}
