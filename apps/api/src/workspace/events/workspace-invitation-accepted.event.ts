import { Database } from "../../database/repositories/base.repository";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";

export class WorkspaceInvitationAcceptedEvent {
  constructor(
    public readonly db: Database,
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly role: WorkspaceMemberRole
  ) {}
}
