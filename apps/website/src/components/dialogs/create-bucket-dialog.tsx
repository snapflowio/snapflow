"use client";

import { useRef, useState } from "react";
import { Plus, XIcon } from "lucide-react";
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

interface CreateBucketDialogProps {
  onCreateBucket: (name: string) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function CreateBucketDialog({
  onCreateBucket,
  loading = false,
  disabled = false,
}: CreateBucketDialogProps) {
  const [open, setOpen] = useState(false);
  const [bucketName, setBucketName] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateBucket(bucketName);
    setOpen(false);
    setBucketName("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setBucketName("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled} size={"sm"}>
          <Plus className="h-4 w-4" />
          Create Bucket
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[74vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]"
        hideCloseButton
      >
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-medium text-lg">Create New Bucket</DialogTitle>
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
          <DialogDescription>Instantly Access Shared Files with Bucket Mounts</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              ref={scrollContainerRef}
              className="scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/25 scrollbar-track-transparent flex-1 overflow-y-auto px-6"
            >
              <div className="flex min-h-full flex-col py-4">
                <form
                  id="create-bucket-form"
                  className="space-y-6 overflow-y-auto px-1 pb-1"
                  onSubmit={handleSubmit}
                >
                  <div className="space-y-3">
                    <Label htmlFor="name">Bucket Name</Label>
                    <Input
                      id="name"
                      value={bucketName}
                      onChange={(e) => setBucketName(e.target.value)}
                      placeholder="my-bucket"
                    />
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
                form="create-bucket-form"
                variant="default"
                disabled={!bucketName.trim()}
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
