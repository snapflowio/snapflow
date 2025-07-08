import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { Container } from "./components/container";
import { AppSidebar } from "./components/sidebar/dashboard-sidebar";

export function DashboardLayout() {
  const [showVerifyEmailDialog, setShowVerifyEmailDialog] = useState(false);
  const { selectedOrganization } = useSelectedOrganization();

  useEffect(() => {
    if (
      selectedOrganization?.suspended &&
      selectedOrganization.suspensionReason === "Please verify your email address"
    ) {
      setShowVerifyEmailDialog(true);
    }
  }, [selectedOrganization]);

  return (
    <div className="relative w-full">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="group/sidebar-inset bg-sidebar">
          <header className="dark before:-left-px relative flex h-16 shrink-0 items-center gap-2 bg-sidebar px-4 text-sidebar-foreground before:absolute before:inset-y-3 before:z-50 before:w-px before:bg-gradient-to-b before:from-white/5 before:via-white/15 before:to-white/5 md:px-6 lg:px-8">
            <SidebarTrigger className="-ms-2" />
          </header>
          <div className="flex h-[calc(100svh-4rem)] bg-[#0a0a0b] transition-all duration-300 ease-in-out md:rounded-s-3xl md:group-peer-data-[state=collapsed]/sidebar-inset:rounded-s-none">
            <Container>
              <Outlet />
            </Container>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
