"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Trash2, Plus, ArrowLeft, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { billApi } from "@/lib/api";
import { MemberPicker } from "@/components/member-picker";
import type { Member, Expense, CreateBillInput } from "@/types";

const emptyExpense = (): Expense => ({
  id: crypto.randomUUID(),
  description: "",
  amount: 0,
  paidBy: "",
  date: new Date().toISOString().split("T")[0],
});

export default function CreateBillPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([emptyExpense()]);
  // Amount each selected member has paid toward their share (dollars). Kept as
  // a Map<memberId, amount> so MemberPicker can keep owning the members array
  // without wiping entered amounts on every change.
  const [paidAmounts, setPaidAmounts] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const selectedIds = members.map((m) => m.id);

  // Keep paidAmounts in sync with selected members: drop entries for members
  // that are no longer selected.
  const handleMembersChange = (next: Member[]) => {
    setMembers(next);
    setPaidAmounts((prev) => {
      const ids = new Set(next.map((m) => m.id));
      const filtered = new Map<string, number>();
      for (const [id, amt] of prev) if (ids.has(id)) filtered.set(id, amt);
      return filtered;
    });
  };

  const setPaidAmount = (id: string, amount: number) =>
    setPaidAmounts((prev) => {
      const next = new Map(prev);
      next.set(id, Math.max(0, amount || 0));
      return next;
    });

  const markPaid = (id: string) => setPaidAmount(id, share);

  const addExpense = () => setExpenses([...expenses, emptyExpense()]);
  const removeExpense = (id: string) => {
    if (expenses.length === 1) return;
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const updateExpense = (id: string, field: keyof Expense, value: string | number) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const share = members.length > 0 ? total / members.length : 0;

  const createMut = useMutation({
    mutationFn: (input: CreateBillInput) => billApi.create(input),
    onSuccess: () => {
      // Drop the cached bills list so the bills page refetches fresh data
      // (including the just-created bill) instead of showing stale results.
      qc.removeQueries({ queryKey: ["bills"] });
      router.push("/bills");
    },
    onError: (err) => {
      console.error("Failed to create bill", err);
      setError("Failed to create bill. Please try again.");
    },
  });

  const saving = createMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (members.length === 0) {
      setError("Select at least one member.");
      return;
    }
    setError(null);
    const input: CreateBillInput = {
      title,
      description: description || undefined,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email || "",
        paidAmount: paidAmounts.get(m.id) ?? 0,
      })),
      expenses: expenses.map((e) => ({
        description: e.description,
        amount: e.amount,
        paidBy: e.paidBy,
        date: e.date,
      })),
    };
    createMut.mutate(input);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Creating your bill…</p>
            <p className="text-xs text-muted-foreground">Hang tight, this won&apos;t take long.</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Link href="/bills">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Bill</h1>
          <p className="text-muted-foreground text-sm">Create a shared expense bill</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Domain Purchase 2025"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this bill for?"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <MemberPicker
              selectedIds={selectedIds}
              selected={members}
              onChange={handleMembersChange}
            />
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Select at least one member to split this bill.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Enter how much each member has paid toward their share (Rs {share.toFixed(2)} each).
            </p>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Select at least one member first.
              </p>
            ) : (
              <div className="rounded-md border border-border divide-y divide-border">
                {members.map((m) => {
                  const paid = paidAmounts.get(m.id) ?? 0;
                  const owes = Math.max(0, share - paid);
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Owes {formatCurrency(owes)}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paid || ""}
                        onChange={(e) => setPaidAmount(m.id, Number(e.target.value))}
                        className="w-28"
                        placeholder="0"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => markPaid(m.id)}
                      >
                        Mark paid
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Expenses</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addExpense} className="gap-1">
              <Plus className="h-3 w-3" />
              Add Expense
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {expenses.map((expense) => (
              <div key={expense.id} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={expense.description}
                    onChange={(e) => updateExpense(expense.id, "description", e.target.value)}
                    placeholder="e.g. domain.com"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expense.amount || ""}
                    onChange={(e) => updateExpense(expense.id, "amount", Number(e.target.value))}
                    className="w-28"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Paid by</Label>
                  <Select
                    value={expense.paidBy}
                    onChange={(e) => updateExpense(expense.id, "paidBy", e.target.value)}
                    placeholder={members.length === 0 ? "Select members first" : "Who paid?"}
                    options={members.map((m) => ({ value: m.id, label: m.name }))}
                    disabled={members.length === 0}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeExpense(expense.id)}
                  disabled={expenses.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="text-foreground font-medium">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Per person</span>
                  <span className="text-foreground font-medium">{formatCurrency(share)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Members</span>
                  <span>{members.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3">
          <Link href="/bills">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Creating..." : "Create Bill"}
          </Button>
        </div>
      </form>
    </div>
  );
}
