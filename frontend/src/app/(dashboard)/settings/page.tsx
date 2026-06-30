"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, User, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { settingsApi } from "@/lib/api";

const DEFAULT_CURRENCY = "NPR";

export default function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: res, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const savedCurrency = res?.data?.data?.defaultCurrency ?? DEFAULT_CURRENCY;

  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [saved, setSaved] = useState(false);

  // Sync the local input once the server value loads.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrency(savedCurrency);
  }, [savedCurrency]);

  const saveMut = useMutation({
    mutationFn: () => settingsApi.update({ defaultCurrency: currency.toUpperCase() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currency.trim()) return;
    saveMut.mutate();
  };

  return (
    <div className="flex flex-col items-center">
      <div className="space-y-6 max-w-3xl w-full">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 w-full">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Profile</CardTitle>
                  <CardDescription>
                    Managed by your HYPER account — read-only here
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={user?.name ?? ""}
                    readOnly
                    placeholder="Not available"
                    className="opacity-70"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email ?? ""}
                    readOnly
                    placeholder="Not available"
                    className="opacity-70"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferences</CardTitle>
              <CardDescription>Default values for new bills</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  placeholder={DEFAULT_CURRENCY}
                  maxLength={3}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-emerald-500">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
            <Button
              type="submit"
              disabled={saveMut.isPending || isLoading}
              className="gap-2"
            >
              {saveMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Settings
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
