import { User, Workspace, WorkspaceUser } from "../../database/schema";

export interface AuthContext {
  userId: string;
  user?: User;
}

export interface WorkspaceAuthContext extends AuthContext {
  workspaceId: string;
  workspace: Workspace;
  workspaceUser?: WorkspaceUser;
}