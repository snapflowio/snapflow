"use client";

import { useCallback, useEffect, useState } from "react";
import { BucketDto, BucketState, OrganizationRolePermissionsEnum } from "@snapflow/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrganizationPageWrapper } from "@/components/wrappers/organization-page-wrapper";
import { handleApiError } from "@/lib/errors";
import { useApi } from "@/hooks/use-api";
import { useRealtime } from "@/hooks/use-realtime";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { BucketTable } from "./_components/bucket-table";

export default function BucketsPage() {
  const { bucketApi } = useApi();
  const { realtimeSocket } = useRealtime();

  const [buckets, setBuckets] = useState<BucketDto[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(true);

  const [loadingCreate, setLoadingCreate] = useState(false);

  const [bucketToDelete, setBucketToDelete] = useState<BucketDto | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [processingBucketAction, setProcessingBucketAction] = useState<Record<string, boolean>>({});

  const { selectedOrganization } = useSelectedOrganization();

  const fetchBuckets = useCallback(
    async (showTableLoadingState = true) => {
      if (!selectedOrganization) {
        return;
      }
      if (showTableLoadingState) {
        setLoadingBuckets(true);
      }
      try {
        const buckets = (await bucketApi.listBuckets(selectedOrganization.id)).data;
        setBuckets(buckets);
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
    const handleBucketCreatedEvent = (bucket: BucketDto) => {
      if (!buckets.some((v) => v.id === bucket.id)) {
        setBuckets((prev) => [bucket, ...prev]);
      }
    };

    const handleBucketStateUpdatedEvent = (data: {
      bucket: BucketDto;
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

    const handleBucketLastUsedAtUpdatedEvent = (bucket: BucketDto) => {
      if (!buckets.some((v) => v.id === bucket.id)) {
        setBuckets((prev) => [bucket, ...prev]);
      } else {
        setBuckets((prev) => prev.map((v) => (v.id === bucket.id ? bucket : v)));
      }
    };

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
      await bucketApi.createBucket(
        {
          name,
        },
        selectedOrganization?.id
      );
      toast.success(`Creating bucket ${name}`);
    } catch (error) {
      handleApiError(error, "Failed to create bucket");
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleDelete = async (bucket: BucketDto) => {
    setProcessingBucketAction((prev) => ({ ...prev, [bucket.id]: true }));

    // Optimistically updae the bucket state
    setBuckets((prev) =>
      prev.map((v) => (v.id === bucket.id ? { ...v, state: BucketState.PENDING_DELETE } : v))
    );

    try {
      await bucketApi.deleteBucket(bucket.id, selectedOrganization?.id);
      setBucketToDelete(null);
      setShowDeleteDialog(false);
      toast.success(`Deleting bucket ${bucket.name}`);
    } catch (error) {
      handleApiError(error, "Failed to delete bucket");
      // Revert the optimistic update
      setBuckets((prev) =>
        prev.map((v) => (v.id === bucket.id ? { ...v, state: bucket.state } : v))
      );
    } finally {
      setProcessingBucketAction((prev) => ({ ...prev, [bucket.id]: false }));
    }
  };

  return (
    <OrganizationPageWrapper requiredPermissions={[OrganizationRolePermissionsEnum.READ_BUCKETS]}>
      <div className="flex h-full flex-col">
        <BucketTable
          data={buckets}
          loading={loadingBuckets}
          processingBucketAction={processingBucketAction}
          onDelete={(bucket) => {
            setBucketToDelete(bucket);
            setShowDeleteDialog(true);
          }}
          onCreateBucket={handleCreateBucket}
          loadingCreate={loadingCreate}
        />

        {bucketToDelete && (
          <Dialog
            open={showDeleteDialog}
            onOpenChange={(isOpen) => {
              setShowDeleteDialog(isOpen);
              if (!isOpen) {
                setBucketToDelete(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Bucket Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this Bucket? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(bucketToDelete)}
                  disabled={processingBucketAction[bucketToDelete.id]}
                >
                  {processingBucketAction[bucketToDelete.id] ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </OrganizationPageWrapper>
  );
}
