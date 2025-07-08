import { Sandbox } from "../entities/sandbox.entity";

export class SandboxPublicStatusUpdatedEvent {
  constructor(
    public readonly sandbox: Sandbox,
    public readonly oldStatus: boolean,
    public readonly newStatus: boolean,
  ) {}
}
