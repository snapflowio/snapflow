export class WorkspaceInvitationCreatedEvent {
  constructor(
    public readonly workspaceName: string,
    public readonly invitedBy: string,
    public readonly email: string,
    public readonly invitationId: string,
    public readonly expiresAt: Date
  ) {}
}