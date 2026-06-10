"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Trash2, Plus, ArrowLeft, UserPlus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { mockBills } from "@/lib/mock-data";
import type { Member, Expense } from "@/types";

const emptyMember = (): Member => ({
  id: crypto.randomUUID(),
  name: "",
  email: "",
});

const emptyExpense = (): Expense => ({
  id: crypto.randomUUID(),
  description: "",
  amount: 0,
  paidBy: "",
  date: new Date().toISOString().split("T")[0],
});

export default function EditBillPage() {
  const params = useParams();
  const router = useRouter();
  const existing = mockBills.find((b) => b.id === params.id);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [members, setMembers] = useState<Member[]>(
    existing?.members ?? [emptyMember()]
  );
  const [expenses, setExpenses] = useState<Expense[]>(
    existing?.expenses ?? [emptyExpense()]
  );
  const [saving, setSaving] = useState(false);

  const addMember = () => setMembers([...members, emptyMember()]);
  const removeMember = (id: string) => {
    if (members.length === 1) return;
    setMembers(members.filter((m) => m.id !== id));
  };

  const updateMember = (id: string, field: keyof Member, value: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    router.push("/bills");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/bills">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Bill</h1>
          <p className="text-muted-foreground text-sm">Update bill details</p>
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
              <Label htmlFor="description">Description</Label>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Members</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addMember} className="gap-1">
              <UserPlus className="h-3 w-3" />
              Add Member
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((member, idx) => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary shrink-0">
                  {member.name ? member.name.charAt(0).toUpperCase() : idx + 1}
                </div>
                <Input
                  value={member.name}
                  onChange={(e) => updateMember(member.id, "name", e.target.value)}
                  placeholder="Member name"
                  className="flex-1"
                  required
                />
                <Input
                  value={member.email || ""}
                  onChange={(e) => updateMember(member.id, "email", e.target.value)}
                  placeholder="Email (optional)"
                  type="email"
                  className="flex-1 hidden sm:block"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removeMember(member.id)}
                  disabled={members.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
                    placeholder="Who paid?"
                    options={members.map((m) => ({ value: m.id, label: m.name || "Unnamed" }))}
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
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-foreground font-medium">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Per person</span>
                  <span className="text-foreground font-medium">{formatCurrency(share)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/bills">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Update Bill"}
          </Button>
        </div>
      </form>
    </div>
  );
}
