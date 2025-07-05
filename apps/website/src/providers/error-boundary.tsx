import { Button } from "@snapflow/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@snapflow/ui/components/ui/dialog";
import { FallbackProps } from "react-error-boundary";

export function ErrorBoundaryProvider({
  error,
  resetErrorBoundary,
}: FallbackProps) {
  return (
    <Dialog open>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Something went wrong</DialogTitle>
          <DialogDescription>
            We're having trouble loading the dashboard. This could be due to a
            temporary service issue or network problem. Please try again or
            contact support if the issue persists.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <h4 className="mb-2 font-semibold text-red-800 dark:text-red-200">
              Error Details:
            </h4>
            <p className="break-all font-mono text-red-700 text-sm dark:text-red-300">
              {error?.message || "Unknown error"}
            </p>
          </div>

          {error?.stack && (
            <details className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/20">
              <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-200">
                Stack Trace (click to expand)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-gray-700 text-xs dark:text-gray-300">
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
            <Button variant="outline" onClick={resetErrorBoundary}>
              Try Again
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
