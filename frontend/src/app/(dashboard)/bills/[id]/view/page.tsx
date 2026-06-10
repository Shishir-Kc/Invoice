"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, CheckCircle2, DollarSign, UserCheck, UserX } from "lucide-react";
import { formatCurrency, formatDate, calculateTotalExpenses, calculateShare, calculateMemberBalance, calculateSettlements } from "@/lib/utils";
import { mockBills } from "@/lib/mock-data";

export default function BillViewPage() {
  const params = useParams();
  const router = useRouter();
  const bill = mockBills.find((b) => b.id === params.id);

  if (!bill) {
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

  const total = calculateTotalExpenses(bill.expenses);
  const share = calculateShare(total, bill.members.length);
  const settlements = calculateSettlements(bill.members, bill.expenses, total);

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
            <Button className="gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Settle Up
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
              const balance = calculateMemberBalance(member.id, bill.expenses, share);
              return (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid {formatCurrency(
                          bill.expenses
                            .filter((e) => e.paidBy === member.id)
                            .reduce((s, e) => s + e.amount, 0)
                        )}
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
              <span className="text-muted-foreground">Total spent</span>
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
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bill.members.map((member) => {
              const hasPaid = bill.expenses.some((e) => e.paidBy === member.id);
              const memberTotal = bill.expenses
                .filter((e) => e.paidBy === member.id)
                .reduce((s, e) => s + e.amount, 0);
              return (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {hasPaid ? (
                      <UserCheck className="h-4 w-4 text-green-500" />
                    ) : (
                      <UserX className="h-4 w-4 text-red-400" />
                    )}
                    <span className="text-sm text-foreground">{member.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {hasPaid ? formatCurrency(memberTotal) : "Hasn't paid"}
                  </span>
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
              return (
                <div key={expense.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid by {payer?.name || "Unknown"} &middot; {formatDate(expense.date)}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-foreground">{formatCurrency(expense.amount)}</span>
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
