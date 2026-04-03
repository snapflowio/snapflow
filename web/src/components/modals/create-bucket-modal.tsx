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
} from "@/components/ui";

interface CreateBucketModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreateBucket: (name: string) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function CreateBucketModal({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onCreateBucket,
  loading = false,
  disabled = false,
}: CreateBucketModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [bucketName, setBucketName] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onCreateBucket(bucketName);
      setOpen(false);
      setBucketName("");
    },
    [bucketName, onCreateBucket, setOpen]
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        setBucketName("");
      }
    },
    [setOpen]
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent size="md">
        <ModalHeader>Create New Bucket</ModalHeader>
        <ModalBody>
          <form id="create-bucket-form" className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Bucket Name</Label>
              <Input
                id="name"
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="my-bucket"
              />
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="default" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="create-bucket-form"
            disabled={loading || !bucketName.trim()}
          >
            {loading ? "Creating..." : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
