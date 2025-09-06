import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { WorkspaceService } from "../services/workspace.service";
import { WorkspaceUserService } from "../services/workspace-user.service";
import { AuthContext, WorkspaceAuthContext } from "../interfaces/workspace-auth-context.interface";

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  protected readonly logger = new Logger(WorkspaceAccessGuard.name);

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceUserService: WorkspaceUserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.session;

    if (!session?.user) {
      this.logger.warn("User session not found. Authentication may not be set up correctly.");
      return false;
    }

    const authContext: AuthContext = {
      userId: session.user.id,
      user: session.user,
    };

    // Get workspace ID from route params (supports both workspaceId and wsId)
    const workspaceIdParam = 
      request.params.workspaceId || 
      request.params.wsId || 
      request.body?.workspaceId;

    if (!workspaceIdParam) {
      this.logger.warn("Workspace ID missing from the request context.");
      return false;
    }

    // Find the workspace
    const workspace = await this.workspaceService.findByUser(authContext.userId);
    const targetWorkspace = workspace?.find(ws => ws.id === workspaceIdParam);

    if (!targetWorkspace) {
      this.logger.warn(`Workspace not found or user lacks access. Workspace ID: ${workspaceIdParam}, User ID: ${authContext.userId}`);
      return false;
    }

    // Create workspace auth context
    const workspaceAuthContext: WorkspaceAuthContext = {
      ...authContext,
      workspaceId: workspaceIdParam,
      workspace: targetWorkspace,
    };

    // Check if user is a member of this workspace
    const workspaceUser = await this.workspaceUserService.findOne(
      workspaceIdParam,
      authContext.userId
    );

    if (!workspaceUser) {
      this.logger.warn(
        `Workspace user not found. User ID: ${authContext.userId}, Workspace ID: ${workspaceIdParam}`
      );
      return false;
    }

    // Add workspace user to context
    workspaceAuthContext.workspaceUser = workspaceUser;
    
    // Attach workspace context to request
    request.user = workspaceAuthContext;
    request.workspaceContext = workspaceAuthContext;

    return true;
  }
}