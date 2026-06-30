"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { memberApi } from "@/lib/api";
import type { DurationUnit } from "@/types";

const UNITS: { value: DurationUnit; label: string }[] = [
  { value: "hour", label: "Hours" },
  { value: "day", label: "Days" },
  { value: "week", label: "Weeks" },
  { value: "year", label: "Years" },
];

interface ExtendDialogProps {
  memberId: string | null;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Dialog to extend an unofficial member's access by a chosen duration. */
export function ExtendDialog({
  memberId,
  memberName,
  open,
  onOpenChange,
}: ExtendDialogProps) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState<DurationUnit>("day");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => memberApi.extend(memberId!, { amount, unit }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      onOpenChange(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Could not extend access.";
      setError(typeof detail === "string" ? detail : "Could not extend access.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend access — {memberName}</DialogTitle>
          <DialogDescription>
            Add more time to this member&apos;s access. Banned members are reactivated.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="ext-amount" className="text-xs">Amount</Label>
            <Input
              id="ext-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ext-unit" className="text-xs">Unit</Label>
            <Select
              id="ext-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as DurationUnit)}
              options={UNITS.map((u) => ({ value: u.value, label: u.label }))}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !memberId}
            className="gap-2"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Extend Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
