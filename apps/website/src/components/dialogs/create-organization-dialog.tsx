"use client";
import { useRef, useState } from "react";
import { Organization } from "@snapflow/api-client";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOrganization: (name: string) => Promise<Organization | null>;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onCreateOrganization,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdOrg, setCreatedOrg] = useState<Organization | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleCreateOrganization = async () => {
    setLoading(true);
    const org = await onCreateOrganization(name);
    if (org) {
      setCreatedOrg(org);
      setName("");
    }
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setName("");
          setCreatedOrg(null);
        }
      }}
    >
      <DialogContent
        className="flex max-h-[74vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]"
        hideCloseButton
      >
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-medium text-lg">
              {createdOrg ? "New Organization" : "Create New Organization"}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              onClick={() => onOpenChange(false)}
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <DialogDescription>
            {createdOrg
              ? "You can switch between organizations in the top left corner of the sidebar."
              : "Create a new organization to share resources and collaborate with others."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              ref={scrollContainerRef}
              className="scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/25 scrollbar-track-transparent flex-1 overflow-y-auto px-6"
            >
              <div className="flex min-h-full flex-col py-4">
                {createdOrg ? (
                  <div className="space-y-6">
                    <div className="rounded-md bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <p className="font-medium">Your organization is created.</p>
                    </div>
                  </div>
                ) : (
                  <form
                    id="create-organization-form"
                    className="space-y-6 overflow-y-auto px-1 pb-1"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await handleCreateOrganization();
                    }}
                  >
                    <div className="space-y-3">
                      <Label htmlFor="organization-name">Organization Name</Label>
                      <Input
                        id="organization-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name"
                      />
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto border-t px-6 pt-4 pb-6">
          <div className="flex justify-between">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={loading}>
                {createdOrg ? "Close" : "Cancel"}
              </Button>
            </DialogClose>
            {!createdOrg &&
              (loading ? (
                <Button type="button" variant="default" disabled>
                  Creating...
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="create-organization-form"
                  variant="default"
                  disabled={!name.trim()}
                >
                  Create
                </Button>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
