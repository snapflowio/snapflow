import { Sandbox } from "../entities/sandbox.entity";

export class SandboxOrganizationUpdatedEvent {
  constructor(
    public readonly sandbox: Sandbox,
    public readonly oldOrganizationId: string,
    public readonly newOrganizationId: string
  ) {}
}
