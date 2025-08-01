"use client";

import { useEffect, useMemo, useState } from "react";
import { Organization } from "@snapflow/api-client/src";
import { BuildingIcon, ChevronsUpDownIcon, PlusIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { CreateOrganizationDialog } from "@/components/dialogs/create-organization-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { handleApiError } from "@/lib/errors";
import { cn } from "@/lib/util";
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
    if (organization.personal) return <UserIcon className="h-4 w-4" />;
    return <BuildingIcon className="h-4 w-4" />;
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 gap-2 px-3 font-medium text-gray-300 text-sm hover:text-white",
              loadingActiveOrganization && "cursor-progress"
            )}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md">
              {getOrganizationIcon(activeOrganization)}
            </div>
            <span className="max-w-[150px] truncate">{activeOrganization.name}</span>
            <ChevronsUpDownIcon className="ml-1 text-gray-400" size={16} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start" side="bottom" sideOffset={4}>
          <DropdownMenuLabel className="text-gray-400 text-xs uppercase">
            Organizations
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sortedOrganizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSelectOrganization(org.id)}
              className="gap-2 p-2 text-gray-300 hover:text-white focus:text-white"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-md">
                {getOrganizationIcon(org)}
              </div>
              <span className="truncate font-medium">{org.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowCreateOrganizationDialog(true)}
            className="gap-2 p-2 text-gray-300 hover:text-white focus:text-white"
          >
            <div className="flex h-5 w-5 items-center justify-center">
              <PlusIcon size={16} aria-hidden="true" />
            </div>
            <span className="font-medium">Create Organization</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={showCreateOrganizationDialog}
        onOpenChange={setShowCreateOrganizationDialog}
        onCreateOrganization={handleCreateOrganization}
      />
    </>
  );
}
