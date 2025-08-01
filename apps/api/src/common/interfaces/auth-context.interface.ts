import type { ApiKey } from "../../api-key/api-key.entity";
import type { Organization } from "../../organization/entities/organization.entity";
import type { OrganizationUser } from "../../organization/entities/organization-user.entity";
import type { SystemRole } from "../../user/enums/system-role.enum";

export interface BaseAuthContext {
  role: ApiRole;
}

export type ApiRole = SystemRole | "proxy";

export interface AuthContext extends BaseAuthContext {
  userId: string;
  email: string;
  apiKey?: ApiKey;
  organizationId?: string;
}

export function isAuthContext(user: BaseAuthContext): user is AuthContext {
  return "userId" in user;
}

export interface OrganizationAuthContext extends AuthContext {
  organizationId: string;
  organization: Organization;
  organizationUser?: OrganizationUser;
}

export function isOrganizationAuthContext(user: BaseAuthContext): user is OrganizationAuthContext {
  return "organizationId" in user;
}
