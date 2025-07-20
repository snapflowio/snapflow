import { isAxiosError } from "axios";

/**
 * Extracts a meaningful error message from an Axios error or any other error type.
 * It prioritizes messages from the Axios response data, falling back to the
 * standard error message.
 *
 * @param error - The error object, which may be an `AxiosError`.
 * @returns An `Error` object with a descriptive message.
 */
export function fromAxiosError(error: unknown): Error {
  let message = "An unexpected error occurred.";

  if (isAxiosError(error)) {
    // Type guard ensures `error` is an `AxiosError`
    const responseData = error.response?.data;
    // Safely access nested properties for the error message
    message = responseData?.message || responseData || error.message;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }

  return new Error(message);
}
