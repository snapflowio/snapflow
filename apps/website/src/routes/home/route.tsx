import { RedirectToSignIn, SignedIn } from "@snapflow/auth";
import { SidebarInset, SidebarProvider } from "@snapflow/ui";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { AppNavbar } from "./-components/app-navbar";
import { AppSidebar } from "./-components/app-sidebar";

export const Route = createFileRoute("/home")({
  component: HomeLayout,
});

function HomeLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      <RedirectToSignIn />
      <SignedIn>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="p-2.5">
            <div className="flex flex-1 flex-col gap-4 rounded-3xl border">
              <AppNavbar />
              <div className="p-6 pt-2">
                <Outlet />
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </SignedIn>
    </>
  );
}
