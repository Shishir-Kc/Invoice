"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  UserX,
  KeyRound,
  WifiOff,
  X,
} from "lucide-react";

export type AuthErrorCode =
  | "invalid_email"
  | "invalid_credentials"
  | "password_required"
  | "hyper_unreachable"
  | "hyper_error";

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

const config: Record<
  AuthErrorCode,
  { icon: typeof AlertCircle; title: string; border: string; iconColor: string; bg: string }
> = {
  invalid_email: {
    icon: AlertCircle,
    title: "Invalid Email",
    border: "border-amber-500/40",
    iconColor: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  invalid_credentials: {
    icon: UserX,
    title: "Account Not Found",
    border: "border-red-500/40",
    iconColor: "text-red-500",
    bg: "bg-red-500/10",
  },
  password_required: {
    icon: KeyRound,
    title: "Password Required",
    border: "border-amber-500/40",
    iconColor: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  hyper_unreachable: {
    icon: WifiOff,
    title: "Connection Error",
    border: "border-red-500/40",
    iconColor: "text-red-500",
    bg: "bg-red-500/10",
  },
  hyper_error: {
    icon: AlertTriangle,
    title: "Login Failed",
    border: "border-red-500/40",
    iconColor: "text-red-500",
    bg: "bg-red-500/10",
  },
};

interface AuthErrorNotificationProps {
  error: AuthError | null;
  onDismiss: () => void;
  /** Auto-dismiss after this many ms. 0 = never. Default 6000. */
  duration?: number;
}

export function AuthErrorNotification({
  error,
  onDismiss,
  duration = 6000,
}: AuthErrorNotificationProps) {
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    // Wait for the fade-out transition before clearing from the parent.
    setTimeout(onDismiss, 250);
  }, [onDismiss]);

  // Enter animation whenever a new error arrives.
  useEffect(() => {
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, [error]);

  // Auto-dismiss timer.
  useEffect(() => {
    if (!error || duration <= 0) return;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [error, duration, dismiss]);

  if (!error) return null;

  const cfg = config[error.code] ?? config.hyper_error;
  const Icon = cfg.icon;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex items-start gap-3 rounded-lg border ${cfg.border} ${cfg.bg} p-4 shadow-lg transition-all duration-250 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      <div className={`shrink-0 mt-0.5 ${cfg.iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{cfg.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
