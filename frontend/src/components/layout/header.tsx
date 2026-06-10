"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";

const breadcrumbMap: Record<string, string> = {
  "/": "Dashboard",
  "/bills": "Bills",
  "/members": "Members",
  "/settings": "Settings",
  "/notifications": "Notifications",
};

export function Header() {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  const rootPath = `/${segments[0] || ""}`;
  const rootLabel = breadcrumbMap[rootPath] || "Dashboard";

  const isSubPage = segments.length > 1;

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <div className="mr-2 h-4 w-px bg-border" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Invoicely</BreadcrumbLink>
            </BreadcrumbItem>
            {isSubPage && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={rootPath}>{rootLabel}</BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {isSubPage
                  ? segments[segments.length - 1].charAt(0).toUpperCase() + segments[segments.length - 1].slice(1)
                  : rootLabel}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
