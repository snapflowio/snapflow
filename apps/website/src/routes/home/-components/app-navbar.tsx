import { UserButton } from "@snapflow/auth";
import { SidebarTrigger } from "@snapflow/ui";

export function AppNavbar() {
  return (
    <div className="flex w-full flex-row justify-between rounded-2xl px-4 py-3">
      <div>
        <SidebarTrigger className="text-muted-foreground/80 hover:bg-transparent! hover:text-foreground/80" />
      </div>
      <UserButton size={"icon"} />
    </div>
  );
}
