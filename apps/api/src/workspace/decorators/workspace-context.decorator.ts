import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { WorkspaceAuthContext } from "../interfaces/workspace-auth-context.interface";

export const WorkspaceContext = createParamDecorator(
  (data: keyof WorkspaceAuthContext | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const workspaceContext: WorkspaceAuthContext = request.workspaceContext || request.user;

    return data ? workspaceContext?.[data] : workspaceContext;
  }
);

export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const workspaceContext: WorkspaceAuthContext = request.workspaceContext || request.user;
    return workspaceContext?.workspace;
  }
);

export const CurrentWorkspaceUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const workspaceContext: WorkspaceAuthContext = request.workspaceContext || request.user;
    return workspaceContext?.workspaceUser;
  }
);