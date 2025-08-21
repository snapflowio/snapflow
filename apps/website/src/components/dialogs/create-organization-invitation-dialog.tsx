"use client";
import { useEffect, useState } from "react";
import { CreateOrganizationInvitationRoleEnum, OrganizationRole } from "@snapflow/api-client";
import { Plus, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ViewerCheckbox } from "@/app/dashboard/members/_components/view-checkbox";

interface CreateOrganizationInvitationDialogProps {
  availableRoles: OrganizationRole[];
  loadingAvailableRoles: boolean;
  onCreateInvitation: (
    email: string,
    role: CreateOrganizationInvitationRoleEnum,
    assignedRoleIds: string[]
  ) => Promise<boolean>;
}

export function CreateOrganizationInvitationDialog({
  availableRoles,
  loadingAvailableRoles,
  onCreateInvitation,
}: CreateOrganizationInvitationDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CreateOrganizationInvitationRoleEnum>(
    CreateOrganizationInvitationRoleEnum.MEMBER
  );
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [developerRole, setDeveloperRole] = useState<OrganizationRole | null>(null);

  useEffect(() => {
    if (!loadingAvailableRoles) {
      const developerRole = availableRoles.find((r) => r.name === "Developer");
      if (developerRole) {
        setDeveloperRole(developerRole);
        setAssignedRoleIds([developerRole.id]);
      }
    }
  }, [loadingAvailableRoles, availableRoles]);

  const handleRoleAssignmentToggle = (roleId: string) => {
    setAssignedRoleIds((current) => {
      if (current.includes(roleId)) return current.filter((p) => p !== roleId);

      return [...current, roleId];
    });
  };

  const handleCreateInvitation = async () => {
    setLoading(true);
    const success = await onCreateInvitation(
      email,
      role,
      role === CreateOrganizationInvitationRoleEnum.OWNER ? [] : assignedRoleIds
    );
    if (success) {
      handleDialogOpenChange(false);
    }
    setLoading(false);
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEmail("");
      setRole(CreateOrganizationInvitationRoleEnum.MEMBER);
      if (developerRole) {
        setAssignedRoleIds([developerRole.id]);
      } else {
        setAssignedRoleIds([]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="w-auto px-4" title="Add Registry">
          <Plus className="h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[74vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]"
        hideCloseButton
      >
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-medium text-lg">Invite Member</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              onClick={() => handleDialogOpenChange(false)}
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <DialogDescription>
            Give them access to the organization with an appropriate role and assignments.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/25 scrollbar-track-transparent flex-1 overflow-y-auto px-6">
              <div className="flex min-h-full flex-col py-4">
                <form
                  id="invitation-form"
                  className="space-y-6 overflow-y-auto px-1 pb-1"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await handleCreateInvitation();
                  }}
                >
                  <div className="space-y-3">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={email}
                      type="email"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="mail@example.com"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="role">Role</Label>
                    <RadioGroup
                      className="gap-6"
                      value={role}
                      onValueChange={(value: CreateOrganizationInvitationRoleEnum) =>
                        setRole(value)
                      }
                    >
                      <div className="flex items-center space-x-4">
                        <RadioGroupItem
                          value={CreateOrganizationInvitationRoleEnum.OWNER}
                          id="role-owner"
                        />
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
                        <RadioGroupItem
                          value={CreateOrganizationInvitationRoleEnum.MEMBER}
                          id="role-member"
                        />
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

                  {role === CreateOrganizationInvitationRoleEnum.MEMBER &&
                    !loadingAvailableRoles && (
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
                                  <p className="text-gray-500 text-sm">
                                    {availableRole.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto border-t px-6 pt-4 pb-6">
          <div className="flex justify-between">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
            {loading ? (
              <Button type="button" variant="default" disabled>
                Inviting...
              </Button>
            ) : (
              <Button
                type="submit"
                form="invitation-form"
                variant="default"
                disabled={!email.trim()}
              >
                Invite
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
