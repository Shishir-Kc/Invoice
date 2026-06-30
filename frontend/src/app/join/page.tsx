"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Receipt, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AxiosError } from "axios";
import { memberApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const joinSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string().min(8, "Password must be at least 8 characters"),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});

type JoinFormData = z.infer<typeof joinSchema>;

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinLoading />}>
      <JoinForm />
    </Suspense>
  );
}

function JoinLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });

  // Already signed in → go to dashboard.
  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace("/");
  }, [authLoading, isAuthenticated, router]);

  const onSubmit = async (data: JoinFormData) => {
    setServerError(null);
    if (!token) {
      setServerError("This invite link is missing a token.");
      return;
    }
    setLoading(true);
    try {
      const { data: resp } = await memberApi.join({
        token,
        name: data.name,
        email: data.email,
        password: data.password,
      });
      const { alreadyOfficial, user } = resp.data;
      const message = resp.message;
      if (alreadyOfficial) {
        // Official HYPER user — ask them to log in via HYPER instead. No
        // session cookie was set, so don't log them in here.
        setServerError(message || "Please log in via HYPER instead.");
        return;
      }
      login({
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        hyperId: user.hyperId,
      });
      router.replace("/");
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string; message?: string }>;
      const detail = axiosErr.response?.data?.detail;
      setServerError(
        (typeof detail === "string" ? detail : null) ||
          axiosErr.response?.data?.message ||
          axiosErr.message ||
          "Could not join. The invite link may be invalid.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Join Invoicely</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;ve been invited to split bills. Add your details to get access.
            </p>
          </div>
        </div>

        {!token ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive text-center">
            This invite link is invalid — it&apos;s missing a token.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Re-enter your password"
                {...register("confirm")}
              />
              {errors.confirm && (
                <p className="text-xs text-destructive">{errors.confirm.message}</p>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Joining…" : "Join & Get Access"}
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          You&apos;ll use this email + password to log back in later via the
          unofficial login page.
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Already have a HYPER account?{" "}
          <a href="/login" className="text-primary hover:underline">
            Log in via HYPER
          </a>
        </p>
      </div>
    </div>
  );
}
