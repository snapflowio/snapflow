/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useState } from "react";
import { Registry } from "@snapflow/api-client";
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

interface EditRegistryModalProps {
  registry: Registry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRegistry: (data: {
    name: string;
    url: string;
    username: string;
    password?: string;
    project?: string;
  }) => Promise<void>;
  loading?: boolean;
}

export function EditRegistryModal({
  registry,
  open,
  onOpenChange,
  onEditRegistry,
  loading = false,
}: EditRegistryModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [project, setProject] = useState("");

  useEffect(() => {
    if (registry) {
      setName(registry.name);
      setUrl(registry.url);
      setUsername(registry.username);
      setPassword("");
      setProject(registry.project || "");
    }
  }, [registry]);

  const validateForm = (): string | null => {
    if (!name.trim()) return "Registry name is required";
    if (!url.trim()) return "Registry URL is required";
    if (!username.trim()) return "Username is required";

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
    async (e: React.FormEvent) => {
      e.preventDefault();

      const validationError = validateForm();
      if (validationError) {
        toast({ message: validationError });
        return;
      }

      await onEditRegistry({
        name: name.trim(),
        url: url.trim() || "docker.io",
        username: username.trim(),
        password: password.trim() || undefined,
        project: project.trim() || undefined,
      });
    },
    [name, url, username, password, project, onEditRegistry]
  );

  const resetForm = useCallback(() => {
    setName("");
    setUrl("");
    setUsername("");
    setPassword("");
    setProject("");
  }, []);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        resetForm();
      }
    },
    [onOpenChange, resetForm]
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent size="md">
        <ModalHeader>Edit Registry</ModalHeader>
        <ModalBody>
          <form id="edit-registry-form" className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">Registry Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-docker-hub"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-url">Registry URL</Label>
              <Input
                id="edit-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="docker.io"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="myusername"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-password">
                Password{" "}
                <span className="font-normal text-text-secondary">
                  (leave blank to keep current)
                </span>
              </Label>
              <Input
                id="edit-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project">
                Project <span className="font-normal text-text-secondary">(optional)</span>
              </Label>
              <Input
                id="edit-project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="my-project"
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
            form="edit-registry-form"
            disabled={loading || !name.trim() || !url.trim() || !username.trim()}
          >
            {loading ? "Updating..." : "Update Registry"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
