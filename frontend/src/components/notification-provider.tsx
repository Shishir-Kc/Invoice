"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import type { Notification } from "@/types";

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
  const qc = useQueryClient();
  const { token, isAuthenticated } = useAuth();

  // Poll the backend notification feed. The list comes back ordered by
  // created_at desc, so notifications[0] is the newest. Only fetch when
  // authenticated — this avoids firing (and 401-ing) on public pages like
  // /login and /join, which would otherwise trigger the axios 401 redirect.
  const { data: res } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationApi.list(),
    enabled: !!token && isAuthenticated,
    refetchInterval: !!token && isAuthenticated ? 15_000 : false,
    refetchOnWindowFocus: true,
  });

  const notifications: Notification[] = useMemo(
    () => res?.data?.data ?? [],
    [res],
  );

  // Surface a toast only for notifications that arrive *after* mount —
  // existing ones on first load are not toasted.
  const seenIdRef = useRef<string | null>(null);
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);

  useEffect(() => {
    if (notifications.length === 0) return;
    const newest = notifications[0];
    if (seenIdRef.current === null) {
      seenIdRef.current = newest.id;
      return;
    }
    if (newest.id !== seenIdRef.current) {
      seenIdRef.current = newest.id;
      setLatestNotification(newest);
    }
  }, [notifications]);

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    [qc],
  );

  const updateMut = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      notificationApi.update(id, read),
    onSuccess: invalidate,
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: invalidate,
  });

  const clearAllMut = useMutation({
    mutationFn: () => notificationApi.clearAll(),
    onSuccess: invalidate,
  });

  const clearLatest = useCallback(() => setLatestNotification(null), []);

  const toggleRead = useCallback(
    (id: string) => {
      const current = notifications.find((n) => n.id === id);
      updateMut.mutate({ id, read: !current?.read });
    },
    [notifications, updateMut],
  );

  const markAllRead = useCallback(() => markAllMut.mutate(), [markAllMut]);
  const clearAll = useCallback(() => clearAllMut.mutate(), [clearAllMut]);

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
