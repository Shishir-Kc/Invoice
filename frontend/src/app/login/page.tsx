"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleHyperLogin = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    window.location.href = "/";
    setLoading(false);
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
            <p className="text-muted-foreground text-sm">Sign in to manage your shared expenses</p>
          </div>

          <button
            onClick={handleHyperLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-4 text-base font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Login via HYPER
          </button>
        </div>
      </div>
    </div>
  );
}
