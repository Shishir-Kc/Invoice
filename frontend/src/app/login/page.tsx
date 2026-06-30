"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  AuthErrorNotification,
  type AuthError,
  type AuthErrorCode,
} from "@/components/auth-error-notification";
import { AxiosError } from "axios";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface BackendErrorDetail {
  code?: AuthErrorCode;
  message?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<AuthError | null>(null);

  // If already signed in, skip the login screen.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    setLoading(true);
    try {
      const { data: resp } = await authApi.login(data.email, data.password);
      const { token, user } = resp.data;
      login(token, {
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        hyperId: user.hyperId,
      });
      router.replace("/");
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: BackendErrorDetail; message?: string }>;
      const detail = axiosErr.response?.data?.detail;

      // Structured HYPER error from our backend: { code, message }
      if (detail && typeof detail === "object" && detail.code) {
        setAuthError({
          code: detail.code,
          message: detail.message || "Login failed.",
        });
      } else if (detail && typeof detail === "object" && detail.message) {
        setAuthError({ code: "hyper_error", message: detail.message });
      } else if (detail && typeof detail === "string") {
        setAuthError({ code: "hyper_error", message: detail });
      } else {
        setAuthError({
          code: "hyper_error",
          message:
            axiosErr.response?.data?.message ||
            axiosErr.message ||
            "Login failed. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left — Branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between bg-black p-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-white">Invoicely</span>
        </div>

        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Expense tracker for <span style={{ color: "#8114d1" }}>ARCADEMIA</span>
          </h1>
          <p className="text-lg text-white/60 leading-relaxed">
            Tracking money spent and revenue generated.
          </p>
        </div>

        <p className="text-sm text-white/20">&copy; 2026 Invoicely. All rights reserved.</p>
      </div>

      {/* Right — Login */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-semibold text-foreground">Invoicely</span>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in with your HYPER account to manage your shared expenses</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <AuthErrorNotification
              error={authError}
              onDismiss={() => setAuthError(null)}
            />

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password")}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              )}
              {loading ? "Signing in…" : "Login via HYPER"}
            </button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <a
              href="/login/unofficial"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent"
            >
              Unofficial
            </a>
            <p className="text-center text-xs text-muted-foreground">
              Invited member? Use the unofficial login.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
