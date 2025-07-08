"use client";

import { useEffect, useMemo, useState } from "react";
import { Organization } from "@snapflow/api-client/src";
import { BuildingIcon, ChevronsUpDownIcon, PlusIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { CreateOrganizationDialog } from "@/components/dialogs/create-organization-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { handleApiError } from "@/lib/errors";
import { useApi } from "@/hooks/use-api";
import { useOrganizations } from "@/hooks/use-organizations";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

export function OrganizationSwitcher() {
  const { organizationsApi } = useApi();
  const { organizations, refreshOrganizations } = useOrganizations();
  const { selectedOrganization, onSelectOrganization } = useSelectedOrganization();

  const [activeOrganization, setActiveOrganization] = useState(selectedOrganization);
  const [loadingActiveOrganization, setLoadingActiveOrganization] = useState(false);

  useEffect(() => {
    setActiveOrganization(selectedOrganization);
  }, [selectedOrganization]);

  const handleSelectOrganization = async (organizationId: string) => {
    const organization = organizations.find((org) => org.id === organizationId);
    if (!organization) return;

    setActiveOrganization(organization);
    setLoadingActiveOrganization(true);
    const success = await onSelectOrganization(organizationId);
    if (!success) setActiveOrganization(selectedOrganization);
    setLoadingActiveOrganization(false);
  };

  const [showCreateOrganizationDialog, setShowCreateOrganizationDialog] = useState(false);

  const handleCreateOrganization = async (name: string) => {
    try {
      const organization = (
        await organizationsApi.createOrganization({
          name: name.trim(),
        })
      ).data;
      toast.success("Organization created successfully");
      await refreshOrganizations();
      await onSelectOrganization(organization.id);
      return organization;
    } catch (error) {
      handleApiError(error, "Failed to create organization");
      return null;
    }
  };

  const getOrganizationIcon = (organization: Organization) => {
    if (organization.personal) return <UserIcon className="h-5 w-5" />;
    return <BuildingIcon className="h-5 w-5" />;
  };

  const sortedOrganizations = useMemo(() => {
    return organizations.sort((a, b) => {
      if (a.personal && !b.personal) return -1;
      if (!a.personal && b.personal) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [organizations]);

  if (!activeOrganization) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem className={`mb-1 ${loadingActiveOrganization ? "cursor-progress" : ""}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="gap-3 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground [&>svg]:size-auto"
            >
              <div className="relative flex aspect-square size-7 items-center justify-center overflow-hidden rounded-md bg-white font-medium text-black text-md after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[0_1px_2px_0_rgb(0_0_0/.05),inset_0_1px_0_0_rgb(255_255_255/.12)]">
                {getOrganizationIcon(activeOrganization)}
              </div>
              <div className="grid flex-1 text-left text-base leading-tight">
                <span className="truncate font-medium">{activeOrganization.name}</span>
              </div>
              <ChevronsUpDownIcon
                className="ms-auto text-sidebar-foreground/50"
                size={20}
                aria-hidden="true"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="dark w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-md"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground/70 text-xs uppercase">
              Organizations
            </DropdownMenuLabel>
            {sortedOrganizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSelectOrganization(org.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center overflow-hidden rounded-md font-medium text-white">
                  {getOrganizationIcon(org)}
                </div>
                <span className="truncate font-medium text-md">{org.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowCreateOrganizationDialog(true)}
              className="gap-2 p-2"
            >
              <PlusIcon size={16} aria-hidden="true" />
              <div className="font-medium">Create Organization</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateOrganizationDialog
        open={showCreateOrganizationDialog}
        onOpenChange={setShowCreateOrganizationDialog}
        onCreateOrganization={handleCreateOrganization}
      />
    </SidebarMenu>
  );
}
