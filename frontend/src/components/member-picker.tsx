"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Search, UserPlus, X } from "lucide-react";
import { memberApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import type { Member, MemberWithStats, BillGroup } from "@/types";

interface MemberPickerProps {
  /** ids of members currently selected for this bill */
  selectedIds: string[];
  /** full selected member objects (so callers keep name/email for submission) */
  selected: Member[];
  onChange: (selected: Member[]) => void;
}

/**
 * Pick bill members from the real members directory via checkboxes, with an
 * inline "add a new member" form for people not yet in the directory.
 *
 * Selection is tracked as an ordered list of Member objects so the parent can
 * submit them directly. Toggling preserves the original selection order.
 */
export function MemberPicker({ selectedIds, selected, onChange }: MemberPickerProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isOfficial = !!user?.hyperId;
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newGroup, setNewGroup] = useState<BillGroup>("unofficial");
  const [addError, setAddError] = useState<string | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ["members", "picker"],
    queryFn: () => memberApi.list({ page: 1, pageSize: 100 }),
  });
  const allMembers: MemberWithStats[] = res?.data?.data ?? [];

  const addMut = useMutation({
    mutationFn: () =>
      memberApi.create({ name: newName.trim(), email: newEmail.trim(), group: newGroup }),
    onSuccess: (resp) => {
      const created = resp.data?.data;
      qc.invalidateQueries({ queryKey: ["members"] });
      if (created) {
        // Auto-select the newly created member.
        if (!selectedIds.includes(created.id)) {
          onChange([...selected, created]);
        }
      }
      setNewName("");
      setNewEmail("");
      setAddError(null);
      setShowAdd(false);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Could not add member. Please try again.";
      setAddError(typeof detail === "string" ? detail : "Could not add member.");
    },
  });

  const toggle = (m: MemberWithStats) => {
    if (selectedIds.includes(m.id)) {
      onChange(selected.filter((s) => s.id !== m.id));
    } else {
      onChange([...selected, { id: m.id, name: m.name, email: m.email }]);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      setAddError("Name and email are required.");
      return;
    }
    addMut.mutate();
  };

  const q = search.trim().toLowerCase();
  // Banned members lose access and must not be added to new bills.
  const eligible = allMembers.filter((m) => m.accessStatus !== "banned");
  const filtered = q
    ? eligible.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q),
      )
    : eligible;

  return (
    <div className="space-y-3">
      {/* Selected members chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {m.name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s.id !== m.id))}
                className="rounded-full hover:bg-primary/20 p-0.5"
                aria-label={`Remove ${m.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search + add-new toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isOfficial && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 shrink-0"
            onClick={() => setShowAdd((v) => !v)}
          >
            <UserPlus className="h-3 w-3" />
            New Member
          </Button>
        )}
      </div>

      {isOfficial && showAdd && (
        <form
          onSubmit={handleAdd}
          className="rounded-md border border-border p-3 space-y-3 bg-muted/30"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-member-name" className="text-xs">
                Name
              </Label>
              <Input
                id="new-member-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Member name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-member-email" className="text-xs">
                Email
              </Label>
              <Input
                id="new-member-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="member@email.com"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-member-group" className="text-xs">
              Group
            </Label>
            <Select
              id="new-member-group"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value as BillGroup)}
              options={[
                { value: "hyper", label: "Hyper — sees all bills created by officials" },
                { value: "unofficial", label: "Unofficial — sees bills with unofficial members" },
                { value: "private", label: "Private — sees only bills assigned to them" },
              ]}
            />
          </div>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={addMut.isPending} className="gap-1">
              {addMut.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Add &amp; Select
            </Button>
          </div>
        </form>
      )}

      {/* Member list with checkboxes */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {search
              ? "No members match your search."
              : "No members yet. Add one with \"New Member\"."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border divide-y divide-border max-h-64 overflow-y-auto">
          {filtered.map((m) => {
            const checked = selectedIds.includes(m.id);
            return (
              <label
                key={m.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(m)}
                  aria-label={`Select ${m.name}`}
                />
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {m.name}
                  </p>
                  {m.email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {m.email}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {m.billCount} bill{m.billCount === 1 ? "" : "s"}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
