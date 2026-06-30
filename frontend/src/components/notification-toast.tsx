"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notification-provider";
import { Bell, Receipt, Check, UserPlus, DollarSign, X } from "lucide-react";
import type { NotificationType } from "@/types";

const config: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  bill_added: { icon: Receipt, color: "text-blue-500" },
  payment_received: { icon: DollarSign, color: "text-green-500" },
  member_joined: { icon: UserPlus, color: "text-purple-500" },
  bill_settled: { icon: Check, color: "text-emerald-500" },
};

export function NotificationToast() {
  const { latestNotification, clearLatest } = useNotifications();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [item, setItem] = useState<typeof latestNotification>(null);

  useEffect(() => {
    if (latestNotification) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItem(latestNotification);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => clearLatest(), 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [latestNotification, clearLatest]);

  if (!item) return null;

  const Icon = config[item.type].icon;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setVisible(false);
          setTimeout(() => clearLatest(), 300);
          router.push("/notifications");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setVisible(false);
            setTimeout(() => clearLatest(), 300);
            router.push("/notifications");
          }
        }}
        className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-lg text-left hover:bg-accent/50 transition-colors cursor-pointer"
      >
        <div className={`shrink-0 mt-0.5 ${config[item.type].color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
            setTimeout(() => clearLatest(), 300);
          }}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
