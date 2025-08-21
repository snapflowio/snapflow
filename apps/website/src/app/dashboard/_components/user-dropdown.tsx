"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { CreditCardIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Path } from "@/constants/paths";

export function UserDropdown() {
  const { user } = useAuth0();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto rounded-full p-0 hover:bg-transparent">
          <Avatar className="size-8">
            <AvatarImage width={32} height={32} alt="Profile avatar" />
            <AvatarFallback>{user?.name ? user.name[0].toUpperCase() : "!"}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-w-64 p-2" align="end">
        <DropdownMenuLabel className="mb-2 flex min-w-0 flex-col px-1 py-0">
          <span className="mb-0.5 truncate font-medium text-foreground text-sm">{user?.name}</span>
          <span className="truncate font-normal text-muted-foreground text-xs">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuItem className="gap-3 px-1">
          <CreditCardIcon size={20} className="text-muted-foreground/70" aria-hidden="true" />
          <span>Billing</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-3 px-1" onClick={() => router.push(Path.LOGOUT)}>
          <LogOutIcon size={20} className="text-muted-foreground/70" aria-hidden="true" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
