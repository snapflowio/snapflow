import { Sandbox } from "../entities/sandbox.entity";

export class SandboxCreatedEvent {
  constructor(public readonly sandbox: Sandbox) {}
}
