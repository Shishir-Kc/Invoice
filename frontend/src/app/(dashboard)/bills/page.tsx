"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Receipt, MoreHorizontal, Eye, Users } from "lucide-react";
import { formatCurrency, calculateTotalExpenses } from "@/lib/utils";
import { mockBills } from "@/lib/mock-data";

export default function BillsPage() {
  const [search, setSearch] = useState("");
  const bills = mockBills;

  const filteredBills = bills.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bills</h1>
          <p className="text-muted-foreground text-sm">Track shared expenses and split costs</p>
        </div>
        <Link href="/bills/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Bill
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search bills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredBills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Receipt className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No bills yet</h3>
              <p className="text-muted-foreground text-sm mt-1 mb-6">
                Create a bill to start tracking shared expenses
              </p>
              <Link href="/bills/create">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Bill
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredBills.map((bill) => {
                const total = calculateTotalExpenses(bill.expenses);
                return (
                  <div key={bill.id} className="flex items-center justify-between px-6 py-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <Link href={`/bills/${bill.id}/view`} className="font-medium text-foreground hover:text-primary">
                          {bill.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{bill.members.length} members</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium text-foreground">{formatCurrency(total)}</div>
                        <Badge variant={bill.status === "settled" ? "success" : "secondary"}>
                          {bill.status === "settled" ? "Settled" : "Open"}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Link href={`/bills/${bill.id}/view`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
