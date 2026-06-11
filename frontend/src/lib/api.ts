import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import type {
  Bill,
  PaginatedResponse,
  CreateBillInput,
  UpdateBillInput,
  ApiResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1/invoicely";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

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
    api.post<ApiResponse<{ token: string; user: { id: string; email: string; name: string } }>>("/auth/login", { email, password }),

  register: (name: string, email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: { id: string; email: string; name: string } }>>("/auth/register", { name, email, password }),

  me: () =>
    api.get<ApiResponse<{ id: string; email: string; name: string }>>("/auth/me"),
};

export default api;
