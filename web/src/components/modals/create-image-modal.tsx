/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useState } from "react";
import {
  Button,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Slider,
  toast,
} from "@/components/ui";
import { IMAGE_NAME_REGEX, validateImageName } from "@/constants/image-validation";

interface CreateImageModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreateImage: (data: {
    name: string;
    imageName: string;
    entrypoint?: string[];
    cpu?: number;
    memory?: number;
    disk?: number;
  }) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function CreateImageModal({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onCreateImage,
  loading = false,
  disabled = false,
}: CreateImageModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [imageName, setImageName] = useState("");
  const [registryImageName, setRegistryImageName] = useState("");
  const [entrypoint, setEntrypoint] = useState("");
  const [cpu, setCpu] = useState(2);
  const [memory, setMemory] = useState(512);
  const [disk, setDisk] = useState(2);

  const validateImageNameLocal = (name: string): string | null => {
    if (name.includes(" ")) return "Spaces are not allowed in image names";

    if (!IMAGE_NAME_REGEX.test(name)) {
      return "Invalid image name format. May contain letters, digits, dots, colons, slashes and dashes";
    }

    return null;
  };

  const validateRegistryImageName = (name: string): string | null => {
    const result = validateImageName(name);
    return result.error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameValidationError = validateImageNameLocal(imageName);
    if (nameValidationError) {
      toast({ message: nameValidationError });
      return;
    }

    const imageValidationError = validateRegistryImageName(registryImageName);
    if (imageValidationError) {
      toast({ message: imageValidationError });
      return;
    }

    await onCreateImage({
      name: imageName,
      imageName: registryImageName,
      entrypoint: entrypoint.trim() ? entrypoint.trim().split(" ") : undefined,
      cpu,
      memory,
      disk,
    });

    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setImageName("");
    setRegistryImageName("");
    setEntrypoint("");
    setCpu(1);
    setMemory(1);
    setDisk(3);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          resetForm();
        }
      }}
    >
      <ModalContent size="md">
        <ModalHeader>Create New Image</ModalHeader>
        <ModalBody>
          <form id="create-image-form" className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Image Name</Label>
              <Input
                id="name"
                value={imageName}
                onChange={(e) => setImageName(e.target.value)}
                placeholder="ubuntu-4vcpu-8ram-100gb"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="registry-image">Registry Image</Label>
              <Input
                id="registry-image"
                value={registryImageName}
                onChange={(e) => setRegistryImageName(e.target.value)}
                placeholder="ubuntu:22.04"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="entrypoint">
                Entrypoint <span className="font-normal text-text-secondary">(optional)</span>
              </Label>
              <Input
                id="entrypoint"
                value={entrypoint}
                onChange={(e) => setEntrypoint(e.target.value)}
                placeholder="sleep infinity"
              />
            </div>

            <div className="rounded-lg border bg-surface-2">
              <div className="border-b px-4 py-3">
                <Label>Resource Allocation</Label>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-col gap-2">
                  <div className="flex w-full items-center justify-between">
                    <Label>Compute</Label>
                    <span className="text-sm text-text-secondary">{cpu} vCPU</span>
                  </div>
                  <Slider
                    value={[cpu]}
                    onValueChange={(val) => setCpu(val[0])}
                    min={1}
                    max={16}
                    step={1}
                  />
                </div>

                <div className="border-border border-t" />

                <div className="flex flex-col gap-2">
                  <div className="flex w-full items-center justify-between">
                    <Label>Memory</Label>
                    <span className="text-sm text-text-secondary">
                      {memory >= 1024 ? `${memory / 1024} GB` : `${memory} MB`}
                    </span>
                  </div>
                  <Slider
                    value={[memory]}
                    onValueChange={(val) => setMemory(val[0])}
                    min={256}
                    max={32768}
                    step={256}
                  />
                </div>

                <div className="border-border border-t" />

                <div className="flex flex-col gap-2">
                  <div className="flex w-full items-center justify-between">
                    <Label>Storage</Label>
                    <span className="text-sm text-text-secondary">{disk} GB</span>
                  </div>
                  <Slider
                    value={[disk]}
                    onValueChange={(val) => setDisk(val[0])}
                    min={1}
                    max={100}
                    step={1}
                  />
                </div>
              </div>
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
            form="create-image-form"
            disabled={
              loading ||
              !imageName.trim() ||
              !registryImageName.trim() ||
              validateImageName(imageName) !== null ||
              validateRegistryImageName(registryImageName) !== null
            }
          >
            {loading ? "Creating..." : "Create Image"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
