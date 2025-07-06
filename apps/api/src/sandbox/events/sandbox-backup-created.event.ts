import { Sandbox } from "../entities/sandbox.entity";

export class SandboxBackupCreatedEvent {
  constructor(public readonly sandbox: Sandbox) {}
}
