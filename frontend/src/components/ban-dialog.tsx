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
import { Loader2 } from "lucide-react";
import { memberApi } from "@/lib/api";

type Mode = "ban" | "unban";

interface BanDialogProps {
  mode: Mode;
  memberId: string | null;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Confirmation popup shown before an official user bans or unbans a member. */
export function BanDialog({
  mode,
  memberId,
  memberName,
  open,
  onOpenChange,
}: BanDialogProps) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      mode === "ban" ? memberApi.ban(memberId!) : memberApi.unban(memberId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      onOpenChange(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        mode === "ban"
          ? "Could not ban this member."
          : "Could not unban this member.";
      setError(typeof detail === "string" ? detail : "Something went wrong.");
    },
  });

  const isBan = mode === "ban";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isBan ? "Ban" : "Unban"} {memberName}?
          </DialogTitle>
          <DialogDescription>
            {isBan
              ? "Are you sure you want to ban this member? They will lose access immediately, but their account is kept."
              : "This lifts the ban so the member can access Invoicely again. They may need to log in again."}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={isBan ? "destructive" : "default"}
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !memberId}
            className="gap-2"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isBan ? "Ban Member" : "Unban Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
