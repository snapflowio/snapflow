import axios from "axios";
import axiosDebug from "axios-debug-log";
import axiosRetry from "axios-retry";

import { Injectable, Logger } from "@nestjs/common";
import { ExecutorAdapter, ExecutorInfo, ExecutorSandboxInfo } from "./adapter";
import { Executor } from "../entities/executor.entity";
import {
  Configuration,
  SandboxApi,
  EnumsSandboxState,
  ImagesApi,
  EnumsBackupState,
  DefaultApi,
  CreateSandboxDTO,
  BuildImageRequestDTO,
  CreateBackupDTO,
  PullImageRequestDTO,
  ToolboxApi,
} from "@snapflow/executor-api-client";
import { Sandbox } from "../entities/sandbox.entity";
import { BuildInfo } from "../entities/build-info.entity";
import { Registry } from "../../registry/entities/registry.entity";
import { SandboxState } from "../enums/sandbox-state.enum";
import { BackupState } from "../enums/backup-state.enum";

const isDebugEnabled = process.env.DEBUG === "true";

@Injectable()
export class ExecutorAdapterLegacy implements ExecutorAdapter {
  private readonly logger = new Logger(ExecutorAdapterLegacy.name);
  private sandboxApiClient: SandboxApi;
  private imageApiClient: ImagesApi;
  private executorApiClient: DefaultApi;
  private toolboxApiClient: ToolboxApi;

  private convertSandboxState(state: EnumsSandboxState): SandboxState {
    switch (state) {
      case EnumsSandboxState.SandboxStateCreating:
        return SandboxState.CREATING;
      case EnumsSandboxState.SandboxStateRestoring:
        return SandboxState.RESTORING;
      case EnumsSandboxState.SandboxStateDestroyed:
        return SandboxState.DESTROYED;
      case EnumsSandboxState.SandboxStateDestroying:
        return SandboxState.DESTROYING;
      case EnumsSandboxState.SandboxStateStarted:
        return SandboxState.STARTED;
      case EnumsSandboxState.SandboxStateStopped:
        return SandboxState.STOPPED;
      case EnumsSandboxState.SandboxStateStarting:
        return SandboxState.STARTING;
      case EnumsSandboxState.SandboxStateStopping:
        return SandboxState.STOPPING;
      case EnumsSandboxState.SandboxStateError:
        return SandboxState.ERROR;
      case EnumsSandboxState.SandboxStatePullingImage:
        return SandboxState.PULLING_IMAGE;
      default:
        return SandboxState.UNKNOWN;
    }
  }

  private convertBackupState(state: EnumsBackupState): BackupState {
    switch (state) {
      case EnumsBackupState.BackupStatePending:
        return BackupState.PENDING;
      case EnumsBackupState.BackupStateInProgress:
        return BackupState.IN_PROGRESS;
      case EnumsBackupState.BackupStateCompleted:
        return BackupState.COMPLETED;
      default:
        return BackupState.NONE;
    }
  }

