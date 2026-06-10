import { Providers, DashboardShell } from "@/components/providers";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <DashboardShell>
        {children}
      </DashboardShell>
    </Providers>
  );
}
