import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ExecutorService } from "../../services/executor.service";
import { ExecutorAdapterFactory } from "../../adapter/adapter";
import { Sandbox } from "../../entities/sandbox.entity";
import { Repository } from "typeorm";
import { SandboxState } from "../../enums/sandbox-state.enum";
import { ToolboxService } from "../../services/toolbox.service";

export const SYNC_AGAIN = "sync-again";
export const DONT_SYNC_AGAIN = "dont-sync-again";
export type SyncState = typeof SYNC_AGAIN | typeof DONT_SYNC_AGAIN;

@Injectable()
export abstract class SandboxAction {
  constructor(
    protected readonly executorService: ExecutorService,
    protected executorAdapterFactory: ExecutorAdapterFactory,
    @InjectRepository(Sandbox)
    protected readonly sandboxRepository: Repository<Sandbox>,
    protected readonly toolboxService: ToolboxService
  ) {}

  abstract run(sandbox: Sandbox): Promise<SyncState>;

  protected async updateSandboxState(
    sandboxId: string,
    state: SandboxState,
    executorId?: string | null | undefined,
    errorReason?: string,
    nodeVersion?: string
  ) {
    const sandbox = await this.sandboxRepository.findOneByOrFail({
      id: sandboxId,
    });
    if (
      sandbox.state === state &&
      sandbox.executorId === executorId &&
      sandbox.errorReason === errorReason
    ) {
      return;
    }

    sandbox.state = state;

    if (executorId !== undefined) {
      sandbox.executorId = executorId;
    }

    if (errorReason !== undefined) {
      sandbox.errorReason = errorReason;
    }

    if (nodeVersion !== undefined) {
      sandbox.nodeVersion = nodeVersion;
    }

    await this.sandboxRepository.save(sandbox);
  }
}
