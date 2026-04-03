/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useState } from "react";
import { Organization } from "@snapflow/api-client";
import {
  Button,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  toast,
} from "@/components/ui";

interface CreateOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOrganization: (name: string) => Promise<Organization | null>;
}

export function CreateOrganizationModal({
  open,
  onOpenChange,
  onCreateOrganization,
}: CreateOrganizationModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateOrganization = useCallback(async () => {
    setLoading(true);
    try {
      const org = await onCreateOrganization(name);
      if (org) {
        toast.success("Organization created successfully");
        setName("");
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  }, [name, onCreateOrganization, onOpenChange]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setName("");
      }
    },
    [onOpenChange]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await handleCreateOrganization();
    },
    [handleCreateOrganization]
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent size="md">
        <ModalHeader>Create New Organization</ModalHeader>
        <ModalBody>
          <form
            id="create-organization-form"
            className="flex flex-col gap-3"
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="organization-name">Organization Name</Label>
              <Input
                id="organization-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
              />
            </div>
          </form>
        </ModalBody>

        <ModalFooter>
          <Button variant="default" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="create-organization-form"
            disabled={loading || !name.trim()}
          >
            {loading ? "Creating..." : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
