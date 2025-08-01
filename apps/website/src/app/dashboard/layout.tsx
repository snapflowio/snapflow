"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { OrganizationRolePermissionsEnum } from "@snapflow/api-client/src";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loading } from "@/components/loading";
import { Logo } from "@/components/logo";
import { cn, isRouteActive } from "@/lib/util";
import { Path } from "@/constants/paths";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { ApiProvider } from "@/providers/api-provider";
import { OrganizationsProvider } from "@/providers/organization-provider";
import { RealtimeProvider } from "@/providers/realtime-provider";
import { SelectedOrganizationProvider } from "@/providers/selected-organization-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { OrganizationSwitcher } from "./_components/organization-switcher";
import UserDropdown from "./_components/user-dropdown";

type SectionProps = {
  title: string;
  url: string;
};

function Section({ title, url }: SectionProps) {
  const currentPathname = usePathname();

  const isActive = isRouteActive(url, currentPathname);
  return (
    <Link
      key={title}
      href={url}
      data-active={isActive}
      className={cn(
        "mx-4 flex h-full items-center text-sm transition-colors",
        isActive ? "text-white" : "text-gray-400 hover:text-gray-200"
      )}
    >
      {title}
    </Link>
  );
}

function DashboardNavigation({ children }: { children: React.ReactNode }) {
  const [_, setShowVerifyEmailDialog] = useState(false);
  const { selectedOrganization, authenticatedUserHasPermission } = useSelectedOrganization();
  const currentPathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (
      selectedOrganization?.suspended &&
      selectedOrganization.suspensionReason === "Please verify your email address"
    ) {
      setShowVerifyEmailDialog(true);
    }
  }, [selectedOrganization]);

  useEffect(() => {
    if (!navRef.current) return;

    const activeLink = navRef.current.querySelector('[data-active="true"]');
    if (activeLink) {
      const navRect = navRef.current.getBoundingClientRect();
      const textElement = activeLink.querySelector("span") || activeLink;
      const textRect = textElement.getBoundingClientRect();

      setUnderlineStyle({
        left: textRect.left - navRect.left,
        width: textRect.width,
      });
    }
  }, [currentPathname]);

  return (
    <div className="min-h-screen">
      <header className="bg-background">
        <div className="flex h-10 items-center space-x-2 px-4 pt-4">
          <Logo size={22} />
          <div className="flex items-center gap-2">
            <OrganizationSwitcher />
          </div>
          <div className="ml-auto flex items-center gap-6 text-sm">
            <UserDropdown />
          </div>
        </div>
        <div className="mt-2 border-[#272A2E] border-b">
          <nav className="relative hidden h-12 items-center md:flex" ref={navRef}>
            <Section title="Dashboard" url={Path.DASHBOARD} />
            {!selectedOrganization?.personal && <Section title="Members" url={Path.MEMBERS} />}
            <Section title="Sandboxes" url={Path.SANDBOXES} />
            <Section title="Images" url={Path.IMAGES} />
            {authenticatedUserHasPermission(OrganizationRolePermissionsEnum.READ_BUCKETS) && (
              <Section title="Buckets" url={Path.BUCKETS} />
            )}
            <Section title="API Keys" url={Path.API_KEYS} />
            <Section title="Settings" url={Path.SETTINGS} />
            <div
              className="absolute bottom-0 h-0.5 bg-primary transition-all duration-300 ease-out"
              style={{ left: underlineStyle.left, width: underlineStyle.width }}
            />
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="w-full p-8">{children}</div>
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <ApiProvider>
        <RealtimeProvider>
          <OrganizationsProvider>
            <SelectedOrganizationProvider>
              <DashboardNavigation>{children}</DashboardNavigation>
              <ToastProvider richColors={false} />
            </SelectedOrganizationProvider>
          </OrganizationsProvider>
        </RealtimeProvider>
      </ApiProvider>
    </Suspense>
  );
}
