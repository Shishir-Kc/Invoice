"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, CheckCircle2, DollarSign, UserCheck, UserX, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, calculateTotalExpenses, calculateShare, calculateSettlementsFromPaid } from "@/lib/utils";
import { billApi } from "@/lib/api";
import type { Bill } from "@/types";

export default function BillViewPage() {
  const params = useParams();
  const queryClient = useQueryClient();

  const { data: res, isLoading, error } = useQuery({
    queryKey: ["bill", params.id],
    queryFn: () => billApi.get(params.id as string),
    enabled: !!params.id,
  });

  const settleMutation = useMutation({
    mutationFn: () => billApi.settle(params.id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill", params.id] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  const paidMutation = useMutation({
    mutationFn: ({ memberId, paidAmount }: { memberId: string; paidAmount: number }) =>
      billApi.togglePaid(params.id as string, memberId, paidAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill", params.id] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  const bill: Bill | undefined = res?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-foreground">Bill not found</h2>
        <p className="text-muted-foreground text-sm mt-1">
          The bill you are looking for does not exist.
        </p>
        <Link href="/bills" className="mt-4">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Bills
          </Button>
        </Link>
      </div>
    );
  }

  const total = bill.totalCost ?? calculateTotalExpenses(bill.expenses);
  const share = bill.share ?? calculateShare(total, bill.members.length);
  const settlements = calculateSettlementsFromPaid(bill.members, share);
  const memberExpenseTotals = (() => {
    const map = new Map<string, number>();
    for (const e of bill.expenses) {
      map.set(e.paidBy, (map.get(e.paidBy) ?? 0) + e.amount);
    }
    return map;
  })();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/bills">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{bill.title}</h1>
              <Badge variant={bill.status === "settled" ? "success" : "secondary"}>
                {bill.status === "settled" ? "Settled" : "Open"}
              </Badge>
            </div>
            {bill.description && (
              <p className="text-muted-foreground text-sm mt-1">{bill.description}</p>
            )}
            <p className="text-muted-foreground text-xs mt-0.5">
              Created {formatDate(bill.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bill.status === "open" && (
            <Button className="gap-1" onClick={() => settleMutation.mutate()} disabled={settleMutation.isPending}>
              <CheckCircle2 className="h-4 w-4" />
              {settleMutation.isPending ? "Settling..." : "Settle Up"}
            </Button>
          )}
          <Link href={`/bills/${bill.id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members & Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bill.members.map((member) => {
              const paidAmount = member.paidAmount ?? 0;
              const owes = member.owes ?? Math.max(0, share - paidAmount);
              const balance = paidAmount - share;
              return (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid {formatCurrency(paidAmount)}
                        {owes > 0 ? ` · owes ${formatCurrency(owes)}` : " · settled"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${balance >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {balance >= 0 ? "owed back" : "owes"}
                    </p>
                  </div>
                </div>
              );
            })}

            <Separator />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Cost</span>
              <span className="font-medium text-foreground">{formatCurrency(total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Per person</span>
              <span className="font-medium text-foreground">{formatCurrency(share)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Each member&apos;s share is {formatCurrency(bill.share ?? share)}. Record payments below.
            </p>
            {bill.members.map((member) => {
              const paid = !!member.paid;
              const paidAmount = member.paidAmount ?? 0;
              const owes = member.owes ?? Math.max(0, (bill.share ?? share) - paidAmount);
              return (
                <div key={member.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {paid ? (
                      <UserCheck className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <UserX className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid {formatCurrency(paidAmount)}
                        {owes > 0 ? ` · owes ${formatCurrency(owes)}` : " · settled"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={paidAmount || ""}
                      key={`${member.id}-${paidAmount}`}
                      onBlur={(e) => {
                        const amt = Math.max(0, Number(e.target.value) || 0);
                        if (amt !== paidAmount) {
                          paidMutation.mutate({ memberId: member.id, paidAmount: amt });
                        }
                      }}
                      className="w-24"
                      disabled={paidMutation.isPending}
                      aria-label={`${member.name} paid amount`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={paidMutation.isPending || paid}
                      onClick={() =>
                        paidMutation.mutate({
                          memberId: member.id,
                          paidAmount: bill.share ?? share,
                        })
                      }
                    >
                      Mark paid
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {bill.expenses.map((expense) => {
              const payer = bill.members.find((m) => m.id === expense.paidBy);
              const payerTotalExpenses = memberExpenseTotals.get(expense.paidBy) ?? 0;
              const paidAmount = payer?.paidAmount ?? 0;
              const isPaid = paidAmount >= payerTotalExpenses - 0.005;
              return (
                <div key={expense.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{expense.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={isPaid ? "success" : "destructive"}>
                      {isPaid ? "Paid" : "Unpaid"}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{formatCurrency(expense.amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {settlements.length > 0 && bill.status === "open" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settlements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settlements.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{s.from}</span>
                  <span className="text-muted-foreground">pays</span>
                  <span className="font-medium text-foreground">{s.to}</span>
                </div>
                <span className="font-medium text-primary">{formatCurrency(s.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
