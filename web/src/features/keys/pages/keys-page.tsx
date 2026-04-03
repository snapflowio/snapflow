/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiKey,
  ApiKeyCreated,
  CreateApiKeyPermissionsEnum,
  OrganizationUserRoleEnum,
} from "@snapflow/api-client";
import { KeyRound, MoreVertical, Trash2 } from "lucide-react";
import { CreateApiKeyModal } from "@/components/modals/create-api-key-modal";
import { Resource } from "@/components/resource/resource";
import type { ResourceColumn, ResourceRow } from "@/components/resource/resource-table";
import { timeCell } from "@/components/resource/time-cell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  toast,
} from "@/components/ui";
import { handleApiError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { apiClient } from "@/api/api-client";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

const COLUMNS: ResourceColumn[] = [
  { id: "name", header: "Name" },
  { id: "key", header: "Key", widthMultiplier: 1.2 },
  { id: "permissions", header: "Permissions", widthMultiplier: 1.2 },
  { id: "lastUsed", header: "Last Used", widthMultiplier: 0.7 },
  { id: "expires", header: "Expires", widthMultiplier: 0.7 },
];

function ExpiresCell({ expiresAt }: { expiresAt: Date | null }) {
  if (!expiresAt) {
    return <span className="font-season text-[13px] text-text-secondary">Never</span>;
  }
  const now = new Date();
  const date = new Date(expiresAt);
  const diff = date.getTime() - now.getTime();
  const isExpired = diff < 0;
  const isExpiringSoon = !isExpired && diff < 24 * 60 * 60 * 1000;

  const label = isExpired
    ? "Expired"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <span
      className={cn(
        "font-season text-[13px]",
        isExpired ? "text-red-400" : isExpiringSoon ? "text-amber-400" : "text-text-secondary"
      )}
    >
      {label}
    </span>
  );
}

export default function ApiKeysPage() {
  const apiKeyApi = apiClient.apiKeyApi;
  const { selectedOrganization, authenticatedUserOrganizationMember } = useSelectedOrganization();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const availablePermissions = useMemo<CreateApiKeyPermissionsEnum[]>(() => {
    if (!authenticatedUserOrganizationMember) return [];
    if (authenticatedUserOrganizationMember.role === OrganizationUserRoleEnum.OWNER)
      return Object.values(CreateApiKeyPermissionsEnum);
    return Array.from(
      new Set(authenticatedUserOrganizationMember.assignedRoles.flatMap((role) => role.permissions))
    );
  }, [authenticatedUserOrganizationMember]);

  const fetchKeys = useCallback(
    async (showTableLoadingState = true) => {
      if (!selectedOrganization) return;
      if (showTableLoadingState) setLoading(true);
      try {
        const response = await apiKeyApi.listApiKeys(selectedOrganization.id);
        setKeys(response.data);
      } catch (error) {
        handleApiError(error, "Failed to fetch API keys");
      } finally {
        setLoading(false);
      }
    },
    [apiKeyApi, selectedOrganization]
  );

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleRevoke = async (keyName: string) => {
    setLoadingKeys((prev) => ({ ...prev, [keyName]: true }));
    try {
      await apiKeyApi.deleteApiKey(keyName, selectedOrganization?.id);
      toast.success("API key revoked successfully");
      setKeyToRevoke(null);
      await fetchKeys(false);
    } catch (error) {
      handleApiError(error, "Failed to revoke API key");
    } finally {
      setLoadingKeys((prev) => ({ ...prev, [keyName]: false }));
    }
  };

  const handleCreateKey = async (
    name: string,
    permissions: CreateApiKeyPermissionsEnum[],
    expiresAt: Date | null
  ): Promise<ApiKeyCreated | null> => {
    try {
      const key = (
        await apiKeyApi.createApiKey({ name, permissions, expiresAt }, selectedOrganization?.id)
      ).data;
      toast.success("API key created successfully");
      await fetchKeys(false);
      return key;
    } catch (error) {
      handleApiError(error, "Failed to create API key");
      return null;
    }
  };

  const rows: ResourceRow[] = useMemo(
    () =>
      keys.map((k) => ({
        id: k.name,
        cells: {
          name: {
            icon: <KeyRound className="h-3.5 w-3.5" />,
            label: k.name,
          },
          key: {
            content: (
              <span
                className="block max-w-full truncate font-mono text-[12px] text-text-secondary"
                title={k.value}
              >
                {k.value.slice(0, 8)}
                {"•".repeat(16)}
                {k.value.slice(-4)}
              </span>
            ),
          },
          permissions: {
            content: (
              <span
                className="block max-w-full truncate text-[13px] text-text-secondary"
                title={k.permissions.join(", ")}
              >
                {k.permissions.length > 2
                  ? `${k.permissions.slice(0, 2).join(", ")} +${k.permissions.length - 2}`
                  : k.permissions.join(", ")}
              </span>
            ),
          },
          lastUsed: timeCell(k.lastUsedAt),
          expires: {
            content: <ExpiresCell expiresAt={k.expiresAt ?? null} />,
          },
        },
        sortValues: {
          created: -new Date(k.createdAt ?? 0).getTime(),
        },
      })),
    [keys]
  );

  const rowActions = useCallback(
    (id: string) => {
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
            <DropdownMenuItem onClick={() => setKeyToRevoke(id)} disabled={loadingKeys[id]}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Revoke
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    [loadingKeys]
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
        icon={KeyRound}
        title="API Keys"
        create={{ label: "New key", onClick: () => setShowCreateDialog(true) }}
        defaultSort="created"
        columns={columnsWithActions}
        rows={rowsWithActions}
        isLoading={loading}
        emptyMessage="No API keys found"
      />

      <CreateApiKeyModal
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        availablePermissions={availablePermissions}
        onCreateApiKey={handleCreateKey}
      />

      <Modal
        open={!!keyToRevoke}
        onOpenChange={(open) => {
          if (!open) setKeyToRevoke(null);
        }}
      >
        <ModalContent size="sm">
          <ModalHeader>Revoke API Key</ModalHeader>
          <ModalBody>
            <p className="font-season text-[14px] text-text-secondary">
              Are you sure you want to revoke this API key? This action cannot be undone and any
              applications using this key will lose access.
            </p>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setKeyToRevoke(null)}
              className="rounded-[5px] border border-border-1 px-3 py-1.5 font-season text-[13px] text-text-body transition-colors hover:bg-surface-active"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => keyToRevoke && handleRevoke(keyToRevoke)}
              disabled={!!keyToRevoke && loadingKeys[keyToRevoke]}
              className="rounded-[5px] bg-red-500 px-3 py-1.5 font-season text-[13px] text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {keyToRevoke && loadingKeys[keyToRevoke] ? "Revoking..." : "Revoke"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