  public async init(executor: Executor): Promise<void> {
    const axiosInstance = axios.create({
      baseURL: executor.apiUrl,
      headers: {
        Authorization: `Bearer ${executor.apiKey}`,
      },
      timeout: 1 * 60 * 60 * 1000, // 1 hour
    });

    // Configure axios-retry to handle ECONNRESET errors
    axiosRetry(axiosInstance, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        // Retry on ECONNRESET errors
        return (
          (error as any).code === "ECONNRESET" ||
          error.message?.includes("ECONNRESET") ||
          (error as any).cause?.code === "ECONNRESET"
        );
      },
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn(
          `Retrying request due to ECONNRESET (attempt ${retryCount}): ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`
        );
      },
    });

    axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        const errorMessage =
          error.response?.data?.message || error.response?.data || error.message || String(error);

        throw new Error(String(errorMessage));
      }
    );

    if (isDebugEnabled) {
      axiosDebug.addLogger(axiosInstance);
    }

    this.sandboxApiClient = new SandboxApi(new Configuration(), "", axiosInstance);
    this.imageApiClient = new ImagesApi(new Configuration(), "", axiosInstance);
    this.executorApiClient = new DefaultApi(new Configuration(), "", axiosInstance);
    this.toolboxApiClient = new ToolboxApi(new Configuration(), "", axiosInstance);
  }

  async healthCheck(): Promise<void> {
    const response = await this.executorApiClient.healthCheck();
    if (response.data.status !== "ok") {
      throw new Error("Executor is not healthy");
    }
  }

  async executorInfo(): Promise<ExecutorInfo> {
    const response = await this.executorApiClient.executorInfo();
    return {
      metrics: response.data.metrics,
    };
  }

  async sandboxInfo(sandboxId: string): Promise<ExecutorSandboxInfo> {
    const sandboxInfo = await this.sandboxApiClient.info(sandboxId);
    return {
      state: this.convertSandboxState(sandboxInfo.data.state),
      backupState: this.convertBackupState(sandboxInfo.data.backupState),
    };
  }

  async createSandbox(sandbox: Sandbox, registry?: Registry, entrypoint?: string[]): Promise<void> {
    const request: CreateSandboxDTO = {
      id: sandbox.id,
      image: sandbox.image,
      osUser: sandbox.osUser,
      userId: sandbox.organizationId,
      storageQuota: sandbox.disk,
      memoryQuota: sandbox.mem,
      cpuQuota: sandbox.cpu,
      env: sandbox.env,
      buckets: sandbox.buckets,
      entrypoint: entrypoint,
    };

    if (registry) {
      request.registry = {
        project: registry.name,
        url: registry.url,
        username: registry.username,
        password: registry.password,
      };
    }

    await this.sandboxApiClient.create(request);
  }

  async startSandbox(sandboxId: string): Promise<void> {
    await this.sandboxApiClient.start(sandboxId);
  }

  async stopSandbox(sandboxId: string): Promise<void> {
    await this.sandboxApiClient.stop(sandboxId);
  }

  async destroySandbox(sandboxId: string): Promise<void> {
    await this.sandboxApiClient.destroy(sandboxId);
  }

  async removeDestroyedSandbox(sandboxId: string): Promise<void> {
    await this.sandboxApiClient.removeDestroyed(sandboxId);
  }

  async createBackup(
    sandbox: Sandbox,
    backupImageName: string,
    registry?: Registry
  ): Promise<void> {
    const request: CreateBackupDTO = {
      image: backupImageName,
      registry: undefined,
    };

    if (registry) {
      request.registry = {
        project: registry.name,
        url: registry.url,
        username: registry.username,
        password: registry.password,
      };
    }

    await this.sandboxApiClient.createBackup(sandbox.id, request);
  }

  async buildImage(
    buildInfo: BuildInfo,
    organizationId?: string,
    registry?: Registry,
    pushToInternalRegistry?: boolean
  ): Promise<void> {
    const request: BuildImageRequestDTO = {
      image: buildInfo.imageRef,
      dockerfile: buildInfo.dockerfileContent,
      organizationId: organizationId,
      context: buildInfo.contextHashes,
      pushToInternalRegistry: pushToInternalRegistry,
    };

    if (registry) {
      request.registry = {
        project: registry.name,
        url: registry.url,
        username: registry.username,
        password: registry.password,
      };
    }

    await this.imageApiClient.buildImage(request);
  }

  async removeImage(imageName: string): Promise<void> {
    await this.imageApiClient.removeImage(imageName);
  }

  async pullImage(imageName: string, registry?: Registry): Promise<void> {
    const request: PullImageRequestDTO = {
      image: imageName,
    };

    if (registry) {
      request.registry = {
        project: registry.name,
        url: registry.url,
        username: registry.username,
        password: registry.password,
      };
    }

    await this.imageApiClient.pullImage(request);
  }

  async imageExists(imageName: string): Promise<boolean> {
    const response = await this.imageApiClient.imageExists(imageName);
    return response.data.exists;
  }

  async getImageLogs(imageRef: string, follow: boolean): Promise<string> {
    const response = await this.imageApiClient.getBuildLogs(imageRef, follow);
    return response.data;
  }

  async getSandboxDaemonVersion(sandboxId: string): Promise<string> {
    const getVersionResponse = await this.toolboxApiClient.sandboxesSandboxIdToolboxPathGet(
      sandboxId,
      "version"
    );
    if (!getVersionResponse.data || !(getVersionResponse.data as any).version) {
      throw new Error("Failed to get sandbox node version");
    }

    return (getVersionResponse.data as any).version;
  }
}
