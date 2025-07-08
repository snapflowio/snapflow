import { Sandbox } from "../entities/sandbox.entity";
import { SandboxDesiredState } from "../enums/sandbox-desired-state.enum";

export class SandboxDesiredStateUpdatedEvent {
  constructor(
    public readonly sandbox: Sandbox,
    public readonly oldDesiredState: SandboxDesiredState,
    public readonly newDesiredState: SandboxDesiredState,
  ) {}
}
