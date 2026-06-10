import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import type {
  Bill,
  PaginatedResponse,
  CreateBillInput,
  UpdateBillInput,
  ApiResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const billApi = {
  list: (params?: { search?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<Bill>>("/bills", { params }),

  get: (id: string) =>
    api.get<ApiResponse<Bill>>(`/bills/${id}`),

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
