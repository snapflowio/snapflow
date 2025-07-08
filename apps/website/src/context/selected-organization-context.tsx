import { createContext } from "react";
import {
  Organization,
  OrganizationRolePermissionsEnum,
  OrganizationUser,
} from "@snapflow/api-client";

export interface ISelectedOrganizationContext {
  selectedOrganization: Organization | null;
  organizationMembers: OrganizationUser[];
  refreshOrganizationMembers: () => Promise<OrganizationUser[]>;
  authenticatedUserOrganizationMember: OrganizationUser | null;
  authenticatedUserHasPermission: (
    permission: OrganizationRolePermissionsEnum,
  ) => boolean;
  onSelectOrganization: (organizationId: string) => Promise<boolean>;
}

export const SelectedOrganizationContext = createContext<
  ISelectedOrganizationContext | undefined
>(undefined);
