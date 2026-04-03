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
  Button,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTrigger,
} from "@/components/ui";

interface DeleteOrganizationModalProps {
  organizationName: string;
  onDeleteOrganization: () => Promise<boolean>;
  loading: boolean;
}

export function DeleteOrganizationModal({
  organizationName,
  onDeleteOrganization,
  loading,
}: DeleteOrganizationModalProps) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const handleDeleteOrganization = useCallback(async () => {
    const success = await onDeleteOrganization();
    if (success) {
      setOpen(false);
      setConfirmName("");
    }
  }, [onDeleteOrganization]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setConfirmName("");
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await handleDeleteOrganization();
    },
    [handleDeleteOrganization]
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalTrigger>
        <Button variant="destructive">Delete Organization</Button>
      </ModalTrigger>
      <ModalContent size="sm">
        <ModalHeader>Delete Organization</ModalHeader>
        <ModalBody>
          <p className="text-[13px] text-text-secondary">
            This will permanently delete all associated data. This action cannot be undone.
          </p>
          <form
            id="delete-organization-form"
            className="mt-3 flex flex-col gap-3"
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-action">
                Please type{" "}
                <span className="cursor-text select-all font-bold font-mono">
                  {organizationName}
                </span>{" "}
                to confirm
              </Label>
              <Input
                id="confirm-action"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={organizationName}
                autoComplete="off"
              />
            </div>
          </form>
        </ModalBody>

        <ModalFooter>
          <Button variant="default" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="delete-organization-form"
            variant="destructive"
            disabled={loading || confirmName !== organizationName}
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
