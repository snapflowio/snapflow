import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ExecutorAdapterFactory } from "../../adapter/adapter";
import { Sandbox } from "../../entities/sandbox.entity";
import { ExecutorState } from "../../enums/executor-state.enum";
import { SandboxState } from "../../enums/sandbox-state.enum";
import { ExecutorService } from "../../services/executor.service";
import { ToolboxService } from "../../services/toolbox.service";
import { DONT_SYNC_AGAIN, SandboxAction, SYNC_AGAIN, SyncState } from "./sandbox.action";

@Injectable()
export class SandboxDestroyAction extends SandboxAction {
  constructor(
    protected executorService: ExecutorService,
    protected executorAdapterFactory: ExecutorAdapterFactory,
    @InjectRepository(Sandbox)
    protected sandboxRepository: Repository<Sandbox>,
    protected toolboxService: ToolboxService
  ) {
    super(executorService, executorAdapterFactory, sandboxRepository, toolboxService);
  }

  async run(sandbox: Sandbox): Promise<SyncState> {
    if (sandbox.state === SandboxState.ARCHIVED) {
      await this.updateSandboxState(sandbox.id, SandboxState.DESTROYED);
      return DONT_SYNC_AGAIN;
    }

    const executor = await this.executorService.findOne(sandbox.executorId);
    if (executor.state !== ExecutorState.READY) {
      return DONT_SYNC_AGAIN;
    }

    const executorAdapter = await this.executorAdapterFactory.create(executor);

    switch (sandbox.state) {
      case SandboxState.DESTROYED:
        return DONT_SYNC_AGAIN;
      case SandboxState.DESTROYING: {
        // check if sandbox is destroyed
        try {
          const sandboxInfo = await executorAdapter.sandboxInfo(sandbox.id);
          if (
            sandboxInfo.state === SandboxState.DESTROYED ||
            sandboxInfo.state === SandboxState.ERROR
          ) {
            await executorAdapter.removeDestroyedSandbox(sandbox.id);
          }
        } catch (e) {
          //  if the sandbox is not found on executor, it is already destroyed
          if (!e.response || e.response.status !== 404) {
            throw e;
          }
        }

        await this.updateSandboxState(sandbox.id, SandboxState.DESTROYED);
        return SYNC_AGAIN;
      }
      default: {
        // destroy sandbox
        try {
          const sandboxInfo = await executorAdapter.sandboxInfo(sandbox.id);
          if (sandboxInfo?.state === SandboxState.DESTROYED) {
            await this.updateSandboxState(sandbox.id, SandboxState.DESTROYING);
            return SYNC_AGAIN;
          }
          await executorAdapter.destroySandbox(sandbox.id);
        } catch (e) {
          //  if the sandbox is not found on executor, it is already destroyed
          if (e.response.status !== 404) {
            throw e;
          }
        }
        await this.updateSandboxState(sandbox.id, SandboxState.DESTROYING);
        return SYNC_AGAIN;
      }
    }
  }
}
