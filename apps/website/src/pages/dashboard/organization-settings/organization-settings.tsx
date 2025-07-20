import { useState } from "react";
import { OrganizationUserRoleEnum } from "@snapflow/api-client";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { DeleteOrganizationDialog } from "@/components/dialogs/delete-organization-dialog";
import { LeaveOrganizationDialog } from "@/components/dialogs/leave-organization-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/lib/errors";
import { useApi } from "@/hooks/use-api";
import { useOrganizations } from "@/hooks/use-organizations";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

export function OrganizationSettings() {
  const { organizationsApi } = useApi();
  const { refreshOrganizations } = useOrganizations();
  const { selectedOrganization, authenticatedUserOrganizationMember } = useSelectedOrganization();

  const [loadingDeleteOrganization, setLoadingDeleteOrganization] = useState(false);
  const [loadingLeaveOrganization, setLoadingLeaveOrganization] = useState(false);

  const handleDeleteOrganization = async () => {
    if (!selectedOrganization) return false;

    setLoadingDeleteOrganization(true);
    try {
      await organizationsApi.deleteOrganization(selectedOrganization.id);
      toast.success("Organization deleted successfully");
      await refreshOrganizations();
      return true;
    } catch (error) {
      handleApiError(error, "Failed to delete organization");
      return false;
    } finally {
      setLoadingDeleteOrganization(false);
    }
  };

  const handleLeaveOrganization = async () => {
    if (!selectedOrganization) return false;

    setLoadingLeaveOrganization(true);
    try {
      await organizationsApi.leaveOrganization(selectedOrganization.id);
      toast.success("Organization left successfully");
      await refreshOrganizations();
      return true;
    } catch (error) {
      handleApiError(error, "Failed to leave organization");
      return false;
    } finally {
      setLoadingLeaveOrganization(false);
    }
  };

  if (!selectedOrganization) return null;

  return (
    <div className="px-6 py-2">
      <div className="mb-2 flex h-12 items-center justify-between">
        <h1 className="font-medium text-2xl">Organization Settings</h1>
      </div>
      <div className="mt-4 max-w-2xl space-y-6">
        <div className="space-y-3">
          <Label htmlFor="organization-id">Organization ID</Label>
          <div className="relative">
            <Input id="organization-id" value={selectedOrganization.id} readOnly />
            <button
              className="-translate-y-1/2 absolute top-1/2 right-2 rounded p-1 hover:bg-muted"
              onClick={() => {
                navigator.clipboard.writeText(selectedOrganization.id);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="organization-name">Organization Name</Label>
          <Input id="organization-name" value={selectedOrganization.name} readOnly />
        </div>

        {!selectedOrganization.personal && authenticatedUserOrganizationMember !== null && (
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">Danger Zone</h2>
            {authenticatedUserOrganizationMember.role === OrganizationUserRoleEnum.OWNER ? (
              <DeleteOrganizationDialog
                organizationName={selectedOrganization.name}
                onDeleteOrganization={handleDeleteOrganization}
                loading={loadingDeleteOrganization}
              />
            ) : (
              <LeaveOrganizationDialog
                onLeaveOrganization={handleLeaveOrganization}
                loading={loadingLeaveOrganization}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
