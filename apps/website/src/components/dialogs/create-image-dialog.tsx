"use client";

import { useRef, useState } from "react";
import { Plus, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const IMAGE_NAME_REGEX = /^[a-zA-Z0-9.\-:]+(\/[a-zA-Z0-9.\-:]+)*$/;

interface CreateImageDialogProps {
  onCreateImage: (data: {
    name: string;
    imageName: string;
    entrypoint?: string[];
    cpu?: number;
    memory?: number;
    disk?: number;
  }) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function CreateImageDialog({
  onCreateImage,
  loading = false,
  disabled = false,
}: CreateImageDialogProps) {
  const [open, setOpen] = useState(false);
  const [imageName, setImageName] = useState("");
  const [registryImageName, setRegistryImageName] = useState("");
  const [entrypoint, setEntrypoint] = useState("");
  const [cpu, setCpu] = useState<number | undefined>(undefined);
  const [memory, setMemory] = useState<number | undefined>(undefined);
  const [disk, setDisk] = useState<number | undefined>(undefined);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameValidationError = validateImageName(imageName);
    if (nameValidationError) {
      toast.warning(nameValidationError);
      return;
    }

    const imageValidationError = validateRegistryImageName(registryImageName);
    if (imageValidationError) {
      toast.warning(imageValidationError);
      return;
    }

    await onCreateImage({
      name: imageName,
      imageName: registryImageName,
      entrypoint: entrypoint.trim() ? entrypoint.trim().split(" ") : undefined,
      cpu,
      memory,
      disk,
    });

    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setImageName("");
    setRegistryImageName("");
    setEntrypoint("");
    setCpu(undefined);
    setMemory(undefined);
    setDisk(undefined);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="w-auto px-4" title="Create Image">
          <Plus className="h-4 w-4" />
          Create Image
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[74vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]"
        hideCloseButton
      >
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-medium text-lg">Create New Image</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              onClick={() => setOpen(false)}
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <DialogDescription>
            Register a new image to be used for spinning up sandboxes in your organization.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              ref={scrollContainerRef}
              className="scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/25 scrollbar-track-transparent flex-1 overflow-y-auto px-6"
            >
              <div className="flex min-h-full flex-col py-4">
                <form
                  id="create-image-form"
                  className="space-y-6 overflow-y-auto px-1 pb-1"
                  onSubmit={handleSubmit}
                >
                  <div className="space-y-3">
                    <Label htmlFor="name">Image Name</Label>
                    <Input
                      id="name"
                      value={imageName}
                      onChange={(e) => setImageName(e.target.value)}
                      placeholder="ubuntu-4vcpu-8ram-100gb"
                    />
                    <p className="mt-1 pl-1 text-muted-foreground text-sm">
                      The name you will use in your client app (SDK, CLI) to reference the image.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="registry-image">Image</Label>
                    <Input
                      id="registry-image"
                      value={registryImageName}
                      onChange={(e) => setRegistryImageName(e.target.value)}
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
                      value={entrypoint}
                      onChange={(e) => setEntrypoint(e.target.value)}
                      placeholder="sleep infinity"
                    />
                    <p className="mt-1 pl-1 text-muted-foreground text-sm">
                      Ensure that the entrypoint is a long running command. If not provided, or if
                      the image does not have an entrypoint, 'sleep infinity' will be used as the
                      default.
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
                          Memory (GB):
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
                          Storage (GB):
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
                      If not specified, default values will be used (1 vCPU, 1 GB memory, 3 GB
                      storage).
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto border-t px-6 pt-4 pb-6">
          <div className="flex justify-between">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            {loading ? (
              <Button type="button" variant="default" disabled>
                Creating...
              </Button>
            ) : (
              <Button
                type="submit"
                form="create-image-form"
                variant="default"
                disabled={
                  !imageName.trim() ||
                  !registryImageName.trim() ||
                  validateImageName(imageName) !== null ||
                  validateImageName(registryImageName) !== null
                }
              >
                Create
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
