/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sandbox, SandboxDesiredState, SandboxState } from "@snapflow/api-client";
import { ComputerUseApi, Configuration as ToolboxConfiguration } from "@snapflow/toolbox-client";
import {
  Archive,
  Box,
  Monitor,
  MoreVertical,
  Play,
  StopCircle,
  Terminal,
  Trash2,
} from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

const COLUMNS: ResourceColumn[] = [
  { id: "id", header: "ID", widthMultiplier: 1.4 },
  { id: "state", header: "State", widthMultiplier: 0.6 },
  { id: "region", header: "Region", widthMultiplier: 0.5 },
  { id: "resources", header: "Resources", widthMultiplier: 1.2 },
  { id: "lastEvent", header: "Last Event", widthMultiplier: 0.7 },
  { id: "created", header: "Created", widthMultiplier: 0.7 },
];

const STATE_BADGE_MAP: Record<
  string,
  { label: string; variant: "green" | "red" | "gray" | "amber" }
> = {
  [SandboxState.STARTED]: { label: "Running", variant: "green" },
  [SandboxState.STOPPED]: { label: "Stopped", variant: "gray" },
  [SandboxState.ERROR]: { label: "Error", variant: "red" },
  [SandboxState.BUILD_FAILED]: { label: "Build Failed", variant: "red" },
  [SandboxState.CREATING]: { label: "Creating", variant: "amber" },
  [SandboxState.STARTING]: { label: "Starting", variant: "amber" },
  [SandboxState.STOPPING]: { label: "Stopping", variant: "amber" },
  [SandboxState.DESTROYING]: { label: "Destroying", variant: "amber" },
  [SandboxState.ARCHIVING]: { label: "Archiving", variant: "amber" },
  [SandboxState.ARCHIVED]: { label: "Archived", variant: "gray" },
  [SandboxState.RESTORING]: { label: "Restoring", variant: "amber" },
  [SandboxState.PULLING_IMAGE]: { label: "Pulling Image", variant: "amber" },
  [SandboxState.BUILDING_IMAGE]: { label: "Building Image", variant: "amber" },
  [SandboxState.PENDING_BUILD]: { label: "Pending Build", variant: "gray" },
};

