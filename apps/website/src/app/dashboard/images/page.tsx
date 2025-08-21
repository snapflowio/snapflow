"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageDto, ImageState, PaginatedImagesDto } from "@snapflow/api-client";
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
import { handleApiError } from "@/lib/errors";
import { DEFAULT_PAGE_SIZE } from "@/constants/pagination";
import { useApi } from "@/hooks/use-api";
import { useRealtime } from "@/hooks/use-realtime";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { ImageTable } from "./_components/images-table";

export default function ImagesPage() {
  const { realtimeSocket } = useRealtime();

  const { imageApi } = useApi();
  const [imagesData, setImagesData] = useState<PaginatedImagesDto>({
    items: [],
    total: 0,
    page: 1,
    totalPages: 0,
  });

  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [loadingTable, setLoadingTable] = useState(true);
  const [imageToDelete, setImageToDelete] = useState<ImageDto | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { selectedOrganization } = useSelectedOrganization();

  const [paginationParams, setPaginationParams] = useState({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const fetchImages = useCallback(
    async (showTableLoadingState = true) => {
      if (!selectedOrganization) {
        return;
      }
      if (showTableLoadingState) {
        setLoadingTable(true);
      }
      try {
        const response = (
          await imageApi.getAllImages(
            selectedOrganization.id,
            paginationParams.pageSize,
            paginationParams.pageIndex + 1
          )
        ).data;
        setImagesData(response);
      } catch (error) {
        handleApiError(error, "Failed to fetch images");
      } finally {
        setLoadingTable(false);
      }
    },
    [imageApi, selectedOrganization, paginationParams.pageIndex, paginationParams.pageSize]
  );

  const handlePaginationChange = useCallback(
    ({ pageIndex, pageSize }: { pageIndex: number; pageSize: number }) => {
      setPaginationParams({ pageIndex, pageSize });
    },
    []
  );

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  useEffect(() => {
    const handleImageCreatedEvent = (image: ImageDto) => {
      if (paginationParams.pageIndex === 0) {
        setImagesData((prev) => {
          if (prev.items.some((i) => i.id === image.id)) {
            return prev;
          }

          const insertIndex =
            prev.items.findIndex((i) => !i.lastUsedAt && i.createdAt <= image.createdAt) ||
            prev.items.length;

          const newImages = [...prev.items];
          newImages.splice(insertIndex, 0, image);

          const newTotal = prev.total + 1;
          return {
            ...prev,
            items: newImages.slice(0, paginationParams.pageSize),
            total: newTotal,
            totalPages: Math.ceil(newTotal / paginationParams.pageSize),
          };
        });
      }
    };

    const handleImageStateUpdatedEvent = (data: {
      image: ImageDto;
      oldState: ImageState;
      newState: ImageState;
    }) => {
      setImagesData((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === data.image.id ? data.image : i)),
      }));
    };

    const handleImageEnabledToggledEvent = (image: ImageDto) => {
      setImagesData((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === image.id ? image : i)),
      }));
    };

    const handleImageRemovedEvent = (imageId: string) => {
      setImagesData((prev) => {
        const newTotal = Math.max(0, prev.total - 1);
        const newItems = prev.items.filter((i) => i.id !== imageId);

        return {
          ...prev,
          items: newItems,
          total: newTotal,
          totalPages: Math.ceil(newTotal / paginationParams.pageSize),
        };
      });
    };

    realtimeSocket.on("image.created", handleImageCreatedEvent);
    realtimeSocket.on("image.state.updated", handleImageStateUpdatedEvent);
    realtimeSocket.on("image.enabled.toggled", handleImageEnabledToggledEvent);
    realtimeSocket.on("image.removed", handleImageRemovedEvent);

    return () => {
      realtimeSocket.off("image.created", handleImageCreatedEvent);
      realtimeSocket.off("image.state.updated", handleImageStateUpdatedEvent);
      realtimeSocket.off("image.enabled.toggled", handleImageEnabledToggledEvent);
      realtimeSocket.off("image.removed", handleImageRemovedEvent);
    };
  }, [realtimeSocket, paginationParams.pageIndex, paginationParams.pageSize]);

  useEffect(() => {
    if (imagesData.items.length === 0 && paginationParams.pageIndex > 0) {
      setPaginationParams((prev) => ({
        ...prev,
        pageIndex: prev.pageIndex - 1,
      }));
    }
  }, [imagesData.items.length, paginationParams.pageIndex]);

  const handleCreateImage = async (data: {
    name: string;
    imageName: string;
    entrypoint?: string[];
    cpu?: number;
    memory?: number;
    disk?: number;
  }) => {
    setLoadingCreate(true);
    try {
      await imageApi.createImage(
        {
          name: data.name,
          imageName: data.imageName,
          entrypoint: data.entrypoint,
          cpu: data.cpu,
          memory: data.memory,
          disk: data.disk,
        },
        selectedOrganization?.id
      );
      toast.success(`Creating image ${data.name}`);

      if (paginationParams.pageIndex !== 0) {
        setPaginationParams((prev) => ({
          ...prev,
          pageIndex: 0,
        }));
      }
    } catch (error) {
      handleApiError(error, "Failed to create image");
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleDelete = async (image: ImageDto) => {
    setLoadingImages((prev) => ({ ...prev, [image.id]: true }));

    // Optimistically update the image state
    setImagesData((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === image.id ? { ...i, state: ImageState.REMOVING } : i)),
    }));

    try {
      await imageApi.removeImage(image.id, selectedOrganization?.id);
      setImageToDelete(null);
      setShowDeleteDialog(false);
      toast.success(`Deleting image ${image.name}`);
    } catch (error) {
      handleApiError(error, "Failed to delete image");
      // Revert the optimistic update
      setImagesData((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === image.id ? { ...i, state: image.state } : i)),
      }));
    } finally {
      setLoadingImages((prev) => ({ ...prev, [image.id]: false }));
    }
  };

  const handleToggleEnabled = async (image: ImageDto, enabled: boolean) => {
    setLoadingImages((prev) => ({ ...prev, [image.id]: true }));

    // Optimistically update the image enabled flag
    setImagesData((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === image.id ? { ...i, enabled } : i)),
    }));

    try {
      await imageApi.toggleImageState(image.id, { enabled }, selectedOrganization?.id);
      toast.success(`${enabled ? "Enabling" : "Disabling"} image ${image.name}`);
    } catch (error) {
      handleApiError(error, enabled ? "Failed to enable image" : "Failed to disable image");
      // Revert the optimistic update
      setImagesData((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === image.id ? { ...i, enabled: image.enabled } : i)),
      }));
    } finally {
      setLoadingImages((prev) => ({ ...prev, [image.id]: false }));
    }
  };

  const handleActivate = async (image: ImageDto) => {
    setLoadingImages((prev) => ({ ...prev, [image.id]: true }));

    // Optimistically update the image state
    setImagesData((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === image.id ? { ...i, state: ImageState.ACTIVE } : i)),
    }));

    try {
      await imageApi.activateImage(image.id, selectedOrganization?.id);
      toast.success(`Activating image ${image.name}`);
    } catch (error) {
      handleApiError(error, "Failed to activate image");
      // Revert the optimistic update
      setImagesData((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === image.id ? { ...i, state: image.state } : i)),
      }));
    } finally {
      setLoadingImages((prev) => ({ ...prev, [image.id]: false }));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ImageTable
        data={imagesData.items}
        loading={loadingTable}
        loadingImages={loadingImages}
        onDelete={(image) => {
          setImageToDelete(image);
          setShowDeleteDialog(true);
        }}
        onToggleEnabled={handleToggleEnabled}
        onActivate={handleActivate}
        pageCount={imagesData.totalPages}
        onPaginationChange={handlePaginationChange}
        pagination={{
          pageIndex: paginationParams.pageIndex,
          pageSize: paginationParams.pageSize,
        }}
        onCreateImage={handleCreateImage}
        loadingCreate={loadingCreate}
      />

      {imageToDelete && (
        <Dialog
          open={showDeleteDialog}
          onOpenChange={(isOpen) => {
            setShowDeleteDialog(isOpen);
            if (!isOpen) {
              setImageToDelete(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Image Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this image? This action cannot be undone.
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
                onClick={() => handleDelete(imageToDelete)}
                disabled={loadingImages[imageToDelete.id]}
              >
                {loadingImages[imageToDelete.id] ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
