"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Notification, NotificationType } from "@/types";
import { mockNotifications, mockMembers, mockBills } from "@/lib/mock-data";

const descriptions: Record<NotificationType, string[]> = {
  bill_added: [
    `${mockMembers[1].name} created a new bill — ${mockBills[0].title}`,
    `${mockMembers[2].name} added ${mockBills[2].title} to the group`,
    `New expense "${mockBills[1].title}" needs your review`,
  ],
  payment_received: [
    `${mockMembers[1].name} sent you a payment`,
    `${mockMembers[2].name} paid their share`,
    `${mockMembers[3].name} settled up for ${mockBills[0].title}`,
  ],
  member_joined: [
    `${mockMembers[1].name} joined the group`,
    `${mockMembers[2].name} is now a member`,
    `${mockMembers[3].name} has been added by an admin`,
  ],
  bill_settled: [
    `${mockBills[0].title} has been fully settled`,
    `${mockBills[2].title} is now closed`,
    `All balances cleared for ${mockBills[4].title}`,
  ],
};

const liveTitles: Record<NotificationType, string> = {
  bill_added: "New Bill",
  payment_received: "Payment Received",
  member_joined: "Member Joined",
  bill_settled: "Bill Settled",
};

let liveId = 100;

function generateLiveNotification(): Notification {
  const types: NotificationType[] = ["bill_added", "payment_received", "member_joined", "bill_settled"];
  const type = types[Math.floor(Math.random() * types.length)];
  const pool = descriptions[type];
  const description = pool[Math.floor(Math.random() * pool.length)];
  return {
    id: `live-${liveId++}`,
    type,
    title: liveTitles[type],
    description,
    time: new Date().toISOString(),
    read: false,
  };
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  latestNotification: Notification | null;
  clearLatest: () => void;
  toggleRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const n = generateLiveNotification();
      setNotifications((prev) => [n, ...prev]);
      setLatestNotification(n);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const clearLatest = useCallback(() => setLatestNotification(null), []);

  const toggleRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        latestNotification,
        clearLatest,
        toggleRead,
        markAllRead,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
