import { useEffect, useRef, useState } from "react";
import { OrganizationRolePermissionsEnum } from "@snapflow/api-client/src";
import { Link, Outlet, useLocation } from "react-router";
import { Logo } from "@/components/logo";
import { cn, isRouteActive } from "@/lib/util";
import { Path } from "@/enums/paths";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { Container } from "./components/container";
import { OrganizationSwitcher } from "./components/organization-switcher";
import UserDropdown from "./components/user-dropdown";

type SectionProps = {
  title: string;
  url: string;
};

function Section({ title, url }: SectionProps) {
  const currentPathname = location.pathname;

  const isActive = isRouteActive(url, currentPathname);
  return (
    <Link
      key={title}
      to={url}
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

export function DashboardLayout() {
  const [showVerifyEmailDialog, setShowVerifyEmailDialog] = useState(false);
  const {
    selectedOrganization,
    authenticatedUserOrganizationMember,
    authenticatedUserHasPermission,
  } = useSelectedOrganization();
  const location = useLocation();
  const currentPathname = location.pathname;
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
      <div className="bg-green-400 px-4 py-2 text-center font-medium text-black text-sm">
        🎁 Use voucher code "BETALAUNCH" to get an extra 24 hours of sandbox runtime!
      </div>
      <header className="mx-4 bg-background">
        <div className="border-[#1a1a1a]">
          <div className="mt-3 flex h-10 items-center space-x-2 px-4">
            <Logo size={22} />
            <div className="flex items-center gap-2">
              <OrganizationSwitcher />
            </div>
            <div className="ml-auto flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <span>Runtime remaining: 26 hours</span>
              </div>
              <UserDropdown />
            </div>
          </div>
        </div>
        <div className="border-[#1a1a1a] border-b">
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
              className="absolute bottom-0 h-0.5 bg-[#00ff88] transition-all duration-300 ease-out"
              style={{ left: underlineStyle.left, width: underlineStyle.width }}
            />
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Container>
          <Outlet />
        </Container>
      </main>
    </div>
  );
}
