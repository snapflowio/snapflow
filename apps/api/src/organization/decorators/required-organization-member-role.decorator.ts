import { Reflector } from "@nestjs/core";
import { OrganizationMemberRole } from "../enums/organization-member-role.enum";

export const RequiredOrganizationMemberRole =
  Reflector.createDecorator<OrganizationMemberRole>();
