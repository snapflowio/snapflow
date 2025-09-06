import type { ApiClient } from "@/api/api-client";
import { createContext } from "react";

export const ApiContext = createContext<ApiClient | null>(null);
