/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

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
  authenticatedUserHasPermission: (permission: OrganizationRolePermissionsEnum) => boolean;
  onSelectOrganization: (organizationId: string) => Promise<boolean>;
}

export const SelectedOrganizationContext = createContext<ISelectedOrganizationContext | undefined>(
  undefined
);
