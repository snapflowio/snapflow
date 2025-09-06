import { Reflector } from "@nestjs/core";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";

export const RequiredWorkspaceMemberRole = Reflector.createDecorator<WorkspaceMemberRole>();
