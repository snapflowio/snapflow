import { createContext } from "react";
import { ApiClient } from "@/api/api-client";

export const ApiContext = createContext<ApiClient | null>(null);
