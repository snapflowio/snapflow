import { Reflector } from "@nestjs/core";
import { OrganizationResourcePermission } from "../enums/organization-resource-permission.enum";

export const RequiredOrganizationResourcePermissions =
  Reflector.createDecorator<OrganizationResourcePermission[]>();
