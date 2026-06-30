"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { NotificationProvider } from "@/components/notification-provider";
import { NotificationToast } from "@/components/notification-toast";
import { type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated users to /login as a side effect,
  // never during render (which would throw "Cannot update a component
  // while rendering a different component").
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <AppSidebar />
        </Sidebar>
        <SidebarInset>
          <Header />
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
        <NotificationToast />
      </SidebarProvider>
    </AuthGuard>
  );
}
