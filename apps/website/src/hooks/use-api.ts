import { useContext } from "react";

import { ApiContext } from "@/context/api-context";

export function useApi() {
  const apiClient = useContext(ApiContext);

  if (!apiClient) {
    throw new Error("useApi must be used within an ApiProvider");
  }

  return apiClient;
}
