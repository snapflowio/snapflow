export function fromAxiosError(error: any): Error {
  return new Error(
    error.response?.data?.message ||
      error.response?.data ||
      error.message ||
      error,
  );
}