export default function SandboxesPage() {
  const sandboxApi = apiClient.sandboxApi;
  const { token } = useAuth();
  const { realtimeSocket } = useRealtime();
  const { selectedOrganization } = useSelectedOrganization();

  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [loadingSandboxes, setLoadingSandboxes] = useState<Record<string, boolean>>({});
  const [loadingTable, setLoadingTable] = useState(true);
  const [sandboxToDelete, setSandboxToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSandboxes = useCallback(
    async (showLoading = true) => {
      if (!selectedOrganization) return;
      if (showLoading) setLoadingTable(true);
      try {
        const data = (await sandboxApi.listSandboxes(selectedOrganization.id)).data;
        setSandboxes(data);
      } catch (error) {
        handleApiError(error, "Failed to fetch sandboxes");
      } finally {
        setLoadingTable(false);
      }
    },
    [sandboxApi, selectedOrganization]
  );

  useEffect(() => {
    fetchSandboxes();
  }, [fetchSandboxes]);

  useEffect(() => {
    if (!realtimeSocket) return;
    const onCreated = (s: Sandbox) => {
      setSandboxes((prev) => (prev.some((x) => x.id === s.id) ? prev : [s, ...prev]));
    };
    const onStateUpdated = (d: { sandbox: Sandbox; newState: SandboxState }) => {
      if (d.newState === SandboxState.DESTROYED) {
        setSandboxes((prev) => prev.filter((s) => s.id !== d.sandbox.id));
      } else {
        setSandboxes((prev) => {
          const exists = prev.some((s) => s.id === d.sandbox.id);
          return exists
            ? prev.map((s) => (s.id === d.sandbox.id ? d.sandbox : s))
            : [d.sandbox, ...prev];
        });
      }
    };
    const onDesiredStateUpdated = (d: {
      sandbox: Sandbox;
      newDesiredState: SandboxDesiredState;
    }) => {
      if (
        d.newDesiredState === SandboxDesiredState.DESTROYED &&
        (d.sandbox.state === SandboxState.ERROR || d.sandbox.state === SandboxState.BUILD_FAILED)
      ) {
        setSandboxes((prev) => prev.filter((s) => s.id !== d.sandbox.id));
      }
    };
    realtimeSocket.on("sandbox.created", onCreated);
    realtimeSocket.on("sandbox.state.updated", onStateUpdated);
    realtimeSocket.on("sandbox.desired-state.updated", onDesiredStateUpdated);
    return () => {
      realtimeSocket.off("sandbox.created", onCreated);
      realtimeSocket.off("sandbox.state.updated", onStateUpdated);
      realtimeSocket.off("sandbox.desired-state.updated", onDesiredStateUpdated);
    };
  }, [realtimeSocket]);

  const handleStart = async (id: string) => {
    setLoadingSandboxes((p) => ({ ...p, [id]: true }));
    const prev = sandboxes.find((s) => s.id === id)?.state;
    setSandboxes((p) => p.map((s) => (s.id === id ? { ...s, state: SandboxState.STARTING } : s)));
    try {
      await sandboxApi.startSandbox(id, selectedOrganization?.id);
      toast.success(`Starting sandbox ${id}`);
    } catch (error) {
      handleApiError(error, "Failed to start sandbox");
      setSandboxes((p) => p.map((s) => (s.id === id ? { ...s, state: prev } : s)));
    } finally {
      setLoadingSandboxes((p) => ({ ...p, [id]: false }));
    }
  };

  const handleStop = async (id: string) => {
    setLoadingSandboxes((p) => ({ ...p, [id]: true }));
    const prev = sandboxes.find((s) => s.id === id)?.state;
    setSandboxes((p) => p.map((s) => (s.id === id ? { ...s, state: SandboxState.STOPPING } : s)));
    try {
      await sandboxApi.stopSandbox(id, selectedOrganization?.id);
      toast.success(`Stopping sandbox ${id}`);
    } catch (error) {
      handleApiError(error, "Failed to stop sandbox");
      setSandboxes((p) => p.map((s) => (s.id === id ? { ...s, state: prev } : s)));
    } finally {
      setLoadingSandboxes((p) => ({ ...p, [id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    setLoadingSandboxes((p) => ({ ...p, [id]: true }));
    const prev = sandboxes.find((s) => s.id === id)?.state;
    setSandboxes((p) => p.map((s) => (s.id === id ? { ...s, state: SandboxState.DESTROYING } : s)));
    try {
      await sandboxApi.deleteSandbox(id, selectedOrganization?.id);
      setSandboxToDelete(null);
      toast.success(`Deleting sandbox ${id}`);
    } catch (error) {
      handleApiError(error, "Failed to delete sandbox");
      setSandboxes((p) => p.map((s) => (s.id === id ? { ...s, state: prev } : s)));
    } finally {
      setLoadingSandboxes((p) => ({ ...p, [id]: false }));
    }
  };

  const handleArchive = async (id: string) => {
    setLoadingSandboxes((p) => ({ ...p, [id]: true }));
    const prev = sandboxes.find((s) => s.id === id)?.state;
    setSandboxes((p) => p.map((s) => (s.id === id ? { ...s, state: SandboxState.ARCHIVING } : s)));
    try {
      await sandboxApi.archiveSandbox(id, selectedOrganization?.id);
      toast.success(`Archiving sandbox ${id}`);
    } catch (error) {
      handleApiError(error, "Failed to archive sandbox");
      setSandboxes((p) => p.map((s) => (s.id === id ? { ...s, state: prev } : s)));
    } finally {
      setLoadingSandboxes((p) => ({ ...p, [id]: false }));
    }
  };

  const handleVnc = useCallback(
    async (sandbox: Sandbox) => {
      setLoadingSandboxes((p) => ({ ...p, [sandbox.id]: true }));
      try {
        if (!sandbox.toolboxProxyUrl) {
          toast.error("Toolbox proxy URL not available");
          return;
        }
        const toolboxConfig = new ToolboxConfiguration({ basePath: sandbox.toolboxProxyUrl });
        const computerApi = new ComputerUseApi(toolboxConfig, "", apiClient.axiosInstance);

        const status = (await computerApi.getComputerStatus()).data.status;
        if (status !== "active") {
          await computerApi.startComputer();
          toast.success("Starting VNC desktop, please wait...");
          await new Promise((r) => setTimeout(r, 5000));
        }
        const preview = (
          await sandboxApi.getPortPreviewUrl(sandbox.id, 6080, selectedOrganization?.id)
        ).data;
        window.open(preview.url, "_blank", "noopener,noreferrer");
      } catch (error) {
        handleApiError(error, "Failed to open VNC");
      } finally {
        setLoadingSandboxes((p) => ({ ...p, [sandbox.id]: false }));
      }
    },
    [sandboxApi, selectedOrganization]
  );

  const handleTerminal = useCallback(
    async (id: string) => {
      setLoadingSandboxes((p) => ({ ...p, [id]: true }));
      try {
        const preview = (await sandboxApi.getPortPreviewUrl(id, 22222, selectedOrganization?.id))
          .data;
        window.open(preview.url, "_blank", "noopener,noreferrer");
      } catch (error) {
        handleApiError(error, "Failed to open terminal");
      } finally {
        setLoadingSandboxes((p) => ({ ...p, [id]: false }));
      }
    },
    [sandboxApi, selectedOrganization]
  );

  const filtered = useMemo(() => {
    if (!searchQuery) return sandboxes;
    const q = searchQuery.toLowerCase();
    return sandboxes.filter(
      (s) =>
        s.id?.toLowerCase().includes(q) ||
        s.target?.toLowerCase().includes(q) ||
        (s.labels &&
          Object.entries(s.labels).some(([k, v]) => `${k}:${v}`.toLowerCase().includes(q)))
    );
  }, [sandboxes, searchQuery]);

  const rows: ResourceRow[] = useMemo(
    () =>
      filtered.map((s) => ({
        id: s.id ?? "",
        cells: {
          id: {
            icon: <Box className="h-3.5 w-3.5" />,
            label: s.id,
          },
          state: {
            content: (() => {
              const cfg = STATE_BADGE_MAP[s.state ?? ""];
              return cfg ? (
                <Badge variant={cfg.variant} size="sm">
                  {cfg.label}
                </Badge>
              ) : (
                <Badge variant="gray" size="sm">
                  {s.state ?? "Unknown"}
                </Badge>
              );
            })(),
          },
          region: { label: s.target || "—" },
          resources: {
            content: (
              <span className="flex flex-wrap items-center gap-1">
                {s.cpu ? (
                  <Badge variant="gray-secondary" size="sm">
                    {s.cpu} vCPU
                  </Badge>
                ) : null}
                {s.memory ? (
                  <Badge variant="gray-secondary" size="sm">
                    {s.memory >= 1024 ? `${s.memory / 1024} GB` : `${s.memory} MB`}
                  </Badge>
                ) : null}
                {s.disk ? (
                  <Badge variant="gray-secondary" size="sm">
                    {s.disk} GB
                  </Badge>
                ) : null}
                {s.gpu ? (
                  <Badge variant="purple" size="sm">
                    {s.gpu} GPU
                  </Badge>
                ) : null}
              </span>
            ),
          },
          lastEvent: timeCell(s.updatedAt),
          created: timeCell(s.createdAt),
        },
        sortValues: {
          created: -new Date(s.createdAt ?? 0).getTime(),
          lastEvent: -new Date(s.updatedAt ?? 0).getTime(),
        },
      })),
    [filtered]
  );

  const rowActions = useCallback(
    (id: string) => {
      const s = sandboxes.find((x) => x.id === id);
      if (!s) return null;
      const isRunning = s.state === SandboxState.STARTED;
      const isStopped = s.state === SandboxState.STOPPED;
      const isArchived = s.state === SandboxState.ARCHIVED;
      const isTransitioning =
        s.state === SandboxState.CREATING ||
        s.state === SandboxState.STARTING ||
        s.state === SandboxState.STOPPING ||
        s.state === SandboxState.DESTROYING ||
        s.state === SandboxState.ARCHIVING ||
        s.state === SandboxState.RESTORING;

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
            {(isStopped || isArchived) && (
              <DropdownMenuItem onClick={() => handleStart(id)} disabled={loadingSandboxes[id]}>
                <Play className="mr-2 h-3.5 w-3.5" /> Start
              </DropdownMenuItem>
            )}
            {isRunning && (
              <>
                <DropdownMenuItem onClick={() => handleStop(id)} disabled={loadingSandboxes[id]}>
                  <StopCircle className="mr-2 h-3.5 w-3.5" /> Stop
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleTerminal(id)}
                  disabled={loadingSandboxes[id]}
                >
                  <Terminal className="mr-2 h-3.5 w-3.5" /> Terminal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleVnc(s)} disabled={loadingSandboxes[id]}>
                  <Monitor className="mr-2 h-3.5 w-3.5" /> Desktop
                </DropdownMenuItem>
              </>
            )}
            {isStopped && (
              <DropdownMenuItem onClick={() => handleArchive(id)} disabled={loadingSandboxes[id]}>
                <Archive className="mr-2 h-3.5 w-3.5" /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setSandboxToDelete(id)}
              disabled={isTransitioning || loadingSandboxes[id]}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    [sandboxes, loadingSandboxes, handleStart, handleStop, handleArchive, handleTerminal, handleVnc]
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
        icon={Box}
        title="Sandboxes"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search sandboxes...",
        }}
        defaultSort="created"
        columns={columnsWithActions}
        rows={rowsWithActions}
        isLoading={loadingTable}
        emptyMessage="No sandboxes found"
      />

      <Modal
        open={!!sandboxToDelete}
        onOpenChange={(open) => {
          if (!open) setSandboxToDelete(null);
        }}
      >
        <ModalContent size="sm">
          <ModalHeader>Delete Sandbox</ModalHeader>
          <ModalBody>
            <p className="font-season text-[14px] text-text-secondary">
              This will permanently delete the sandbox. This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setSandboxToDelete(null)}
              className="rounded-[5px] border border-border-1 px-3 py-1.5 font-season text-[13px] text-text-body transition-colors hover:bg-surface-active"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => sandboxToDelete && handleDelete(sandboxToDelete)}
              disabled={!!sandboxToDelete && loadingSandboxes[sandboxToDelete]}
              className="rounded-[5px] bg-red-500 px-3 py-1.5 font-season text-[13px] text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {sandboxToDelete && loadingSandboxes[sandboxToDelete] ? "Deleting..." : "Delete"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
