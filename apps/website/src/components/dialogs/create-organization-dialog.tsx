import { useState } from "react";
import { Organization } from "@snapflow/api-client";
import { Link } from "react-router";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Path } from "@/enums/paths";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{createdOrg ? "New Organization" : "Create New Organization"}</DialogTitle>
          <DialogDescription>
            {createdOrg
              ? "You can switch between organizations in the top left corner of the sidebar."
              : "Create a new organization to share resources and collaborate with others."}
          </DialogDescription>
        </DialogHeader>
        {createdOrg ? (
          <div className="space-y-6">
            <div className="rounded-md bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <p className="font-medium">Your organization is created.</p>
              <p className="mt-1 text-sm">
                {import.meta.env.VITE_BILLING_API_URL ? (
                  <>
                    To get started, add a payment method on the{" "}
                    <Link
                      to={Path.BILLING}
                      className="text-blue-500 hover:underline"
                      onClick={(e) => {
                        onOpenChange(false);
                      }}
                    >
                      billing page
                    </Link>
                    .
                  </>
                ) : (
                  <></>
                )}
              </p>
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
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
