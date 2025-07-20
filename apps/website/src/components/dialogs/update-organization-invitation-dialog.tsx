import { useState } from "react";
import {
  OrganizationInvitation,
  OrganizationInvitationRoleEnum,
  OrganizationRole,
  UpdateOrganizationInvitationRoleEnum,
} from "@snapflow/api-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ViewerCheckbox } from "@/pages/dashboard/organization-members/components/view-checkbox";

interface UpdateOrganizationInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitation: OrganizationInvitation;
  availableRoles: OrganizationRole[];
  loadingAvailableRoles: boolean;
  onUpdateInvitation: (
    role: UpdateOrganizationInvitationRoleEnum,
    assignedRoleIds: string[]
  ) => Promise<boolean>;
}

export function UpdateOrganizationInvitationDialog({
  open,
  onOpenChange,
  invitation,
  availableRoles,
  loadingAvailableRoles,
  onUpdateInvitation,
}: UpdateOrganizationInvitationDialogProps) {
  const [role, setRole] = useState<OrganizationInvitationRoleEnum>(invitation.role);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>(
    invitation.assignedRoles.map((role) => role.id)
  );
  const [loading, setLoading] = useState(false);

  const handleRoleAssignmentToggle = (roleId: string) => {
    setAssignedRoleIds((current) => {
      if (current.includes(roleId)) return current.filter((p) => p !== roleId);

      return [...current, roleId];
    });
  };

  const handleUpdateInvitation = async () => {
    setLoading(true);
    const success = await onUpdateInvitation(
      role,
      role === OrganizationInvitationRoleEnum.OWNER ? [] : assignedRoleIds
    );
    if (success) {
      onOpenChange(false);
      setRole(invitation.role);
      setAssignedRoleIds(invitation.assignedRoles.map((role) => role.id));
    }
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setRole(invitation.role);
          setRole(invitation.role);
          setAssignedRoleIds(invitation.assignedRoles.map((role) => role.id));
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Invitation</DialogTitle>
          <DialogDescription>Modify organization access for the invited member.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 overflow-y-auto px-1 pb-1">
          <div className="space-y-3">
            <Label htmlFor="email">Email</Label>
            <Input value={invitation.email} type="email" disabled readOnly />
          </div>

          <div className="space-y-3">
            <Label htmlFor="role">Role</Label>
            <RadioGroup
              className="gap-6"
              value={role}
              onValueChange={(value: OrganizationInvitationRoleEnum) => setRole(value)}
            >
              <div className="flex items-center space-x-4">
                <RadioGroupItem value={OrganizationInvitationRoleEnum.OWNER} id="role-owner" />
                <div className="space-y-1">
                  <Label htmlFor="role-owner" className="font-normal">
                    Owner
                  </Label>
                  <p className="text-gray-500 text-sm">
                    Full administrative access to the organization and its resources
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <RadioGroupItem value={OrganizationInvitationRoleEnum.MEMBER} id="role-member" />
                <div className="space-y-1">
                  <Label htmlFor="role-member" className="font-normal">
                    Member
                  </Label>
                  <p className="text-gray-500 text-sm">
                    Access to organization resources is based on assignments
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {role === OrganizationInvitationRoleEnum.MEMBER && !loadingAvailableRoles && (
            <div className="space-y-3">
              <Label htmlFor="assignments">Assignments</Label>
              <div className="space-y-6">
                <ViewerCheckbox />
                {availableRoles.map((availableRole) => (
                  <div key={availableRole.id} className="flex items-center space-x-4">
                    <Checkbox
                      id={`role-${availableRole.id}`}
                      checked={assignedRoleIds.includes(availableRole.id)}
                      onCheckedChange={() => handleRoleAssignmentToggle(availableRole.id)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor={`role-${availableRole.id}`} className="font-normal">
                        {availableRole.name}
                      </Label>
                      {availableRole.description && (
                        <p className="text-gray-500 text-sm">{availableRole.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          {loading ? (
            <Button type="button" variant="default" disabled>
              Updating...
            </Button>
          ) : (
            <Button type="button" variant="default" onClick={handleUpdateInvitation}>
              Update
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
