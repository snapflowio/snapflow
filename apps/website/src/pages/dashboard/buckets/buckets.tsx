import { useCallback, useEffect, useMemo, useState } from "react";
import { BucketDto, BucketState, OrganizationRolePermissionsEnum } from "@snapflow/api-client";
import { Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/lib/errors";
import { useApi } from "@/hooks/use-api";
import { useRealtime } from "@/hooks/use-realtime";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { BucketTable } from "./components/bucket-table";

export function Buckets() {
  const { bucketApi } = useApi();
  const { realtimeSocket } = useRealtime();

  const [buckets, setBuckets] = useState<BucketDto[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);

  const [bucketToDelete, setBucketToDelete] = useState<BucketDto | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [processingBucketAction, setProcessingBucketAction] = useState<Record<string, boolean>>({});

  const { selectedOrganization, authenticatedUserHasPermission } = useSelectedOrganization();

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

  const handleCreate = async () => {
    setLoadingCreate(true);
    try {
      await bucketApi.createBucket(
        {
          name: newBucketName,
        },
        selectedOrganization?.id
      );
      setShowCreateDialog(false);
      setNewBucketName("");
      toast.success(`Creating bucket ${newBucketName}`);
    } catch (error) {
      handleApiError(error, "Failed to create bucket");
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleDelete = async (bucket: BucketDto) => {
    setProcessingBucketAction((prev) => ({ ...prev, [bucket.id]: true }));

    // Optimistically update the bucket state
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

  const handleBulkDelete = async (buckets: BucketDto[]) => {
    setProcessingBucketAction((prev) => ({
      ...prev,
      ...buckets.reduce((acc, v) => ({ ...acc, [v.id]: true }), {}),
    }));

    for (const bucket of buckets) {
      setBuckets((prev) =>
        prev.map((v) => (v.id === bucket.id ? { ...v, state: BucketState.PENDING_DELETE } : v))
      );

      try {
        await bucketApi.deleteBucket(bucket.id, selectedOrganization?.id);
        toast.success(`Deleting bucket ${bucket.name}`);
      } catch (error) {
        handleApiError(error, "Failed to delete bucket");

        setBuckets((prev) =>
          prev.map((v) => (v.id === bucket.id ? { ...v, state: bucket.state } : v))
        );

        const shouldContinue = window.confirm(
          `Failed to delete bucket ${bucket.name}. Do you want to continue with the remaining buckets?`
        );

        if (!shouldContinue) {
          break;
        }
      } finally {
        setProcessingBucketAction((prev) => ({ ...prev, [bucket.id]: false }));
      }
    }
  };

  const writePermitted = useMemo(
    () => authenticatedUserHasPermission(OrganizationRolePermissionsEnum.WRITE_BUCKETS),
    [authenticatedUserHasPermission]
  );

  return (
    <div className="px-2">
      <Dialog
        open={showCreateDialog}
        onOpenChange={(isOpen) => {
          setShowCreateDialog(isOpen);
          if (isOpen) {
            return;
          }
          setNewBucketName("");
        }}
      >
        <div className="mb-2 flex h-12 items-center justify-between">
          <h1 className="font-bold text-2xl">Buckets</h1>
          {writePermitted && (
            <DialogTrigger asChild>
              <Button variant="default" disabled={loadingBuckets}>
                <Plus className="h-4 w-4" />
                Create Bucket
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Bucket</DialogTitle>
              <DialogDescription>
                Instantly Access Shared Files with Bucket Mounts
              </DialogDescription>
            </DialogHeader>
            <form
              id="create-bucket-form"
              className="space-y-6 overflow-y-auto px-1 pb-1"
              onSubmit={async (e) => {
                e.preventDefault();
                await handleCreate();
              }}
            >
              <div className="space-y-3">
                <Label htmlFor="name">Bucket Name</Label>
                <Input
                  id="name"
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  placeholder="my-bucket"
                />
              </div>
            </form>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" size="sm" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              {loadingCreate ? (
                <Button type="button" size="sm" variant="default" disabled>
                  Creating...
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  form="create-bucket-form"
                  variant="default"
                  disabled={!newBucketName.trim()}
                >
                  Create
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </div>

        <BucketTable
          data={buckets}
          loading={loadingBuckets}
          processingBucketAction={processingBucketAction}
          onDelete={(bucket) => {
            setBucketToDelete(bucket);
            setShowDeleteDialog(true);
          }}
        />
      </Dialog>

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
  );
}
