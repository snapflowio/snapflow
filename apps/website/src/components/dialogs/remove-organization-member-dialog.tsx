"use client";
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

interface RemoveOrganizationMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoveMember: () => Promise<boolean>;
  loading: boolean;
}

export function RemoveOrganizationMemberDialog({
  open,
  onOpenChange,
  onRemoveMember,
  loading,
}: RemoveOrganizationMemberDialogProps) {
  const handleRemoveMember = async () => {
    const success = await onRemoveMember();
    if (success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Member</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this member from the organization?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          {loading ? (
            <Button type="button" variant="default" disabled>
              Removing...
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleRemoveMember}>
              Remove
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
