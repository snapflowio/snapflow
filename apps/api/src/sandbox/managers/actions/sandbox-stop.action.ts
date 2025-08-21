import { Injectable } from "@nestjs/common";
import { Sandbox } from "../../entities/sandbox.entity";
import { SandboxState } from "../../enums/sandbox-state.enum";
import { DONT_SYNC_AGAIN, SandboxAction, SyncState, SYNC_AGAIN } from "./sandbox.action";
import { BackupState } from "../../enums/backup-state.enum";
import { ExecutorState } from "../../enums/executor-state.enum";
import { ToolboxService } from "../../services/toolbox.service";
import { ExecutorService } from "../../services/executor.service";
import { ExecutorAdapterFactory } from "../../adapter/adapter";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

@Injectable()
export class SandboxStopAction extends SandboxAction {
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
    const executor = await this.executorService.findOne(sandbox.executorId);
    if (executor.state !== ExecutorState.READY) {
      return DONT_SYNC_AGAIN;
    }

    const executorAdapter = await this.executorAdapterFactory.create(executor);

    switch (sandbox.state) {
      case SandboxState.STARTED: {
        // stop sandbox
        await executorAdapter.stopSandbox(sandbox.id);
        await this.updateSandboxState(sandbox.id, SandboxState.STOPPING);
        //  sync states again immediately for sandbox
        return SYNC_AGAIN;
      }
      case SandboxState.STOPPING: {
        // check if sandbox is stopped
        const sandboxInfo = await executorAdapter.sandboxInfo(sandbox.id);
        switch (sandboxInfo.state) {
          case SandboxState.STOPPED: {
            const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
              id: sandbox.id,
            });
            sandboxToUpdate.state = SandboxState.STOPPED;
            sandboxToUpdate.backupState = BackupState.NONE;
            await this.sandboxRepository.save(sandboxToUpdate);
            return SYNC_AGAIN;
          }
          case SandboxState.ERROR: {
            await this.updateSandboxState(
              sandbox.id,
              SandboxState.ERROR,
              undefined,
              "Sandbox is in error state on executor"
            );
            return DONT_SYNC_AGAIN;
          }
        }
        return SYNC_AGAIN;
      }
      case SandboxState.ERROR: {
        const sandboxInfo = await executorAdapter.sandboxInfo(sandbox.id);
        if (sandboxInfo.state === SandboxState.STOPPED) {
          await this.updateSandboxState(sandbox.id, SandboxState.STOPPED);
        }
      }
    }

    return DONT_SYNC_AGAIN;
  }
}
