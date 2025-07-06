import { Sandbox } from "../entities/sandbox.entity";

export class SandboxDestroyedEvent {
  constructor(public readonly sandbox: Sandbox) {}
}
