import { createContext } from "react";
import { IdTokenClaims } from "@logto/react";
import { ApiClient } from "@/api/api-client";

export const ApiContext = createContext<(ApiClient & { user: IdTokenClaims | undefined }) | null>(
  null
);
