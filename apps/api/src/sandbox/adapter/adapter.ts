import { Injectable, Logger } from "@nestjs/common";
import { Executor } from "../entities/executor.entity";
import { ModuleRef } from "@nestjs/core";
import { ExecutorAdapterLegacy } from "./legacy";
import { BuildInfo } from "../entities/build-info.entity";
import { Registry } from "../../registry/entities/registry.entity";
import { Sandbox } from "../entities/sandbox.entity";
import { SandboxState } from "../enums/sandbox-state.enum";
import { BackupState } from "../enums/backup-state.enum";

export interface ExecutorSandboxInfo {
  state: SandboxState;
  backupState?: BackupState;
}

export interface ExecutorMetrics {
  currentAllocatedCpu?: number;
  currentAllocatedDiskGiB?: number;
  currentAllocatedMemoryGiB?: number;
  currentCpuUsagePercentage?: number;
  currentDiskUsagePercentage?: number;
  currentMemoryUsagePercentage?: number;
  currentImageCount?: number;
}

export interface ExecutorInfo {
  metrics?: ExecutorMetrics;
}

export interface ExecutorAdapter {
  init(executor: Executor): Promise<void>;

  healthCheck(): Promise<void>;

  executorInfo(): Promise<ExecutorInfo>;

  sandboxInfo(sandboxId: string): Promise<ExecutorSandboxInfo>;
  createSandbox(sandbox: Sandbox, registry?: Registry, entrypoint?: string[]): Promise<void>;
  startSandbox(sandboxId: string): Promise<void>;
  stopSandbox(sandboxId: string): Promise<void>;
  destroySandbox(sandboxId: string): Promise<void>;
  removeDestroyedSandbox(sandboxId: string): Promise<void>;
  createBackup(sandbox: Sandbox, backupImageName: string, registry?: Registry): Promise<void>;

  removeImage(snapshotName: string): Promise<void>;
  buildImage(
    buildInfo: BuildInfo,
    organizationId?: string,
    registry?: Registry,
    pushToInternalRegistry?: boolean
  ): Promise<void>;
  pullImage(snapshotName: string, registry?: Registry): Promise<void>;
  imageExists(snapshotName: string): Promise<boolean>;
  getImageLogs(snapshotRef: string, follow: boolean): Promise<string>;

  getSandboxDaemonVersion(sandboxId: string): Promise<string>;
}

@Injectable()
export class ExecutorAdapterFactory {
  private readonly logger = new Logger(ExecutorAdapterFactory.name);

  constructor(private moduleRef: ModuleRef) {}

  async create(executor: Executor): Promise<ExecutorAdapter> {
    switch (executor.version) {
      case "0": {
        const adapter = await this.moduleRef.create(ExecutorAdapterLegacy);
        await adapter.init(executor);
        return adapter;
      }
      default:
        throw new Error(`Unsupported executor version: ${executor.version}`);
    }
  }
}
