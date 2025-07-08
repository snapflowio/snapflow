import { useEffect } from "react";
import { FallbackProps } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ErrorBoundaryProvider({
  error,
  resetErrorBoundary,
}: FallbackProps) {
  useEffect(() => {
    console.error(error);
  });

  return (
    <Dialog open>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="mb-2">Oops! An error occurred</DialogTitle>
          <DialogDescription>
            Sorry, we couldn't load the dashboard right now. This might be a
            temporary issue. Please try again, and if the problem continues,
            feel free to reach out to our support team.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
            <Button onClick={resetErrorBoundary}>Try Again</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
