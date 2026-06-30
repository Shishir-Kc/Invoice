"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, MoreHorizontal, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { memberApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency } from "@/lib/utils";
import { InviteDialog } from "@/components/invite-dialog";
import { ExtendDialog } from "@/components/extend-dialog";
import { BanDialog } from "@/components/ban-dialog";
import type { MemberWithStats } from "@/types";

const STATUS_BADGE: Record<
  MemberWithStats["accessStatus"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  official: { label: "Official", variant: "success" },
  active: { label: "Active", variant: "secondary" },
  permanent: { label: "Permanent", variant: "secondary" },
  expired: { label: "Expired", variant: "warning" },
  banned: { label: "Banned", variant: "destructive" },
};

export default function MembersPage() {
  const { user } = useAuth();
  const isOfficial = !!user?.hyperId;
  const qc = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [extendTarget, setExtendTarget] = useState<{ id: string; name: string } | null>(null);
  const [banTarget, setBanTarget] = useState<{ id: string; name: string; mode: "ban" | "unban" } | null>(null);

  const { data: res, isLoading, error: loadError } = useQuery({
    queryKey: ["members"],
    queryFn: () => memberApi.list({ page: 1, pageSize: 100 }),
  });

  const members: MemberWithStats[] = res?.data?.data ?? [];
  const officialMembers = members.filter((m) => m.isOfficial);
  const unofficialMembers = members.filter((m) => !m.isOfficial);

  const permanentMut = useMutation({
    mutationFn: (id: string) => memberApi.permanent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });

  const handleBan = (m: MemberWithStats) => {
    setBanTarget({ id: m.id, name: m.name, mode: "ban" });
  };

  const handleUnban = (m: MemberWithStats) => {
    setBanTarget({ id: m.id, name: m.name, mode: "unban" });
  };

  const handlePermanent = (m: MemberWithStats) => {
    if (!window.confirm(`Grant ${m.name} permanent (non-expiring) access?`)) return;
    permanentMut.mutate(m.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-foreground">Failed to load members</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Please check your connection and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="text-muted-foreground text-sm">People you share bills with</p>
        </div>
        {isOfficial && (
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <ExtendDialog
        memberId={extendTarget?.id ?? null}
        memberName={extendTarget?.name ?? ""}
        open={!!extendTarget}
        onOpenChange={(o) => !o && setExtendTarget(null)}
      />
      <BanDialog
        mode={banTarget?.mode ?? "ban"}
        memberId={banTarget?.id ?? null}
        memberName={banTarget?.name ?? ""}
        open={!!banTarget}
        onOpenChange={(o) => !o && setBanTarget(null)}
      />

      {members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No members yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-6">
              {isOfficial
                ? "Generate an invite link to add members."
                : "Members will appear here once added."}
            </p>
            {isOfficial && (
              <Button onClick={() => setInviteOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Member
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Official members</h2>
                <p className="text-muted-foreground text-xs">HYPER (admin) accounts</p>
              </div>
            </div>
            {officialMembers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No official members yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {officialMembers.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    isOfficial={isOfficial}
                    onExtend={(m) => setExtendTarget({ id: m.id, name: m.name })}
                    onPermanent={handlePermanent}
                    onBan={handleBan}
                    onUnban={handleUnban}
                  />
                ))}
              </div>
            )}
          </section>

          {unofficialMembers.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Unofficial members</h2>
                  <p className="text-muted-foreground text-xs">Invited members with scoped access</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {unofficialMembers.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    isOfficial={isOfficial}
                    onExtend={(m) => setExtendTarget({ id: m.id, name: m.name })}
                    onPermanent={handlePermanent}
                    onBan={handleBan}
                    onUnban={handleUnban}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

interface MemberCardProps {
  member: MemberWithStats;
  isOfficial: boolean;
  onExtend: (m: MemberWithStats) => void;
  onPermanent: (m: MemberWithStats) => void;
  onBan: (m: MemberWithStats) => void;
  onUnban: (m: MemberWithStats) => void;
}

function MemberCard({ member, isOfficial, onExtend, onPermanent, onBan, onUnban }: MemberCardProps) {
  const status = STATUS_BADGE[member.accessStatus] ?? STATUS_BADGE.active;
  const showMenu = isOfficial && !member.isOfficial;
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
              {member.name.charAt(0)}
            </div>
            <div>
              <CardTitle className="text-sm">{member.name}</CardTitle>
              {member.email && (
                <p className="text-xs text-muted-foreground">{member.email}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant={status.variant} className="text-[10px]">
                  {status.label}
                </Badge>
                {!member.isOfficial && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {member.group ?? "unofficial"}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {member.billCount} bill{member.billCount === 1 ? "" : "s"}
                </span>
                {member.totalPaid > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    · paid {formatCurrency(member.totalPaid)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {showMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="h-8 w-8" />
                }
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Manage access</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onExtend(member)}>
                    Extend…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPermanent(member)}>
                    Make permanent
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onBan(member)}
                >
                  Ban
                </DropdownMenuItem>
                {member.accessStatus === "banned" && (
                  <DropdownMenuItem onClick={() => onUnban(member)}>
                    Unban
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
