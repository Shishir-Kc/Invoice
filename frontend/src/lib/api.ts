import axios, { AxiosError } from "axios";
import type {
  Bill,
  PaginatedResponse,
  CreateBillInput,
  UpdateBillInput,
  ApiResponse,
  Member,
  MemberWithStats,
  Notification,
  NotificationDto,
  UserSetting,
  Duration,
  DurationUnit,
  BillGroup,
  InviteResult,
} from "@/types";
import { TOKEN_KEY } from "@/components/auth-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1/invoicely";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Attach the saved HYPER access token to every request.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-logout + redirect to /login on a 401 from the backend — but only on
// authed pages. Public pages (/login, /join) are exempted so an unauthenticated
// visitor on the join page isn't bounced to login by a stray 401.
api.interceptors.response.use(
  (resp) => resp,
  (error: AxiosError) => {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const isPublicPage = path.startsWith("/login") || path.startsWith("/join");
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !isPublicPage
    ) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("invoicely_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const billApi = {
  list: (params?: { search?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<Bill>>("/bills", { params }),

  get: (id: string) =>
    api.get<Bill>(`/bills/${id}`),

  create: (data: CreateBillInput) =>
    api.post<ApiResponse<Bill>>("/bills", data),

  update: (data: UpdateBillInput) =>
    api.patch<ApiResponse<Bill>>(`/bills/${data.id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/bills/${id}`),

  settle: (id: string) =>
    api.post<ApiResponse<Bill>>(`/bills/${id}/settle`),
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: { id: string; email: string; name: string; accountType?: string; hyperId?: string } }>>("/auth/login", { email, password }),

  loginUnofficial: (email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: { id: string; email: string; name: string; accountType?: string; hyperId?: string } }>>("/auth/login-unofficial", { email, password }),

  register: (name: string, email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: { id: string; email: string; name: string } }>>("/auth/register", { name, email, password }),

  me: () =>
    api.get<ApiResponse<{ id: string; email: string; name: string; accountType?: string; hyperId?: string }>>("/auth/me"),
};

// Map the backend notification shape (createdAt) to the frontend one (time).
function toNotification(n: NotificationDto): Notification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    description: n.description,
    billId: n.billId ?? undefined,
    read: n.read,
    time: n.createdAt,
  };
}

export const memberApi = {
  list: (params?: { search?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<MemberWithStats>>("/members", { params }),

  create: (data: { name: string; email: string; group: BillGroup }) =>
    api.post<ApiResponse<Member>>("/members", data),

  invite: (data: { amount: number; unit: DurationUnit; group: BillGroup }) =>
    api.post<ApiResponse<InviteResult>>("/members/invite", data),

  join: (data: { token: string; name: string; email: string; password: string }) =>
    api.post<ApiResponse<{ token: string; user: JoinUser }>>("/members/join", data),

  ban: (id: string) =>
    api.post<ApiResponse<MemberWithStats>>(`/members/${id}/ban`),

  unban: (id: string) =>
    api.post<ApiResponse<MemberWithStats>>(`/members/${id}/unban`),

  extend: (id: string, data: Duration) =>
    api.post<ApiResponse<MemberWithStats>>(`/members/${id}/extend`, data),

  permanent: (id: string) =>
    api.post<ApiResponse<MemberWithStats>>(`/members/${id}/permanent`),
};

interface JoinUser {
  id: string;
  email: string;
  name: string;
  accountType?: string;
  hyperId?: string;
}

export const notificationApi = {
  list: (params?: { unread?: boolean }) =>
    api.get<ApiResponse<NotificationDto[]>>("/notifications", { params }).then((res) => ({
      ...res,
      data: { ...res.data, data: (res.data.data ?? []).map(toNotification) },
    })),

  update: (id: string, read: boolean) =>
    api.patch<ApiResponse<NotificationDto>>(`/notifications/${id}`, { read }),

  markAllRead: () =>
    api.post<ApiResponse<void>>("/notifications/mark-all-read"),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/notifications/${id}`),

  clearAll: () =>
    api.delete<ApiResponse<void>>("/notifications"),
};

export const settingsApi = {
  get: () =>
    api.get<ApiResponse<UserSetting>>("/settings"),

  update: (data: UserSetting) =>
    api.put<ApiResponse<UserSetting>>("/settings", data),
};

export default api;
