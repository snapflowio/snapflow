import { Action, toast } from "sonner";
import { SnapflowError } from "@/api/errors";

export function handleApiError(
  error: unknown,
  message: string,
  toastAction?: React.ReactNode | Action,
) {
  const isSnapflowError = error instanceof SnapflowError;

  toast.error(message, {
    description: isSnapflowError
      ? error.message
      : "Please try again or check the console for more details",
    action: toastAction,
  });

  if (!isSnapflowError) console.error(message, error);
}
