import { Sandbox } from "../entities/sandbox.entity";

export class SandboxArchivedEvent {
  constructor(public readonly sandbox: Sandbox) {}
}
