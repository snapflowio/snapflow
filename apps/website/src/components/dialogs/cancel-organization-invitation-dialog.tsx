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

interface CancelOrganizationInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelInvitation: () => Promise<boolean>;
  loading: boolean;
}

export function CancelOrganizationInvitationDialog({
  open,
  onOpenChange,
  onCancelInvitation,
  loading,
}: CancelOrganizationInvitationDialogProps) {
  const handleCancelInvitation = async () => {
    const success = await onCancelInvitation();
    if (success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Invitation</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this invitation to join the organization?
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
              Confirming...
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleCancelInvitation}>
              Confirm
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}