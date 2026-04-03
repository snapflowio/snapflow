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
  Switch,
  toast,
} from "@/components/ui";

interface CreateRegistryModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreateRegistry: (data: {
    name: string;
    url: string;
    username: string;
    password: string;
    project?: string;
    isDefault?: boolean;
  }) => Promise<void>;
  loading?: boolean;
}

export function CreateRegistryModal({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onCreateRegistry,
  loading = false,
}: CreateRegistryModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [project, setProject] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const validateForm = (): string | null => {
    if (!name.trim()) return "Registry name is required";
    if (!url.trim()) return "Registry URL is required";
    if (!username.trim()) return "Username is required";
    if (!password.trim()) return "Password is required";

    try {
      const urlPattern = /^[a-zA-Z0-9.-]+(\.[a-zA-Z]{2,})?$/;
      const urlValue = url.trim();
      if (!urlPattern.test(urlValue.split(":")[0])) {
        return "Invalid URL format (e.g., docker.io or gcr.io)";
      }
    } catch {
      return "Invalid URL format";
    }

    return null;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const validationError = validateForm();
      if (validationError) {
        toast({ message: validationError });
        return;
      }

      await onCreateRegistry({
        name: name.trim(),
        url: url.trim() || "docker.io",
        username: username.trim(),
        password: password.trim(),
        project: project.trim() || undefined,
        isDefault,
      });

      setOpen(false);
      resetForm();
    },
    [name, url, username, password, project, isDefault, onCreateRegistry, setOpen]
  );

  const resetForm = useCallback(() => {
    setName("");
    setUrl("");
    setUsername("");
    setPassword("");
    setProject("");
    setIsDefault(false);
  }, []);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
      if (!newOpen) {
        resetForm();
      }
    },
    [resetForm, setOpen]
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent size="md">
        <ModalHeader>Create New Registry</ModalHeader>
        <ModalBody>
          <form id="registry-form" className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Registry Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-docker-hub"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="url">Registry URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="docker.io"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="myusername"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="project">
                Project <span className="font-normal text-text-secondary">(optional)</span>
              </Label>
              <Input
                id="project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="my-project"
              />
            </div>

            <div className="border-border border-t" />

            <div className="flex flex-row items-center justify-between gap-3">
              <Label htmlFor="is-default">Default Registry</Label>
              <Switch
                id="is-default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked === true)}
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
            form="registry-form"
            disabled={
              loading || !name.trim() || !url.trim() || !username.trim() || !password.trim()
            }
          >
            {loading ? "Creating..." : "Create Registry"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
