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
import { Loader2, Copy, Check, Link as LinkIcon } from "lucide-react";
import { memberApi } from "@/lib/api";
import type { DurationUnit, InviteResult, BillGroup } from "@/types";

const UNITS: { value: DurationUnit; label: string }[] = [
  { value: "hour", label: "Hours" },
  { value: "day", label: "Days" },
  { value: "week", label: "Weeks" },
  { value: "year", label: "Years" },
];

const GROUPS: { value: BillGroup; label: string }[] = [
  { value: "hyper", label: "Hyper — sees all bills created by officials" },
  { value: "unofficial", label: "Unofficial — sees bills with unofficial members" },
  { value: "private", label: "Private — sees only bills assigned to them" },
];

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Add Member" dialog: generate an invite link with an access expiry. */
export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(7);
  const [unit, setUnit] = useState<DurationUnit>("day");
  const [group, setGroup] = useState<BillGroup>("unofficial");
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const mut = useMutation({
    mutationFn: () => memberApi.invite({ amount, unit, group }),
    onSuccess: (resp) => {
      setInvite(resp.data.data);
      setError(null);
      setCopied(false);
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Could not generate invite link.";
      setError(typeof detail === "string" ? detail : "Could not generate invite link.");
    },
  });

  const reset = () => {
    setInvite(null);
    setError(null);
    setCopied(false);
  };

  const close = (open: boolean) => {
    onOpenChange(open);
    if (!open) reset();
  };

  const copyLink = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable; ignore
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>
            Generate a join link. Anyone who joins via the link gets access to
            Invoicely for the duration you choose.
          </DialogDescription>
        </DialogHeader>

        {!invite ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="inv-amount" className="text-xs">
                  Access duration
                </Label>
                <Input
                  id="inv-amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inv-unit" className="text-xs">
                  Unit
                </Label>
                <Select
                  id="inv-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as DurationUnit)}
                  options={UNITS.map((u) => ({ value: u.value, label: u.label }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-group" className="text-xs">
                Group
              </Label>
              <Select
                id="inv-group"
                value={group}
                onChange={(e) => setGroup(e.target.value as BillGroup)}
                options={GROUPS.map((g) => ({ value: g.value, label: g.label }))}
              />
              <p className="text-xs text-muted-foreground">
                Controls which bills this member can see once they join.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              After the duration expires, the member loses access until you extend
              or make them permanent.
            </p>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
                className="gap-2"
              >
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate Link
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share this link with the person you want to invite:
              </p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  readOnly
                  value={invite.link}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none truncate"
                  onFocus={(e) => e.target.select()}
                />
                <Button size="sm" variant="outline" onClick={copyLink} className="gap-1 shrink-0">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Members who join via this link will appear in your members list and
                can be banned, extended, or made permanent later.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset} className="gap-1">
                Generate Another
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
