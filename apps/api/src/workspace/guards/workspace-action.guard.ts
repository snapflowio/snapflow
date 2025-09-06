import { ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RequiredWorkspaceMemberRole } from "../decorators/required-workspace-member-role.decorator";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";
import { WorkspaceAuthContext } from "../interfaces/workspace-auth-context.interface";
import { WorkspaceUserService } from "../services/workspace-user.service";
import { WorkspaceService } from "../services/workspace.service";
import { WorkspaceAccessGuard } from "./workspace-access.guard";

@Injectable()
export class WorkspaceActionGuard extends WorkspaceAccessGuard {
  protected readonly logger = new Logger(WorkspaceActionGuard.name);

  constructor(
    workspaceService: WorkspaceService,
    workspaceUserService: WorkspaceUserService,
    private readonly reflector: Reflector
  ) {
    super(workspaceService, workspaceUserService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await super.canActivate(context))) return false;

    const request = context.switchToHttp().getRequest();
    const authContext: WorkspaceAuthContext = request.user || request.workspaceContext;

    if (!authContext.workspaceUser) {
      this.logger.warn("Workspace user not found in auth context");
      return false;
    }

    // Check for required role decorator
    const requiredRole = this.reflector.get(RequiredWorkspaceMemberRole, context.getHandler());

    // If no required role is specified, allow access (basic workspace access is already validated)
    if (!requiredRole) return true;

    // Check role hierarchy: OWNER > MEMBER
    const userRole = authContext.workspaceUser.role;

    switch (requiredRole) {
      case WorkspaceMemberRole.OWNER:
        return userRole === WorkspaceMemberRole.OWNER;
      case WorkspaceMemberRole.MEMBER:
        return userRole === WorkspaceMemberRole.OWNER || userRole === WorkspaceMemberRole.MEMBER;

      default:
        this.logger.warn(`Unknown required role: ${requiredRole}`);
        return false;
    }
  }
}
