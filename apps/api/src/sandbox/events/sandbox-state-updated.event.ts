import { Sandbox } from "../entities/sandbox.entity";
import { SandboxState } from "../enums/sandbox-state.enum";

export class SandboxStateUpdatedEvent {
  constructor(
    public readonly sandbox: Sandbox,
    public readonly oldState: SandboxState,
    public readonly newState: SandboxState
  ) {}
}
