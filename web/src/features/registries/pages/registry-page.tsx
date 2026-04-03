/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Registry, RegistryRegistryTypeEnum } from "@snapflow/api-client";
import { Container, Edit, MoreVertical, Trash2 } from "lucide-react";
import { CreateRegistryModal } from "@/components/modals/create-registry-modal";
import { EditRegistryModal } from "@/components/modals/edit-registry-modal";
import { Resource } from "@/components/resource/resource";
import type { ResourceColumn, ResourceRow } from "@/components/resource/resource-table";
import { timeCell } from "@/components/resource/time-cell";
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  toast,
} from "@/components/ui";
import { handleApiError } from "@/lib/errors";
import { apiClient } from "@/api/api-client";
import { useRealtime } from "@/hooks/use-realtime";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

const COLUMNS: ResourceColumn[] = [
  { id: "name", header: "Name" },
  { id: "url", header: "URL", widthMultiplier: 1.3 },
  { id: "username", header: "Username", widthMultiplier: 0.8 },
  { id: "type", header: "Type", widthMultiplier: 0.6 },
  { id: "created", header: "Created", widthMultiplier: 0.7 },
];

const REGISTRY_TYPE_BADGE: Record<
  string,
  { label: string; variant: "blue" | "purple" | "green" | "gray" }
> = {
  [RegistryRegistryTypeEnum.INTERNAL]: { label: "Internal", variant: "blue" },
  [RegistryRegistryTypeEnum.ORGANIZATION]: { label: "Organization", variant: "purple" },
  [RegistryRegistryTypeEnum.PUBLIC]: { label: "Public", variant: "green" },
  [RegistryRegistryTypeEnum.TRANSIENT]: { label: "Transient", variant: "gray" },
};

