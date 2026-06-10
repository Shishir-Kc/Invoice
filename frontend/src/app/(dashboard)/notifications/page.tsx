"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Bell,
  Check,
  Receipt,
  UserPlus,
  DollarSign,
  Search,
  Inbox,
} from "lucide-react";
import { formatDateShort } from "@/lib/utils";
import { useNotifications } from "@/components/notification-provider";
import type { NotificationType } from "@/types";

const notificationConfig: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  bill_added: { icon: Receipt, color: "bg-blue-500/10 text-blue-500" },
  payment_received: { icon: DollarSign, color: "bg-green-500/10 text-green-500" },
  member_joined: { icon: UserPlus, color: "bg-purple-500/10 text-purple-500" },
  bill_settled: { icon: Check, color: "bg-emerald-500/10 text-emerald-500" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(dateStr);
}

export default function NotificationsPage() {
  const [search, setSearch] = useState("");
  const { notifications, unreadCount, toggleRead, markAllRead } = useNotifications();

  const filtered = notifications.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={markAllRead}>
            <Check className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No notifications</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {search ? "Try a different search term" : "You're all caught up!"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((n) => {
                const config = notificationConfig[n.type];
                const Icon = config.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => toggleRead(n.id)}
                    className={`flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-accent/50 ${
                      !n.read ? "bg-muted/30" : ""
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium truncate ${
                            !n.read ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {n.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(n.time)}
                        </span>
                        {n.billId && (
                          <Link
                            href={`/bills/${n.billId}/view`}
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View bill
                          </Link>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={n.read ? "outline" : "default"}
                      className="shrink-0 mt-0.5"
                    >
                      {n.read ? "Read" : "New"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
