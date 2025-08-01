"use client";

import { createContext } from "react";
import { Organization } from "@snapflow/api-client";

export interface IOrganizationsContext {
  organizations: Organization[];
  refreshOrganizations: () => Promise<Organization[]>;
}

export const OrganizationsContext = createContext<IOrganizationsContext | undefined>(undefined);