export default function RegistryPage() {
  const { realtimeSocket } = useRealtime();
  const registryApi = apiClient.registryApi;
  const { selectedOrganization } = useSelectedOrganization();

  const [registries, setRegistries] = useState<Registry[]>([]);
  const [loadingRegistries, setLoadingRegistries] = useState<Record<string, boolean>>({});
  const [loadingTable, setLoadingTable] = useState(true);
  const [registryToDelete, setRegistryToDelete] = useState<Registry | null>(null);
  const [registryToEdit, setRegistryToEdit] = useState<Registry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchRegistries = useCallback(
    async (showTableLoadingState = true) => {
      if (!selectedOrganization) return;
      if (showTableLoadingState) setLoadingTable(true);
      try {
        const response = await registryApi.listRegistries(selectedOrganization.id);
        setRegistries(response.data);
      } catch (error) {
        handleApiError(error, "Failed to fetch registries");
      } finally {
        setLoadingTable(false);
      }
    },
    [registryApi, selectedOrganization]
  );

  useEffect(() => {
    fetchRegistries();
  }, [fetchRegistries]);

  useEffect(() => {
    const handleRegistryCreatedEvent = (registry: Registry) => {
      setRegistries((prev) => {
        if (prev.some((r) => r.id === registry.id)) return prev;
        return [...prev, registry];
      });
    };

    const handleRegistryUpdatedEvent = (data: { registry: Registry }) => {
      setRegistries((prev) => prev.map((r) => (r.id === data.registry.id ? data.registry : r)));
    };

    const handleRegistryDeletedEvent = (data: { registryId: string }) => {
      setRegistries((prev) => prev.filter((r) => r.id !== data.registryId));
    };

    if (realtimeSocket?.connected) {
      realtimeSocket.on("registry.created", handleRegistryCreatedEvent);
      realtimeSocket.on("registry.updated", handleRegistryUpdatedEvent);
      realtimeSocket.on("registry.deleted", handleRegistryDeletedEvent);
    }

    return () => {
      if (realtimeSocket) {
        realtimeSocket.off("registry.created", handleRegistryCreatedEvent);
        realtimeSocket.off("registry.updated", handleRegistryUpdatedEvent);
        realtimeSocket.off("registry.deleted", handleRegistryDeletedEvent);
      }
    };
  }, [realtimeSocket]);

  const handleDeleteRegistry = async () => {
    if (!registryToDelete || !selectedOrganization) return;
    setLoadingRegistries((prev) => ({ ...prev, [registryToDelete.id]: true }));
    try {
      await registryApi.deleteRegistry(registryToDelete.id, selectedOrganization?.id);
      toast.success("Registry deleted successfully");
      await fetchRegistries(false);
    } catch (error) {
      handleApiError(error, "Failed to delete registry");
    } finally {
      setLoadingRegistries((prev) => ({ ...prev, [registryToDelete.id]: false }));
      setRegistryToDelete(null);
    }
  };

  const handleEditRegistry = async (data: {
    name: string;
    url: string;
    username: string;
    password?: string;
    project?: string;
  }) => {
    if (!registryToEdit || !selectedOrganization) return;
    setLoadingRegistries((prev) => ({ ...prev, [registryToEdit.id]: true }));
    try {
      await registryApi.updateRegistry(
        registryToEdit.id,
        {
          name: data.name,
          url: data.url,
          username: data.username,
          password: data.password,
          project: data.project,
        },
        selectedOrganization?.id
      );
      toast.success("Registry updated successfully");
      await fetchRegistries(false);
      setRegistryToEdit(null);
    } catch (error) {
      handleApiError(error, "Failed to update registry");
      throw error;
    } finally {
      setLoadingRegistries((prev) => ({ ...prev, [registryToEdit.id]: false }));
    }
  };

  const handleCreateRegistry = async (data: {
    name: string;
    url: string;
    username: string;
    password: string;
    project?: string;
    isDefault?: boolean;
  }) => {
    if (!selectedOrganization) return;
    try {
      await registryApi.createRegistry(
        {
          name: data.name,
          url: data.url,
          username: data.username,
          password: data.password,
          project: data.project,
          registryType: "organization",
          isDefault: data.isDefault,
        },
        selectedOrganization?.id
      );
      toast.success("Registry created successfully");
      await fetchRegistries(false);
    } catch (error) {
      handleApiError(error, "Failed to create registry");
      throw error;
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return registries;
    const q = searchQuery.toLowerCase();
    return registries.filter(
      (r) => r.name?.toLowerCase().includes(q) || r.url?.toLowerCase().includes(q)
    );
  }, [registries, searchQuery]);

  const rows: ResourceRow[] = useMemo(
    () =>
      filtered.map((r) => ({
        id: r.id,
        cells: {
          name: {
            icon: <Container className="h-3.5 w-3.5" />,
            label: r.name,
          },
          url: {
            content: <span className="font-mono text-[12px] text-text-secondary">{r.url}</span>,
          },
          username: { label: r.username },
          type: {
            content: (() => {
              const cfg = REGISTRY_TYPE_BADGE[r.registryType] ?? {
                label: r.registryType ?? "Unknown",
                variant: "gray" as const,
              };
              return (
                <Badge variant={cfg.variant} size="sm">
                  {cfg.label}
                </Badge>
              );
            })(),
          },
          created: timeCell(r.createdAt),
        },
        sortValues: {
          created: -new Date(r.createdAt ?? 0).getTime(),
        },
      })),
    [filtered]
  );

  const rowActions = useCallback(
    (id: string) => {
      const registry = registries.find((x) => x.id === id);
      if (!registry) return null;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-text-icon transition-colors hover:bg-surface-active"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem
              onClick={() => setRegistryToEdit(registry)}
              disabled={loadingRegistries[id]}
            >
              <Edit className="mr-2 h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setRegistryToDelete(registry)}
              disabled={loadingRegistries[id]}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    [registries, loadingRegistries]
  );

  const rowsWithActions: ResourceRow[] = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        cells: {
          ...row.cells,
          actions: { content: rowActions(row.id) },
        },
      })),
    [rows, rowActions]
  );

  const columnsWithActions: ResourceColumn[] = [
    ...COLUMNS,
    { id: "actions", header: "", widthMultiplier: 0.3 },
  ];

  return (
    <>
      <Resource
        icon={Container}
        title="Registries"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search registries...",
        }}
        create={{ label: "New registry", onClick: () => setShowCreateDialog(true) }}
        defaultSort="created"
        columns={columnsWithActions}
        rows={rowsWithActions}
        isLoading={loadingTable}
        emptyMessage="No registries found"
      />

      <CreateRegistryModal
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateRegistry={handleCreateRegistry}
      />

      <Modal
        open={!!registryToDelete}
        onOpenChange={(open) => {
          if (!open) setRegistryToDelete(null);
        }}
      >
        <ModalContent size="sm">
          <ModalHeader>Delete Registry</ModalHeader>
          <ModalBody>
            <p className="font-season text-[14px] text-text-secondary">
              Are you sure you want to delete the registry "{registryToDelete?.name}"? This action
              cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setRegistryToDelete(null)}
              className="rounded-[5px] border border-border-1 px-3 py-1.5 font-season text-[13px] text-text-body transition-colors hover:bg-surface-active"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteRegistry}
              disabled={loadingRegistries[registryToDelete?.id || ""]}
              className="rounded-[5px] bg-red-500 px-3 py-1.5 font-season text-[13px] text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {loadingRegistries[registryToDelete?.id || ""] ? "Deleting..." : "Delete"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <EditRegistryModal
        registry={registryToEdit}
        open={!!registryToEdit}
        onOpenChange={(open) => {
          if (!open) setRegistryToEdit(null);
        }}
        onEditRegistry={handleEditRegistry}
        loading={registryToEdit ? loadingRegistries[registryToEdit.id] : false}
      />
    </>
  );
}
