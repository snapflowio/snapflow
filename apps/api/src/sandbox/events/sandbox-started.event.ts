import { Sandbox } from "../entities/sandbox.entity";

export class SandboxStartedEvent {
  constructor(public readonly sandbox: Sandbox) {}
}
