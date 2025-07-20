import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ImageDto,
  ImageState,
  OrganizationRolePermissionsEnum,
  PaginatedImagesDto,
} from "@snapflow/api-client";
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
import { DEFAULT_PAGE_SIZE } from "@/constants/pagination";
import { useApi } from "@/hooks/use-api";
import { useRealtime } from "@/hooks/use-realtime";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { ImageTable } from "./components/images-table";

const IMAGE_NAME_REGEX = /^[a-zA-Z0-9.\-:]+(\/[a-zA-Z0-9.\-:]+)*$/;

export function Images() {
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newImageName, setNewImageName] = useState("");
  const [newRegistryImageName, setNewRegistryImageName] = useState("");
  const [newEntrypoint, setNewEntrypoint] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [cpu, setCpu] = useState<number | undefined>(undefined);
  const [memory, setMemory] = useState<number | undefined>(undefined);
  const [disk, setDisk] = useState<number | undefined>(undefined);

  const { selectedOrganization, authenticatedUserHasPermission } = useSelectedOrganization();

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

  const validateImageName = (name: string): string | null => {
    if (name.includes(" ")) return "Spaces are not allowed in image names";

    if (!IMAGE_NAME_REGEX.test(name)) {
      return "Invalid image name format. May contain letters, digits, dots, colons, slashes and dashes";
    }

    return null;
  };

  const validateRegistryImageName = (name: string): string | null => {
    if (name.includes(" ")) {
      return "Spaces are not allowed in image names";
    }

    if (!name.includes(":") || name.endsWith(":") || /:\s*$/.test(name)) {
      return "Image name must include a tag (e.g., ubuntu:22.04)";
    }

    if (name.endsWith(":latest")) {
      return 'Images with tag ":latest" are not allowed';
    }

    if (!IMAGE_NAME_REGEX.test(name)) {
      return "Invalid image name format. Must be lowercase, may contain digits, dots, dashes, and single slashes between components";
    }

    return null;
  };

  const handleCreate = async () => {
    const nameValidationError = validateImageName(newImageName);
    if (nameValidationError) {
      toast.warning(nameValidationError);
      return;
    }

    const imageValidationError = validateRegistryImageName(newRegistryImageName);
    if (imageValidationError) {
      toast.warning(imageValidationError);
      return;
    }

    setLoadingCreate(true);
    try {
      await imageApi.createImage(
        {
          name: newImageName,
          imageName: newRegistryImageName,
          entrypoint: newEntrypoint.trim() ? newEntrypoint.trim().split(" ") : undefined,
          cpu,
          memory,
          disk,
        },
        selectedOrganization?.id
      );
      setShowCreateDialog(false);
      setNewImageName("");
      setNewRegistryImageName("");
      setNewEntrypoint("");
      toast.success(`Creating image ${newImageName}`);

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

  const writePermitted = useMemo(
    () => authenticatedUserHasPermission(OrganizationRolePermissionsEnum.WRITE_IMAGES),
    [authenticatedUserHasPermission]
  );

  const handleBulkDelete = async (images: ImageDto[]) => {
    setLoadingImages((prev) => ({
      ...prev,
      ...images.reduce((acc, img) => ({ ...acc, [img.id]: true }), {}),
    }));

    for (const image of images) {
      setImagesData((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === image.id ? { ...i, state: ImageState.REMOVING } : i
        ),
      }));

      try {
        await imageApi.removeImage(image.id, selectedOrganization?.id);
        toast.success(`Deleting image ${image.name}`);
      } catch (error) {
        handleApiError(error, `Failed to delete image ${image.name}`);

        setImagesData((prev) => ({
          ...prev,
          items: prev.items.map((i) => (i.id === image.id ? { ...i, state: image.state } : i)),
        }));

        if (images.indexOf(image) < images.length - 1) {
          const shouldContinue = window.confirm(
            `Failed to delete image ${image.name}. Do you want to continue with the remaining images?`
          );

          if (!shouldContinue) {
            break;
          }
        }
      } finally {
        setLoadingImages((prev) => ({ ...prev, [image.id]: false }));
      }
    }
  };

  return (
    <div className="px-2">
      <Dialog
        open={showCreateDialog}
        onOpenChange={(isOpen) => {
          setShowCreateDialog(isOpen);
          if (isOpen) return;
          setNewImageName("");
          setNewRegistryImageName("");
          setNewEntrypoint("");
          setCpu(undefined);
          setMemory(undefined);
          setDisk(undefined);
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-bold text-2xl">Images</h1>
          {writePermitted && (
            <DialogTrigger asChild>
              <Button
                variant="default"
                size="icon"
                disabled={loadingTable}
                className="w-auto px-4"
                title="Create Image"
              >
                <Plus className="h-4 w-4" />
                Create Image
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Image</DialogTitle>
              <DialogDescription>
                Register a new image to be used for spinning up sandboxes in your organization.
              </DialogDescription>
            </DialogHeader>
            <form
              id="create-image-form"
              className="space-y-6 overflow-y-auto px-1 pb-1"
              onSubmit={async (e) => {
                e.preventDefault();
                await handleCreate();
              }}
            >
              <div className="space-y-3">
                <Label htmlFor="name">Image Name</Label>
                <Input
                  id="name"
                  value={newImageName}
                  onChange={(e) => setNewImageName(e.target.value)}
                  placeholder="ubuntu-4vcpu-8ram-100gb"
                />
                <p className="mt-1 pl-1 text-muted-foreground text-sm">
                  The name you will use in your client app (SDK, CLI) to reference the image.
                </p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="name">Image</Label>
                <Input
                  id="name"
                  value={newRegistryImageName}
                  onChange={(e) => setNewRegistryImageName(e.target.value)}
                  placeholder="ubuntu:22.04"
                />
                <p className="mt-1 pl-1 text-muted-foreground text-sm">
                  Must include a tag (e.g., ubuntu:22.04). The tag "latest" is not allowed.
                </p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="entrypoint">Entrypoint (optional)</Label>
                <Input
                  id="entrypoint"
                  value={newEntrypoint}
                  onChange={(e) => setNewEntrypoint(e.target.value)}
                  placeholder="sleep infinity"
                />
                <p className="mt-1 pl-1 text-muted-foreground text-sm">
                  Ensure that the entrypoint is a long running command. If not provided, or if the
                  image does not have an entrypoint, 'sleep infinity' will be used as the default.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="font-medium text-sm">Resources</h3>
                <div className="space-y-4 px-4 py-2">
                  <div className="flex items-center gap-4">
                    <Label htmlFor="cpu" className="w-32 flex-shrink-0">
                      Compute (vCPU):
                    </Label>
                    <Input
                      id="cpu"
                      type="number"
                      className="w-full"
                      min="1"
                      placeholder="1"
                      onChange={(e) => setCpu(Number.parseInt(e.target.value) || undefined)}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <Label htmlFor="memory" className="w-32 flex-shrink-0">
                      Memory (GiB):
                    </Label>
                    <Input
                      id="memory"
                      type="number"
                      className="w-full"
                      min="1"
                      placeholder="1"
                      onChange={(e) => setMemory(Number.parseInt(e.target.value) || undefined)}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <Label htmlFor="disk" className="w-32 flex-shrink-0">
                      Storage (GiB):
                    </Label>
                    <Input
                      id="disk"
                      type="number"
                      className="w-full"
                      min="1"
                      placeholder="3"
                      onChange={(e) => setDisk(Number.parseInt(e.target.value) || undefined)}
                    />
                  </div>
                </div>
                <p className="mt-1 pl-1 text-muted-foreground text-sm">
                  If not specified, default values will be used (1 vCPU, 1 GiB memory, 3 GiB
                  storage).
                </p>
              </div>
            </form>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              {loadingCreate ? (
                <Button type="button" variant="default" disabled>
                  Creating...
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="create-image-form"
                  variant="default"
                  disabled={
                    !newImageName.trim() ||
                    !newRegistryImageName.trim() ||
                    validateImageName(newImageName) !== null ||
                    validateImageName(newRegistryImageName) !== null
                  }
                >
                  Create
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </div>

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
        />
      </Dialog>

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
