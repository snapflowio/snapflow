/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useState } from "react";
import {
  CreateInvitationRoleEnum,
  OrganizationUserRoleEnum,
  UpdateMemberRoleRoleEnum,
} from "@snapflow/api-client";
import {
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Label,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui";

interface UpdateOrganizationMemberRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRole: OrganizationUserRoleEnum;
  onUpdateMemberRole: (role: UpdateMemberRoleRoleEnum) => Promise<boolean>;
  loading: boolean;
}

export function UpdateOrganizationMemberRolesModal({
  open,
  onOpenChange,
  initialRole,
  onUpdateMemberRole,
  loading,
}: UpdateOrganizationMemberRoleModalProps) {
  const [role, setRole] = useState<CreateInvitationRoleEnum>(initialRole);

  const handleUpdateMemberRole = useCallback(async () => {
    const success = await onUpdateMemberRole(role);
    if (success) {
      onOpenChange(false);
      setRole(initialRole);
    }
  }, [role, onUpdateMemberRole, onOpenChange, initialRole]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setRole(initialRole);
      }
    },
    [onOpenChange, initialRole]
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent size="md">
        <ModalHeader>Change Role</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <ButtonGroup value={role} onValueChange={(v) => setRole(v as CreateInvitationRoleEnum)}>
              <ButtonGroupItem value={CreateInvitationRoleEnum.OWNER}>Owner</ButtonGroupItem>
              <ButtonGroupItem value={CreateInvitationRoleEnum.MEMBER}>Member</ButtonGroupItem>
            </ButtonGroup>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="default" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdateMemberRole} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
