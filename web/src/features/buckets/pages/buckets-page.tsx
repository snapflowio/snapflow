/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bucket, BucketState } from "@snapflow/api-client";
import { Database, MoreVertical, Trash2 } from "lucide-react";
import { CreateBucketModal } from "@/components/modals/create-bucket-modal";
import { Resource } from "@/components/resource/resource";
import type { ResourceColumn, ResourceRow } from "@/components/resource/resource-table";
import { timeCell } from "@/components/resource/time-cell";
import {
  Badge,
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
import { apiClient } from "@/api/api-client";
import { useRealtime } from "@/hooks/use-realtime";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

const COLUMNS: ResourceColumn[] = [
  { id: "name", header: "Name", widthMultiplier: 1.2 },
  { id: "state", header: "State", widthMultiplier: 0.6 },
  { id: "created", header: "Created", widthMultiplier: 0.7 },
  { id: "lastUsed", header: "Last Used", widthMultiplier: 0.7 },
];

const BUCKET_STATE_BADGE: Record<
  string,
  { label: string; variant: "green" | "gray" | "red" | "amber" }
> = {
  [BucketState.READY]: { label: "Ready", variant: "green" },
  [BucketState.ERROR]: { label: "Error", variant: "red" },
  [BucketState.CREATING]: { label: "Creating", variant: "amber" },
  [BucketState.PENDING_CREATE]: { label: "Pending", variant: "amber" },
  [BucketState.PENDING_DELETE]: { label: "Deleting", variant: "amber" },
  [BucketState.DELETING]: { label: "Deleting", variant: "amber" },
  [BucketState.DELETED]: { label: "Deleted", variant: "gray" },
};

export default function BucketsPage() {
  const bucketApi = apiClient.bucketApi;
  const { realtimeSocket } = useRealtime();
  const { selectedOrganization } = useSelectedOrganization();

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [bucketToDelete, setBucketToDelete] = useState<Bucket | null>(null);
  const [processingBucketAction, setProcessingBucketAction] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchBuckets = useCallback(
    async (showTableLoadingState = true) => {
      if (!selectedOrganization) return;
      if (showTableLoadingState) setLoadingBuckets(true);
      try {
        const data = (await bucketApi.listBuckets(selectedOrganization.id)).data;
        setBuckets(data);
      } catch (error) {
        handleApiError(error, "Failed to fetch buckets");
      } finally {
        setLoadingBuckets(false);
      }
    },
    [bucketApi, selectedOrganization]
  );

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  useEffect(() => {
    const handleBucketCreatedEvent = (bucket: Bucket) => {
      if (!buckets.some((v) => v.id === bucket.id)) {
        setBuckets((prev) => [bucket, ...prev]);
      }
    };

    const handleBucketStateUpdatedEvent = (data: {
      bucket: Bucket;
      oldState: BucketState;
      newState: BucketState;
    }) => {
      if (data.newState === BucketState.DELETED) {
        setBuckets((prev) => prev.filter((v) => v.id !== data.bucket.id));
      } else if (!buckets.some((v) => v.id === data.bucket.id)) {
        setBuckets((prev) => [data.bucket, ...prev]);
      } else {
        setBuckets((prev) => prev.map((v) => (v.id === data.bucket.id ? data.bucket : v)));
      }
    };

    const handleBucketLastUsedAtUpdatedEvent = (bucket: Bucket) => {
      if (!buckets.some((v) => v.id === bucket.id)) {
        setBuckets((prev) => [bucket, ...prev]);
      } else {
        setBuckets((prev) => prev.map((v) => (v.id === bucket.id ? bucket : v)));
      }
    };

    if (!realtimeSocket) return;

    realtimeSocket.on("bucket.created", handleBucketCreatedEvent);
    realtimeSocket.on("bucket.state.updated", handleBucketStateUpdatedEvent);
    realtimeSocket.on("bucket.lastUsedAt.updated", handleBucketLastUsedAtUpdatedEvent);

    return () => {
      realtimeSocket.off("bucket.created", handleBucketCreatedEvent);
      realtimeSocket.off("bucket.state.updated", handleBucketStateUpdatedEvent);
      realtimeSocket.off("bucket.lastUsedAt.updated", handleBucketLastUsedAtUpdatedEvent);
    };
  }, [realtimeSocket, buckets]);

  const handleCreateBucket = async (name: string) => {
    setLoadingCreate(true);
    try {
      await bucketApi.createBucket({ name }, selectedOrganization?.id);
      toast.success(`Creating bucket ${name}`);
    } catch (error) {
      handleApiError(error, "Failed to create bucket");
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleDelete = async (bucket: Bucket) => {
    setProcessingBucketAction((prev) => ({ ...prev, [bucket.id]: true }));
    setBuckets((prev) =>
      prev.map((v) => (v.id === bucket.id ? { ...v, state: BucketState.PENDING_DELETE } : v))
    );
    try {
      await bucketApi.deleteBucket(bucket.id, selectedOrganization?.id);
      setBucketToDelete(null);
      toast.success(`Deleting bucket ${bucket.name}`);
    } catch (error) {
      handleApiError(error, "Failed to delete bucket");
      setBuckets((prev) =>
        prev.map((v) => (v.id === bucket.id ? { ...v, state: bucket.state } : v))
      );
    } finally {
      setProcessingBucketAction((prev) => ({ ...prev, [bucket.id]: false }));
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return buckets;
    const q = searchQuery.toLowerCase();
    return buckets.filter((b) => b.name?.toLowerCase().includes(q));
  }, [buckets, searchQuery]);

  const rows: ResourceRow[] = useMemo(
    () =>
      filtered.map((b) => ({
        id: b.id,
        cells: {
          name: {
            icon: <Database className="h-3.5 w-3.5" />,
            label: b.name,
          },
          state: {
            content: (() => {
              const cfg = BUCKET_STATE_BADGE[b.state] ?? {
                label: b.state ?? "Unknown",
                variant: "gray" as const,
              };
              return (
                <Badge variant={cfg.variant} size="sm">
                  {cfg.label}
                </Badge>
              );
            })(),
          },
          created: timeCell(b.createdAt),
          lastUsed: timeCell(b.lastUsedAt),
        },
        sortValues: {
          created: -new Date(b.createdAt ?? 0).getTime(),
          lastUsed: -new Date(b.lastUsedAt ?? 0).getTime(),
        },
      })),
    [filtered]
  );

  const rowActions = useCallback(
    (id: string) => {
      const bucket = buckets.find((x) => x.id === id);
      if (!bucket) return null;
      const isTransitioning = (
        [
          BucketState.CREATING,
          BucketState.PENDING_CREATE,
          BucketState.PENDING_DELETE,
          BucketState.DELETING,
        ] as string[]
      ).includes(bucket.state);

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
              onClick={() => setBucketToDelete(bucket)}
              disabled={isTransitioning || processingBucketAction[id]}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    [buckets, processingBucketAction]
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
        icon={Database}
        title="Buckets"
        search={{ value: searchQuery, onChange: setSearchQuery, placeholder: "Search buckets..." }}
        create={{ label: "New bucket", onClick: () => setShowCreateDialog(true) }}
        defaultSort="created"
        columns={columnsWithActions}
        rows={rowsWithActions}
        isLoading={loadingBuckets}
        emptyMessage="No buckets found"
      />

      <CreateBucketModal
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateBucket={handleCreateBucket}
        loading={loadingCreate}
      />

      <Modal
        open={!!bucketToDelete}
        onOpenChange={(open) => {
          if (!open) setBucketToDelete(null);
        }}
      >
        <ModalContent size="sm">
          <ModalHeader>Delete Bucket</ModalHeader>
          <ModalBody>
            <p className="font-season text-[14px] text-text-secondary">
              Are you sure you want to delete this bucket? This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setBucketToDelete(null)}
              className="rounded-[5px] border border-border-1 px-3 py-1.5 font-season text-[13px] text-text-body transition-colors hover:bg-surface-active"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => bucketToDelete && handleDelete(bucketToDelete)}
              disabled={!!bucketToDelete && processingBucketAction[bucketToDelete.id]}
              className="rounded-[5px] bg-red-500 px-3 py-1.5 font-season text-[13px] text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {bucketToDelete && processingBucketAction[bucketToDelete.id]
                ? "Deleting..."
                : "Delete"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
