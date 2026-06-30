"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, DollarSign, Users, CheckCircle2, TrendingUp, ArrowUpRight, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { billApi } from "@/lib/api";
import { calculateTotalExpenses } from "@/lib/utils";
import { format, subMonths, isSameMonth } from "date-fns";
import type { Bill } from "@/types";

export default function DashboardPage() {
  const { data: res, isLoading, error } = useQuery({
    queryKey: ["bills", "dashboard"],
    queryFn: () => billApi.list({ page: 1, pageSize: 100 }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-foreground">Failed to load data</h2>
        <p className="text-muted-foreground text-sm mt-1">Please check your connection and try again.</p>
      </div>
    );
  }

  const bills: Bill[] = res?.data?.data ?? [];
  const totalBills = bills.length;
  const totalSpent = bills.reduce((sum: number, b) => sum + calculateTotalExpenses(b.expenses), 0);
  const settledBills = bills.filter((b) => b.status === "settled").length;
  const memberSet = new Set(bills.flatMap((b: Bill) => b.members.map((m) => m.id)));

  const stats = [
    { label: "Total Bills", value: String(totalBills), icon: Receipt, change: `${totalBills} total`, color: "text-blue-500" },
    { label: "Total Spent", value: `NPR ${totalSpent.toFixed(2)}`, icon: DollarSign, change: `NPR ${totalSpent.toFixed(2)} overall`, color: "text-green-500" },
    { label: "Members", value: String(memberSet.size), icon: Users, change: "across all bills", color: "text-purple-500" },
    { label: "Settled Bills", value: String(settledBills), icon: CheckCircle2, change: `${totalBills > 0 ? Math.round((settledBills / totalBills) * 100) : 0}% settled`, color: "text-emerald-500" },
  ];

  // Real per-month spending over the last 6 months, aggregated from bill
  // expense dates (no hardcoded placeholder months/zeros).
  const now = new Date();
  const spendingData = Array.from({ length: 6 }, (_, i) => {
    const monthDate = subMonths(now, 5 - i);
    const amount = bills.reduce((sum: number, b: Bill) => {
      const monthTotal = b.expenses
        .filter((e) => {
          const d = e.date ? new Date(e.date) : null;
          return d != null && isSameMonth(d, monthDate);
        })
        .reduce((s, e) => s + e.amount, 0);
      return sum + monthTotal;
    }, 0);
    return { month: format(monthDate, "MMM"), amount };
  });

  const chartTotal = spendingData.reduce((sum, d) => sum + d.amount, 0);

  const recentBills = bills
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Track shared expenses and split bills.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Bills</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentBills.map((bill) => {
                const total = calculateTotalExpenses(bill.expenses);
                return (
                  <Link
                    key={bill.id}
                    href={`/bills/${bill.id}/view`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                        <Receipt className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{bill.title}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(bill.createdAt), "MMM d")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">NPR {total.toFixed(2)}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Spending Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartTotal === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">No spending data yet</p>
                <p className="text-muted-foreground/50 text-xs mt-1">
                  Spending chart will appear here as you add bills
                </p>
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={spendingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="month" stroke="#ffffff" strokeOpacity={0.5} tickLine={false} axisLine={false} dy={8} fontSize={12} />
                    <YAxis stroke="#ffffff" strokeOpacity={0.5} tickLine={false} axisLine={false} tickFormatter={(v) => `NPR ${v}`} fontSize={12} />
                    <Tooltip
                      cursor={{ stroke: "#ffffff", strokeWidth: 1, strokeDasharray: "4 4", strokeOpacity: 0.3 }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(0,0,0,0.8)",
                        color: "#fff",
                      }}
                      formatter={(value) => [`NPR ${Number(value ?? 0).toFixed(2)}`, "Spent"]}
                      labelStyle={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#ffffff"
                      strokeWidth={2}
                      fill="url(#spendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
